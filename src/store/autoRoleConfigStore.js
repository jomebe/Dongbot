import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { db, isFirebaseReady } from "../firebase.js";

const AUTO_ROLE_CONFIG_COLLECTION = "autoRoleConfigs";
const memoryStore = new Map();

function normalizeConfig(guildId, data = {}) {
  return {
    guildId,
    enabled: Boolean(data.enabled),
    joinRoleId: typeof data.joinRoleId === "string" ? data.joinRoleId : null,
  };
}

function getMemoryConfig(guildId) {
  if (!memoryStore.has(guildId)) {
    memoryStore.set(guildId, normalizeConfig(guildId));
  }

  return memoryStore.get(guildId);
}

export async function getAutoRoleConfig(guildId) {
  if (!isFirebaseReady) {
    return getMemoryConfig(guildId);
  }

  const snapshot = await getDoc(doc(db, AUTO_ROLE_CONFIG_COLLECTION, guildId));

  if (!snapshot.exists()) {
    return normalizeConfig(guildId);
  }

  return normalizeConfig(guildId, snapshot.data());
}

export async function updateAutoRoleConfig(guildId, patch) {
  const current = await getAutoRoleConfig(guildId);
  const next = normalizeConfig(guildId, {
    ...current,
    ...patch,
  });

  if (!isFirebaseReady) {
    memoryStore.set(guildId, next);
    return next;
  }

  await setDoc(
    doc(db, AUTO_ROLE_CONFIG_COLLECTION, guildId),
    {
      ...next,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return next;
}
