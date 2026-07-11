import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDRrzw3kbk-s7lG8PUgWtzzOF2GUGEMvCc",
  authDomain: "schedule-reminder-f705a.firebaseapp.com",
  projectId: "schedule-reminder-f705a",
  storageBucket: "schedule-reminder-f705a.firebasestorage.app",
  messagingSenderId: "441299592379",
  appId: "1:441299592379:web:ae1374d74e00af7ab2f59e"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);