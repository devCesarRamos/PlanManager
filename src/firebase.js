import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyANcAm3XBMBufjssqBAnw46_6Zii1yD3iY',
  authDomain: 'estudio14-cf13f.firebaseapp.com',
  projectId: 'estudio14-cf13f',
  storageBucket: 'estudio14-cf13f.firebasestorage.app',
  messagingSenderId: '481019383290',
  appId: '1:481019383290:web:c844e8dc60f54eae90a843',
  measurementId: 'G-43781C7GJV',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
