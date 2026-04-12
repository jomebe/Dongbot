import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { db, isFirebaseReady } from "../firebase.js";

const LOGGING_CONFIG_COLLECTION = "loggingConfigs";
const memoryStore = new Map();

function normalizeConfig(guildId, data = {}) {
  const threshold = Number(data.joinLeaveAlertThreshold);

  return {
    guildId,
    chatLogEnabled: Boolean(data.chatLogEnabled),
    chatLogChannelId: data.chatLogChannelId ?? null,
    joinLeaveLogEnabled: Boolean(data.joinLeaveLogEnabled),
    joinLeaveLogChannelId: data.joinLeaveLogChannelId ?? null,
    joinLeaveAlertThreshold: Number.isFinite(threshold)
      ? Math.max(0, Math.floor(threshold))
      : 0,
    joinLeaveAlertRoleId: data.joinLeaveAlertRoleId ?? null,
  };
}

function getMemoryConfig(guildId) {
  if (!memoryStore.has(guildId)) {
    memoryStore.set(guildId, normalizeConfig(guildId));
  }

  return memoryStore.get(guildId);
}

export async function getLoggingConfig(guildId) {
  if (!isFirebaseReady) {
    return getMemoryConfig(guildId);
  }

  const snapshot = await getDoc(doc(db, LOGGING_CONFIG_COLLECTION, guildId));

  if (!snapshot.exists()) {
    return normalizeConfig(guildId);
  }

  return normalizeConfig(guildId, snapshot.data());
}

export async function updateLoggingConfig(guildId, patch) {
  const current = await getLoggingConfig(guildId);
  const next = normalizeConfig(guildId, {
    ...current,
    ...patch,
  });

  if (!isFirebaseReady) {
    memoryStore.set(guildId, next);
    return next;
  }

  await setDoc(
    doc(db, LOGGING_CONFIG_COLLECTION, guildId),
    {
      ...next,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return next;
}