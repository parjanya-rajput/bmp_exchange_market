import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only on client side
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

if (typeof window !== "undefined") {
  // Only initialize on client side
  try {
    // Check if config is valid
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.error("Firebase configuration is missing. Please check your environment variables.");
      console.error("Required variables:");
      console.error("- NEXT_PUBLIC_FIREBASE_API_KEY");
      console.error("- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
      console.error("- NEXT_PUBLIC_FIREBASE_PROJECT_ID");
      console.error("- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
      console.error("- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
      console.error("- NEXT_PUBLIC_FIREBASE_APP_ID");
      console.error("Create a .env.local file in the root directory with these variables.");
    } else {
      if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
        console.log("Firebase initialized successfully");
      } else {
        app = getApps()[0];
      }
      auth = getAuth(app);
      db = getFirestore(app);

      // Enable offline persistence (optional - helps with offline support)
      enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === "failed-precondition") {
          // Multiple tabs open, persistence can only be enabled in one tab at a time
          console.warn("Firebase persistence failed: Multiple tabs may be open");
        } else if (err.code === "unimplemented") {
          // The current browser does not support all of the features required
          console.warn("Firebase persistence not available in this browser");
        }
      });
    }
  } catch (error) {
    console.error("Error initializing Firebase:", error);
  }
}

// Export with type assertions - components should check if these are defined
export { auth, db };
export default app;

