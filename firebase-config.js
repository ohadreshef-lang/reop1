// Firebase Configuration
// ======================
// To use this app with Firebase:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project (or use an existing one)
// 3. Go to Project Settings > General > Your apps
// 4. Click "Add app" and select Web (</>
// 5. Copy the firebaseConfig object and replace the values below
// 6. Go to Realtime Database and create a database
// 7. Set the database rules to allow read/write (for testing):
//    {
//      "rules": {
//        ".read": true,
//        ".write": true
//      }
//    }

const firebaseConfig = {
    apiKey: "AIzaSyAyOY_It3oq3Q4ferO_zE23sFLJ_bUZB9g",
    authDomain: "mondial2026-a77fc.firebaseapp.com",
    databaseURL: "https://mondial2026-a77fc-default-rtdb.firebaseio.com",
    projectId: "mondial2026-a77fc",
    storageBucket: "mondial2026-a77fc.firebasestorage.app",
    messagingSenderId: "761463864404",
    appId: "1:761463864404:web:658f2211c84800169341c1",
    measurementId: "G-QR7GWLBT0F"
};

// Initialize Firebase
let db   = null;
let auth = null;
let firebaseEnabled = false;

try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        firebase.initializeApp(firebaseConfig);
        db   = firebase.database();
        auth = firebase.auth();
        firebaseEnabled = true;
        console.log('Firebase initialized');
    } else {
        console.log('Firebase not configured');
    }
} catch (error) {
    console.error('Firebase initialization error:', error);
}
