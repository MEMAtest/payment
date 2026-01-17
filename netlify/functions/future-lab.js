exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "Missing API key" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const system = [
    "You are Poapyments Future Lab.",
    "Provide a short, plain-English response (2-4 sentences).",
    "Do not provide regulated financial advice. Provide education and options.",
    "Offer 1 alternative action.",
  ].join(" ");

  const user = `Question: ${payload.question}
Scenario: ${payload.type}, duration ${payload.months} months, amount ${payload.amount} GBP.
Snapshot: income ${payload.snapshot?.income}, essentials ${payload.snapshot?.essentials}, debt ${payload.snapshot?.debt}, savings ${payload.snapshot?.savings}, surplus ${payload.snapshot?.surplus}, goalContribution ${payload.snapshot?.goalContribution}.
Baseline end balance: ${payload.baseline?.balance}, risk months ${payload.baseline?.riskMonths}.
Scenario end balance: ${payload.scenario?.balance}, delta ${payload.scenario?.delta}, risk months ${payload.scenario?.riskMonths}, goal timing: ${payload.scenario?.delay}.`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-70b-versatile",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.4,
        max_tokens: 220,
      }),
    });

    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: "Groq API error" }) };
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message?.content?.trim() || "";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: "Request failed" }) };
  }
};
