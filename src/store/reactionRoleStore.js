import { doc, getDoc, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";

import { db, isFirebaseReady } from "../firebase.js";

const REACTION_ROLE_PANEL_COLLECTION = "reactionRolePanels";
const memoryStore = new Map();

function normalizeRoleIds(data = {}) {
  const uniqueRoleIds = new Set();

  if (Array.isArray(data.roleIds)) {
    for (const roleId of data.roleIds) {
      if (typeof roleId === "string" && roleId.trim()) {
        uniqueRoleIds.add(roleId);
      }
    }
  }

  if (typeof data.roleId === "string" && data.roleId.trim()) {
    uniqueRoleIds.add(data.roleId);
  }

  return [...uniqueRoleIds];
}

function normalizePanel(messageId, data = {}) {
  const roleIds = normalizeRoleIds(data);

  return {
    messageId,
    guildId: typeof data.guildId === "string" ? data.guildId : null,
    channelId: typeof data.channelId === "string" ? data.channelId : null,
    roleId: roleIds[0] ?? null,
    roleIds,
    emojiId: typeof data.emojiId === "string" ? data.emojiId : null,
    emojiName: typeof data.emojiName === "string" ? data.emojiName : null,
    createdByUserId:
      typeof data.createdByUserId === "string" ? data.createdByUserId : null,
    createdAtMs:
      typeof data.createdAtMs === "number" && Number.isFinite(data.createdAtMs)
        ? data.createdAtMs
        : Date.now(),
  };
}

export async function createReactionRolePanel(panel) {
  const normalized = normalizePanel(panel.messageId, panel);

  if (!isFirebaseReady) {
    memoryStore.set(normalized.messageId, normalized);
    return normalized;
  }

  await setDoc(
    doc(db, REACTION_ROLE_PANEL_COLLECTION, normalized.messageId),
    {
      ...normalized,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return normalized;
}

export async function getReactionRolePanel(messageId) {
  if (!messageId) {
    return null;
  }

  if (!isFirebaseReady) {
    return memoryStore.get(messageId) ?? null;
  }

  const snapshot = await getDoc(doc(db, REACTION_ROLE_PANEL_COLLECTION, messageId));

  if (!snapshot.exists()) {
    return null;
  }

  return normalizePanel(messageId, snapshot.data());
}

export async function removeReactionRolePanel(messageId) {
  if (!messageId) {
    return;
  }

  if (!isFirebaseReady) {
    memoryStore.delete(messageId);
    return;
  }

  await deleteDoc(doc(db, REACTION_ROLE_PANEL_COLLECTION, messageId));
}
