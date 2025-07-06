// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAeIjjs8XludGZ4uan59fKMwcw_7VdIck0",
  authDomain: "belrose-757fe.firebaseapp.com",
  projectId: "belrose-757fe",
  storageBucket: "belrose-757fe.firebasestorage.app",
  messagingSenderId: "212371132388",
  appId: "1:212371132388:web:b874599c43be724af381f1",
  measurementId: "G-SJTBYGYKB7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;