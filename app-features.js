
// Feature Data
const featureData = {
    insights: {
        title: "Visualize your spending",
        text: "See exactly where your money goes with intuitive, interactive charts that make complex data simple and actionable."
    },
    growth: {
        title: "Watch your savings grow",
        text: "Our smart algorithms suggest personalized investment strategies to maximize your wealth potential securely."
    },
    protection: {
        title: "Bank-grade security",
        text: "Rest easy knowing your financial data is protected by state-of-the-art encryption and biometric authentication."
    }
};

let currentFeature = 'insights';

function updateSpotlight(featureKey) {
    if (currentFeature === featureKey) return; // No change needed
    currentFeature = featureKey;

    // 1. Update Buttons
    document.querySelectorAll('.feature-box').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.feature === featureKey);
    });

    // 2. Animate Content Swap
    const container = document.getElementById('spotlight-content');
    const data = featureData[featureKey];

    // Fade out
    container.classList.remove('fade-in');
    container.classList.add('fade-out');

    setTimeout(() => {
        // Swap text
        container.innerHTML = `
            <h3>${escapeHtml(data.title)}</h3>
            <p>${escapeHtml(data.text)}</p>
        `;

        // Fade in
        container.classList.remove('fade-out');
        container.classList.add('fade-in');
    }, 200); // Wait for fade out
}

// Event delegation for feature buttons (replaces inline onclick)
document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-feature]');
    if (!btn) return;
    updateSpotlight(btn.dataset.feature);
});
