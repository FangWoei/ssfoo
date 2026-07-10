// src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Exported so outlets.js can spin up a secondary app for account creation
export const firebaseConfig = {
  apiKey: "AIzaSyAHVJhpFv4JxeAq6aZsRXbkF8hbPR_0sdM",
  authDomain: "ssfoo-5c133.firebaseapp.com",
  projectId: "ssfoo-5c133",
  storageBucket: "ssfoo-5c133.firebasestorage.app",
  messagingSenderId: "762278151918",
  appId: "1:762278151918:web:6009b038429373c2c9d5ff",
  measurementId: "G-ZJ2HF14HDX",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
