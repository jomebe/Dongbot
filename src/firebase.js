import { getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

import { firebaseConfig } from "./config.js";

const app = getApps()[0] ?? initializeApp(firebaseConfig);
const db = getFirestore(app);
const isFirebaseReady = process.env.FIREBASE_ENABLED !== "false";

console.log(
  isFirebaseReady
    ? "Firebase 연결 활성화"
    : "Firebase 비활성화: 메모리 저장소 사용",
);

export { db, isFirebaseReady };
