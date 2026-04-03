import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
console.log('Initializing Firebase with config:', firebaseConfig.projectId);
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export { firebaseConfig };

// Validate Connection to Firestore
async function testConnection() {
  console.log('Testing Firestore connection...');
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firestore connection test complete.');
  } catch (error) {
    console.error('Firestore connection test failed:', error);
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}
testConnection();
