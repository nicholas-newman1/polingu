import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyApUI66KSSG7O9X_YpfI1vy7WdRJX7bNns",
  authDomain: "polish-declension.firebaseapp.com",
  projectId: "polish-declension",
  storageBucket: "polish-declension.firebasestorage.app",
  messagingSenderId: "854216965862",
  appId: "1:854216965862:web:5f931eecc636e50f24c527",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
