import {
  arrayRemove,
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db, isFirebaseReady } from "../firebase.js";

const memoryStore = new Map();

function normalizeConfig(guildId, data = {}) {
  return {
    guildId,
    enabled: Boolean(data.enabled),
    generatorChannelId: data.generatorChannelId ?? null,
    generatorCategoryId: data.generatorCategoryId ?? null,
    managedChannelIds: Array.isArray(data.managedChannelIds)
      ? data.managedChannelIds
      : [],
  };
}

function getMemoryConfig(guildId) {
  if (!memoryStore.has(guildId)) {
    memoryStore.set(guildId, normalizeConfig(guildId));
  }

  return memoryStore.get(guildId);
}

async function getGuildDocRef(guildId) {
  const guildRef = doc(db, "guildConfigs", guildId);
  const snapshot = await getDoc(guildRef);

  if (!snapshot.exists()) {
    await setDoc(guildRef, {
      enabled: false,
      generatorChannelId: null,
      generatorCategoryId: null,
      managedChannelIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return guildRef;
}

export async function ensureGuildConfig(guildId) {
  if (!isFirebaseReady) {
    return getMemoryConfig(guildId);
  }

  const guildRef = await getGuildDocRef(guildId);
  const snapshot = await getDoc(guildRef);
  return normalizeConfig(guildId, snapshot.data());
}

export async function getGuildConfig(guildId) {
  if (!isFirebaseReady) {
    return getMemoryConfig(guildId);
  }

  const snapshot = await getDoc(doc(db, "guildConfigs", guildId));

  if (!snapshot.exists()) {
    return normalizeConfig(guildId);
  }

  return normalizeConfig(guildId, snapshot.data());
}

export async function enableRoomGenerator(
  guildId,
  generatorChannelId,
  generatorCategoryId,
) {
  if (!isFirebaseReady) {
    const next = {
      ...getMemoryConfig(guildId),
      enabled: true,
      generatorChannelId,
      generatorCategoryId,
    };
    memoryStore.set(guildId, next);
    return next;
  }

  const guildRef = await getGuildDocRef(guildId);
  await updateDoc(guildRef, {
    enabled: true,
    generatorChannelId,
    generatorCategoryId,
    updatedAt: serverTimestamp(),
  });

  const snapshot = await getDoc(guildRef);
  return normalizeConfig(guildId, snapshot.data());
}

export async function disableRoomGenerator(guildId) {
  if (!isFirebaseReady) {
    const current = getMemoryConfig(guildId);
    const next = {
      ...current,
      enabled: false,
    };

    memoryStore.set(guildId, next);
    return next;
  }

  const guildRef = await getGuildDocRef(guildId);
  await updateDoc(guildRef, {
    enabled: false,
    updatedAt: serverTimestamp(),
  });

  const snapshot = await getDoc(guildRef);
  return normalizeConfig(guildId, snapshot.data());
}

export async function addManagedChannel(guildId, channelId) {
  if (!isFirebaseReady) {
    const current = getMemoryConfig(guildId);
    if (!current.managedChannelIds.includes(channelId)) {
      current.managedChannelIds.push(channelId);
    }
    return;
  }

  const guildRef = await getGuildDocRef(guildId);
  await updateDoc(guildRef, {
    managedChannelIds: arrayUnion(channelId),
    updatedAt: serverTimestamp(),
  });
}

export async function removeManagedChannel(guildId, channelId) {
  if (!isFirebaseReady) {
    const current = getMemoryConfig(guildId);
    current.managedChannelIds = current.managedChannelIds.filter(
      (id) => id !== channelId,
    );
    memoryStore.set(guildId, current);
    return;
  }

  const guildRef = await getGuildDocRef(guildId);
  await updateDoc(guildRef, {
    managedChannelIds: arrayRemove(channelId),
    updatedAt: serverTimestamp(),
  });
}