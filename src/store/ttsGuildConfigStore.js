import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { db, isFirebaseReady } from "../firebase.js";

export const TTS_GUILD_INPUT_MODE_CHANNEL = "channel";
export const TTS_GUILD_INPUT_MODE_GUILD = "guild";

const TTS_GUILD_CONFIG_COLLECTION = "ttsGuildConfigs";
const memoryStore = new Map();

function normalizeConfig(guildId, data = {}) {
  const inputMode =
    data.inputMode === TTS_GUILD_INPUT_MODE_CHANNEL ||
    data.inputMode === TTS_GUILD_INPUT_MODE_GUILD
      ? data.inputMode
      : null;

  return {
    guildId,
    inputMode,
    textChannelId: data.textChannelId ?? null,
  };
}

function getMemoryConfig(guildId) {
  if (!memoryStore.has(guildId)) {
    memoryStore.set(guildId, normalizeConfig(guildId));
  }

  return memoryStore.get(guildId);
}

export async function getTtsGuildConfig(guildId) {
  if (!isFirebaseReady) {
    return getMemoryConfig(guildId);
  }

  const snapshot = await getDoc(doc(db, TTS_GUILD_CONFIG_COLLECTION, guildId));

  if (!snapshot.exists()) {
    return normalizeConfig(guildId);
  }

  return normalizeConfig(guildId, snapshot.data());
}

export async function updateTtsGuildConfig(guildId, patch) {
  const current = await getTtsGuildConfig(guildId);
  const next = normalizeConfig(guildId, {
    ...current,
    ...patch,
  });

  if (!isFirebaseReady) {
    memoryStore.set(guildId, next);
    return next;
  }

  await setDoc(
    doc(db, TTS_GUILD_CONFIG_COLLECTION, guildId),
    {
      ...next,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return next;
}
