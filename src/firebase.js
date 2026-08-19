// Import required Firebase modules
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  onAuthStateChanged,
  connectAuthEmulator,
  getRedirectResult,
  signOut
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  connectFirestoreEmulator
} from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions"; // Import Functions modules
import { getStorage, connectStorageEmulator } from "firebase/storage"; // Import Storage modules

// Firebase configuration object
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Analytics only works with a real measurementId and a production Firebase
// project. Initializing it in development (e.g. against the emulators) throws,
// so only enable it when a measurementId is configured outside development.
let analytics = null;
if (process.env.NODE_ENV !== 'development' && firebaseConfig.measurementId) {
  analytics = getAnalytics(app);
}
const storage = getStorage(app);
// Initialize Firebase services
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);
const functions = getFunctions(app); // Initialize Functions

// Connect to emulators if running locally
if (process.env.NODE_ENV === 'development') {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080); // Firestore emulator
  connectFunctionsEmulator(functions, 'localhost', 5001); // Functions emulator
  connectStorageEmulator(storage, 'localhost', 9199);
}

// Export all Firebase services needed in the app
export {
  auth,
  db,
  functions, // Export Functions
  storage,
  doc,
  getDoc,
  signOut,
  googleProvider,
  signInWithRedirect,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  onAuthStateChanged,
  getRedirectResult
};
