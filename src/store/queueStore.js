const memoryStore = new Map();

function normalizeParticipants(rawParticipants) {
  if (!Array.isArray(rawParticipants)) {
    return [];
  }

  const uniqueIds = new Set();

  for (const userId of rawParticipants) {
    if (typeof userId === "string" && userId.trim()) {
      uniqueIds.add(userId);
    }
  }

  return [...uniqueIds];
}

function normalizeQueue(queueId, data = {}) {
  return {
    queueId,
    guildId: data.guildId ?? null,
    channelId: data.channelId ?? null,
    messageId: data.messageId ?? null,
    creatorUserId: data.creatorUserId ?? null,
    mentionRoleId: typeof data.mentionRoleId === "string" ? data.mentionRoleId : null,
    title: typeof data.title === "string" ? data.title.trim() : "",
    limit: Number.isInteger(data.limit) ? data.limit : 0,
    timeoutMinutes: Number.isInteger(data.timeoutMinutes) ? data.timeoutMinutes : null,
    expiresAtMs:
      typeof data.expiresAtMs === "number" && Number.isFinite(data.expiresAtMs)
        ? data.expiresAtMs
        : null,
    note: typeof data.note === "string" ? data.note.trim() : "",
    participants: normalizeParticipants(data.participants),
    status: data.status === "closed" ? "closed" : "open",
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

export async function createQueueRecord(queue) {
  const normalized = normalizeQueue(queue.queueId, queue);
  memoryStore.set(normalized.queueId, normalized);
  return normalized;
}

export async function getQueueRecord(queueId) {
  if (!queueId) {
    return null;
  }

  return memoryStore.get(queueId) ?? null;
}

export async function saveQueueRecord(queue) {
  const normalized = normalizeQueue(queue.queueId, queue);
  memoryStore.set(normalized.queueId, normalized);
  return normalized;
}

export async function removeQueueRecord(queueId) {
  if (!queueId) {
    return;
  }

  memoryStore.delete(queueId);
}

export async function getOpenQueueByGuildId(guildId) {
  if (!guildId) {
    return null;
  }

  for (const queue of memoryStore.values()) {
    if (queue.guildId === guildId && queue.status === "open") {
      return queue;
    }
  }

  return null;
}
