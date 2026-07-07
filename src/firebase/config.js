// Import the functions you need from the SDKs you need
import { getAnalytics } from "firebase/analytics";
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAHVJhpFv4JxeAq6aZsRXbkF8hbPR_0sdM",
  authDomain: "ssfoo-5c133.firebaseapp.com",
  projectId: "ssfoo-5c133",
  storageBucket: "ssfoo-5c133.firebasestorage.app",
  messagingSenderId: "762278151918",
  appId: "1:762278151918:web:6009b038429373c2c9d5ff",
  measurementId: "G-ZJ2HF14HDX",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
