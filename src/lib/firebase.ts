import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDjS-E3X2FbKqjppvmURO4KvDfKvKcqtlA",
  authDomain: "growup-dec3f.firebaseapp.com",
  databaseURL: "https://growup-dec3f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "growup-dec3f",
  storageBucket: "growup-dec3f.firebasestorage.app",
  messagingSenderId: "600768981851",
  appId: "1:600768981851:web:752542e35d8fc19ce9487e",
  measurementId: "G-XB3TRFMYW3"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
export default app;
