const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const apiKey =
  (functions.config()?.groq && functions.config().groq.key) ||
  process.env.GROQ_API_KEY;
const MODEL = "llama-3.1-70b-versatile";

exports.futureLab = functions
  .runWith({ secrets: ["GROQ_API_KEY"] })
  .https.onCall(async (data) => {
  if (!apiKey) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing GROQ_API_KEY."
    );
  }

  const question = String(data?.question || "").slice(0, 500);
  const type = String(data?.type || "scenario");
  const months = Number(data?.months) || 0;
  const amount = Number(data?.amount) || 0;
  const snapshot = data?.snapshot || {};
  const baseline = data?.baseline || {};
  const scenario = data?.scenario || {};

  const system = [
    "You are Poapyments Future Lab.",
    "Provide a short, plain-English response (2-4 sentences).",
    "Do not provide regulated financial advice. Provide education and options.",
    "Offer 1 alternative action.",
  ].join(" ");

  const user = `Question: ${question}
Scenario: ${type}, duration ${months} months, amount ${amount} GBP.
Snapshot: income ${snapshot.income}, essentials ${snapshot.essentials}, debt ${snapshot.debt}, savings ${snapshot.savings}, surplus ${snapshot.surplus}, goalContribution ${snapshot.goalContribution}.
Baseline end balance: ${baseline.balance}, risk months ${baseline.riskMonths}.
Scenario end balance: ${scenario.balance}, delta ${scenario.delta}, risk months ${scenario.riskMonths}, goal timing: ${scenario.delay}.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      max_tokens: 220,
    }),
  });

  if (!response.ok) {
    throw new functions.https.HttpsError(
      "internal",
      `Groq request failed with ${response.status}`
    );
  }

  const payload = await response.json();
  const message = payload?.choices?.[0]?.message?.content || "";
  return { message: String(message).trim() };
  });
