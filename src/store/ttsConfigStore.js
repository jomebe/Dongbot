import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { db, isFirebaseReady } from "../firebase.js";

export const DEFAULT_TTS_VOICE = "ko-KR-SunHiNeural";
export const TTS_INPUT_MODE_CHANNEL = "channel";
export const TTS_INPUT_MODE_GUILD = "guild";

const memoryStore = new Map();
const TTS_USER_CONFIG_COLLECTION = "ttsUserConfigs";

function toKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function toDocId(guildId, userId) {
  return `${guildId}_${userId}`;
}

function normalizeConfig(guildId, userId, data = {}) {
  const hasValidMode =
    data.ttsInputMode === TTS_INPUT_MODE_CHANNEL ||
    data.ttsInputMode === TTS_INPUT_MODE_GUILD;

  const inferredModeFromLegacyValue = data.ttsTextChannelId
    ? TTS_INPUT_MODE_CHANNEL
    : null;

  return {
    guildId,
    userId,
    enabled: Boolean(data.enabled),
    voiceShortName: data.voiceShortName ?? DEFAULT_TTS_VOICE,
    ttsTextChannelId: data.ttsTextChannelId ?? null,
    ttsInputMode: hasValidMode ? data.ttsInputMode : inferredModeFromLegacyValue,
  };
}

function getMemoryConfig(guildId, userId) {
  const key = toKey(guildId, userId);

  if (!memoryStore.has(key)) {
    memoryStore.set(key, normalizeConfig(guildId, userId));
  }

  return memoryStore.get(key);
}

export async function getUserTtsConfig(guildId, userId) {
  if (!isFirebaseReady) {
    return getMemoryConfig(guildId, userId);
  }

  const docRef = doc(db, TTS_USER_CONFIG_COLLECTION, toDocId(guildId, userId));
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return normalizeConfig(guildId, userId);
  }

  return normalizeConfig(guildId, userId, snapshot.data());
}

export async function setUserTtsEnabled(
  guildId,
  userId,
  enabled,
  ttsTextChannelId,
  ttsInputMode,
) {
  if (!isFirebaseReady) {
    const current = getMemoryConfig(guildId, userId);
    const nextChannelId =
      ttsTextChannelId !== undefined
        ? ttsTextChannelId
        : (current.ttsTextChannelId ?? null);
    const nextInputMode =
      ttsInputMode === TTS_INPUT_MODE_CHANNEL ||
      ttsInputMode === TTS_INPUT_MODE_GUILD
        ? ttsInputMode
        : (current.ttsInputMode ?? null);

    const next = {
      ...current,
      enabled,
      ttsTextChannelId: nextChannelId,
      ttsInputMode: nextInputMode,
    };

    memoryStore.set(toKey(guildId, userId), next);
    return next;
  }

  const current = await getUserTtsConfig(guildId, userId);
  const docRef = doc(db, TTS_USER_CONFIG_COLLECTION, toDocId(guildId, userId));

  await setDoc(
    docRef,
    {
      guildId,
      userId,
      enabled,
      voiceShortName: current.voiceShortName,
      ttsTextChannelId:
        ttsTextChannelId !== undefined
          ? ttsTextChannelId
          : (current.ttsTextChannelId ?? null),
      ttsInputMode:
        ttsInputMode === TTS_INPUT_MODE_CHANNEL ||
        ttsInputMode === TTS_INPUT_MODE_GUILD
          ? ttsInputMode
          : (current.ttsInputMode ?? null),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return {
    ...current,
    enabled,
    ttsTextChannelId:
      ttsTextChannelId !== undefined
        ? ttsTextChannelId
        : (current.ttsTextChannelId ?? null),
    ttsInputMode:
      ttsInputMode === TTS_INPUT_MODE_CHANNEL ||
      ttsInputMode === TTS_INPUT_MODE_GUILD
        ? ttsInputMode
        : (current.ttsInputMode ?? null),
  };
}

export async function setUserTtsVoice(guildId, userId, voiceShortName) {
  if (!isFirebaseReady) {
    const current = getMemoryConfig(guildId, userId);
    const next = {
      ...current,
      voiceShortName,
    };

    memoryStore.set(toKey(guildId, userId), next);
    return next;
  }

  const current = await getUserTtsConfig(guildId, userId);
  const docRef = doc(db, TTS_USER_CONFIG_COLLECTION, toDocId(guildId, userId));

  await setDoc(
    docRef,
    {
      guildId,
      userId,
      enabled: current.enabled,
      voiceShortName,
      ttsTextChannelId: current.ttsTextChannelId,
      ttsInputMode: current.ttsInputMode,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return {
    ...current,
    voiceShortName,
  };
}

export async function hasEnabledTtsUsersInGuild(guildId) {
  if (!isFirebaseReady) {
    for (const config of memoryStore.values()) {
      if (config.guildId === guildId && config.enabled) {
        return true;
      }
    }

    return false;
  }

  const q = query(
    collection(db, TTS_USER_CONFIG_COLLECTION),
    where("guildId", "==", guildId),
  );

  const snapshots = await getDocs(q);

  if (snapshots.empty) {
    return false;
  }

  for (const snapshot of snapshots.docs) {
    if (Boolean(snapshot.data().enabled)) {
      return true;
    }
  }

  return false;
}

export async function getEnabledTtsConfigsInGuild(guildId) {
  if (!isFirebaseReady) {
    const results = [];

    for (const config of memoryStore.values()) {
      if (config.guildId === guildId && config.enabled) {
        results.push(config);
      }
    }

    return results;
  }

  const q = query(
    collection(db, TTS_USER_CONFIG_COLLECTION),
    where("guildId", "==", guildId),
  );

  const snapshots = await getDocs(q);

  if (snapshots.empty) {
    return [];
  }

  const results = [];

  for (const snapshot of snapshots.docs) {
    const normalized = normalizeConfig(
      guildId,
      snapshot.data().userId ?? "",
      snapshot.data(),
    );

    if (normalized.enabled) {
      results.push(normalized);
    }
  }

  return results;
}