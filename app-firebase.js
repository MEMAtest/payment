// Firebase (optional)
async function initFirebase() {
  if (typeof window.initFirebaseClient === "function") {
    try {
      firebaseClient = await window.initFirebaseClient();
      await loadStateFromFirebase();
    } catch (e) {
      console.warn("Firebase initialization failed:", e);
    }
  }
}

async function loadStateFromFirebase() {
  if (!firebaseClient) return;
  try {
    const doc = await firebaseClient.getDoc(firebaseClient.doc(firebaseClient.db, "users", deviceId));
    if (doc.exists()) {
      const remote = doc.data();
      if (remote.updatedAt > state.updatedAt) {
        applyState(remote, remote.updatedAt);
        syncFormFromState();
        updateSummary();
      }
    }
  } catch (e) {
    console.warn("Failed to load from Firebase:", e);
  }
}

async function saveStateToFirebase() {
  if (!firebaseClient) return;
  try {
    const payload = serializeState();
    await firebaseClient.setDoc(firebaseClient.doc(firebaseClient.db, "users", deviceId), payload);
  } catch (e) {
    console.warn("Failed to save to Firebase:", e);
  }
}
