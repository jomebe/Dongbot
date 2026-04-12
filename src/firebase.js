import { getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

import { firebaseConfig } from "./config.js";

const app = getApps()[0] ?? initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("Firebase 연결 완료");

export { db };
export const isFirebaseReady = true;