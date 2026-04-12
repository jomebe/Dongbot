import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { db, isFirebaseReady } from "../firebase.js";

const POLL_COLLECTION = "polls";
const memoryStore = new Map();

function normalizeVotesByUser(rawValue) {
  if (!rawValue || typeof rawValue !== "object") {
    return {};
  }

  const normalized = {};

  for (const [userId, optionIndex] of Object.entries(rawValue)) {
    const parsedIndex = Number(optionIndex);

    if (!Number.isInteger(parsedIndex) || parsedIndex < 0) {
      continue;
    }

    normalized[userId] = parsedIndex;
  }

  return normalized;
}

function normalizeOptions(rawOptions) {
  if (!Array.isArray(rawOptions)) {
    return [];
  }

  return rawOptions
    .map((option) => (typeof option === "string" ? option.trim() : ""))
    .filter(Boolean)
    .slice(0, 10);
}

function normalizePoll(pollId, data = {}) {
  return {
    pollId,
    guildId: data.guildId ?? null,
    channelId: data.channelId ?? null,
    messageId: data.messageId ?? null,
    creatorUserId: data.creatorUserId ?? null,
    topic: typeof data.topic === "string" ? data.topic.trim() : "",
    options: normalizeOptions(data.options),
    isAnonymous: Boolean(data.isAnonymous),
    status: data.status === "closed" ? "closed" : "open",
    votesByUser: normalizeVotesByUser(data.votesByUser),
    closedByUserId: data.closedByUserId ?? null,
    createdAtMs:
      typeof data.createdAtMs === "number" && Number.isFinite(data.createdAtMs)
        ? data.createdAtMs
        : Date.now(),
    closedAtMs:
      typeof data.closedAtMs === "number" && Number.isFinite(data.closedAtMs)
        ? data.closedAtMs
        : null,
  };
}

export async function createPollRecord(poll) {
  const normalized = normalizePoll(poll.pollId, poll);

  if (!isFirebaseReady) {
    memoryStore.set(normalized.pollId, normalized);
    return normalized;
  }

  await setDoc(
    doc(db, POLL_COLLECTION, normalized.pollId),
    {
      ...normalized,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return normalized;
}

export async function getPollRecord(pollId) {
  if (!pollId) {
    return null;
  }

  if (!isFirebaseReady) {
    return memoryStore.get(pollId) ?? null;
  }

  const snapshot = await getDoc(doc(db, POLL_COLLECTION, pollId));

  if (!snapshot.exists()) {
    return null;
  }

  return normalizePoll(pollId, snapshot.data());
}

export async function savePollRecord(poll) {
  const normalized = normalizePoll(poll.pollId, poll);

  if (!isFirebaseReady) {
    memoryStore.set(normalized.pollId, normalized);
    return normalized;
  }

  await setDoc(
    doc(db, POLL_COLLECTION, normalized.pollId),
    {
      ...normalized,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return normalized;
}
