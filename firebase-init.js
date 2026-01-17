(() => {
  const config = window.POAP_FIREBASE_CONFIG;
  if (!config || !config.apiKey || String(config.apiKey).includes("YOUR_API_KEY")) {
    return;
  }

  const scripts = [
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions-compat.js",
  ];

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });

  Promise.all(scripts.map(loadScript))
    .then(() => {
      if (!window.firebase?.initializeApp) return;
      window.firebase.initializeApp(config);
      const db = window.firebase.firestore();
      const functions = window.firebase.functions();
      window.POAP_FIREBASE = { db, functions, firebase: window.firebase };
      window.dispatchEvent(new Event("poap:firebase-ready"));
    })
    .catch(() => {
      // Ignore Firebase load failures.
    });
})();
