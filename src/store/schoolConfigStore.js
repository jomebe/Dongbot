import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { db, isFirebaseReady } from "../firebase.js";

const SCHOOL_CONFIG_COLLECTION = "schoolConfigs";
const memoryStore = new Map();

function normalizeText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeConfig(guildId, data = {}) {
  return {
    guildId,
    schoolName: normalizeText(data.schoolName),
    educationOfficeName: normalizeText(data.educationOfficeName),
  };
}

function getMemoryConfig(guildId) {
  if (!memoryStore.has(guildId)) {
    memoryStore.set(guildId, normalizeConfig(guildId));
  }

  return memoryStore.get(guildId);
}

export async function getSchoolConfig(guildId) {
  if (!isFirebaseReady) {
    return getMemoryConfig(guildId);
  }

  const snapshot = await getDoc(doc(db, SCHOOL_CONFIG_COLLECTION, guildId));

  if (!snapshot.exists()) {
    return normalizeConfig(guildId);
  }

  return normalizeConfig(guildId, snapshot.data());
}

export async function updateSchoolConfig(guildId, patch) {
  const current = await getSchoolConfig(guildId);
  const next = normalizeConfig(guildId, {
    ...current,
    ...patch,
  });

  if (!isFirebaseReady) {
    memoryStore.set(guildId, next);
    return next;
  }

  await setDoc(
    doc(db, SCHOOL_CONFIG_COLLECTION, guildId),
    {
      ...next,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return next;
}
