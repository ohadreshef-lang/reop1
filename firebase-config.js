// Firebase Configuration
// ======================
// To use this app with Firebase:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project (or use an existing one)
// 3. Go to Project Settings > General > Your apps
// 4. Click "Add app" and select Web (</>)
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
    apiKey: "AIzaSyCJkXJh0su5o8ISQEUQru6-LI1iYDymWPk",
    authDomain: "worldcup2026-dd327.firebaseapp.com",
    databaseURL: "https://worldcup2026-dd327-default-rtdb.firebaseio.com",
    projectId: "worldcup2026-dd327",
    storageBucket: "worldcup2026-dd327.firebasestorage.app",
    messagingSenderId: "755135382778",
    appId: "1:755135382778:web:4d4ecad50b371794497543"
};

// Initialize Firebase
let db = null;
let firebaseEnabled = false;

try {
    // Check if Firebase config is properly set
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();

        // Test database connection
        db.ref('.info/connected').on('value', (snapshot) => {
            if (snapshot.val() === true) {
                console.log('Firebase connected successfully');
                firebaseEnabled = true;
            } else {
                console.log('Firebase disconnected');
            }
        });

        // Test write access
        db.ref('connectionTest').set({ timestamp: Date.now() })
            .then(() => {
                console.log('Firebase write test successful');
                firebaseEnabled = true;
            })
            .catch((error) => {
                console.error('Firebase write test failed:', error.message);
                if (error.code === 'PERMISSION_DENIED') {
                    console.error('Database rules are blocking writes. Please set rules to allow read/write.');
                } else if (error.message.includes('404')) {
                    console.error('Database not found. Please create a Realtime Database in Firebase Console.');
                }
            });

        firebaseEnabled = true;
        console.log('Firebase initialized');
    } else {
        console.log('Firebase not configured - using localStorage only');
    }
} catch (error) {
    console.error('Firebase initialization error:', error);
    console.log('Falling back to localStorage');
}
