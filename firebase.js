// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: window.env.VITE_API_KEY,
    authDomain: window.env.VITE_AUTH_DOMAIN,
    projectId: window.env.VITE_PROJECT_ID,
    storageBucket: window.env.VITE_STORAGE_BUCKET,
    messagingSenderId: window.env.VITE_MESSAGING_SENDER_ID,
    appId: window.env.VITE_APP_ID
};

let app, auth, db;

function initFirebase(onUserReady) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    onAuthStateChanged(auth, (user) => {
        if (user) {
            onUserReady(user);
        } else {
            signInAnonymously(auth).catch(console.error);
        }
    });

    return { app, auth, db };
}

export { initFirebase, auth, db };
