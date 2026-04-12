import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { db, isFirebaseReady } from "../firebase.js";

const PROFANITY_CONFIG_COLLECTION = "profanityConfigs";
const memoryStore = new Map();
const PROFANITY_LEVEL_LOW = "low";
const PROFANITY_LEVEL_MEDIUM = "medium";
const PROFANITY_LEVEL_HIGH = "high";
const VALID_PROFANITY_LEVELS = new Set([
  PROFANITY_LEVEL_LOW,
  PROFANITY_LEVEL_MEDIUM,
  PROFANITY_LEVEL_HIGH,
]);

function normalizeModerationLevel(rawLevel) {
  if (typeof rawLevel !== "string") {
    return PROFANITY_LEVEL_MEDIUM;
  }

  const normalized = rawLevel.trim().toLowerCase();

  if (!VALID_PROFANITY_LEVELS.has(normalized)) {
    return PROFANITY_LEVEL_MEDIUM;
  }

  return normalized;
}

function normalizeKeyword(rawKeyword) {
  if (typeof rawKeyword !== "string") {
    return null;
  }

  const normalized = rawKeyword
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}]+/gu, "")
    .trim();

  return normalized || null;
}

function normalizeEnabledChannelIds(rawChannelIds) {
  if (!Array.isArray(rawChannelIds)) {
    return [];
  }

  const uniqueChannelIds = new Set();

  for (const channelId of rawChannelIds) {
    if (typeof channelId === "string" && channelId.trim()) {
      uniqueChannelIds.add(channelId);
    }
  }

  return [...uniqueChannelIds];
}

function normalizeKeywordList(rawKeywords) {
  if (!Array.isArray(rawKeywords)) {
    return [];
  }

  const uniqueKeywords = new Set();

  for (const rawKeyword of rawKeywords) {
    const normalized = normalizeKeyword(rawKeyword);

    if (normalized) {
      uniqueKeywords.add(normalized);
    }
  }

  return [...uniqueKeywords];
}

function normalizeConfig(guildId, data = {}) {
  const legacyBlockedTerms = normalizeKeywordList(data.customBlockedTerms);
  const mediumTermsSource =
    data.customMediumTerms ??
    (legacyBlockedTerms.length > 0 ? legacyBlockedTerms : undefined);

  return {
    guildId,
    enabledChannelIds: normalizeEnabledChannelIds(data.enabledChannelIds),
    moderationLevel: normalizeModerationLevel(data.moderationLevel),
    customLowTerms: normalizeKeywordList(data.customLowTerms),
    customMediumTerms: normalizeKeywordList(mediumTermsSource),
    customHighTerms: normalizeKeywordList(data.customHighTerms),
    customAllowedTerms: normalizeKeywordList(data.customAllowedTerms),
  };
}

function getMemoryConfig(guildId) {
  if (!memoryStore.has(guildId)) {
    memoryStore.set(guildId, normalizeConfig(guildId));
  }

  return memoryStore.get(guildId);
}

export async function getProfanityConfig(guildId) {
  if (!isFirebaseReady) {
    return getMemoryConfig(guildId);
  }

  const snapshot = await getDoc(doc(db, PROFANITY_CONFIG_COLLECTION, guildId));

  if (!snapshot.exists()) {
    return normalizeConfig(guildId);
  }

  return normalizeConfig(guildId, snapshot.data());
}

export async function updateProfanityConfig(guildId, patch) {
  const current = await getProfanityConfig(guildId);
  const next = normalizeConfig(guildId, {
    ...current,
    ...patch,
  });

  if (!isFirebaseReady) {
    memoryStore.set(guildId, next);
    return next;
  }

  await setDoc(
    doc(db, PROFANITY_CONFIG_COLLECTION, guildId),
    {
      ...next,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return next;
}

export async function setProfanityChannelEnabled(guildId, channelId, enabled) {
  if (!channelId) {
    return getProfanityConfig(guildId);
  }

  const current = await getProfanityConfig(guildId);
  const enabledChannelIds = new Set(current.enabledChannelIds);

  if (enabled) {
    enabledChannelIds.add(channelId);
  } else {
    enabledChannelIds.delete(channelId);
  }

  return updateProfanityConfig(guildId, {
    enabledChannelIds: [...enabledChannelIds],
  });
}

export async function isProfanityChannelEnabled(guildId, channelId) {
  if (!guildId || !channelId) {
    return false;
  }

  const config = await getProfanityConfig(guildId);
  return config.enabledChannelIds.includes(channelId);
}
