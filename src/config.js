import dotenv from "dotenv";

dotenv.config();

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`환경 변수 ${name} 이(가) 필요합니다.`);
  }

  return value;
}

export const discordToken = getRequiredEnv("DISCORD_TOKEN");

export const roomGeneratorChannelName =
  process.env.BOT_ROOM_GENERATOR_CHANNEL_NAME ?? "방 생성";

export const roomPrefix = process.env.BOT_ROOM_PREFIX ?? "음성 수다방";
export const neisApiKey =
  process.env.NEIS_API_KEY ?? "d1c3d45db6004d0199fc445ba2510657";

const firebaseApiKey = getRequiredEnv("FIREBASE_API_KEY");
const firebaseAuthDomain = getRequiredEnv("FIREBASE_AUTH_DOMAIN");
const firebaseProjectId = getRequiredEnv("FIREBASE_PROJECT_ID");
const firebaseStorageBucket = getRequiredEnv("FIREBASE_STORAGE_BUCKET");
const firebaseMessagingSenderId = getRequiredEnv("FIREBASE_MESSAGING_SENDER_ID");
const firebaseAppId = getRequiredEnv("FIREBASE_APP_ID");

export const firebaseConfig = {
  apiKey: firebaseApiKey,
  authDomain: firebaseAuthDomain,
  projectId: firebaseProjectId,
  storageBucket: firebaseStorageBucket,
  messagingSenderId: firebaseMessagingSenderId,
  appId: firebaseAppId,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};
