import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIRECTORY = path.resolve(process.cwd(), ".data");
const CONFIG_PATH = path.join(DATA_DIRECTORY, "voice-assistant-configs.json");
const TEMP_CONFIG_PATH = `${CONFIG_PATH}.tmp`;
const memoryStore = new Map();
let loaded = false;
let writeQueue = Promise.resolve();

function normalizeConfig(guildId, data = {}) {
  return {
    guildId,
    enabled: data.enabled === true,
    userId: typeof data.userId === "string" && data.userId ? data.userId : null,
  };
}

export async function getVoiceAssistantConfig(guildId) {
  await loadConfigs();
  return memoryStore.get(guildId) ?? normalizeConfig(guildId);
}

export async function updateVoiceAssistantConfig(guildId, patch) {
  const current = await getVoiceAssistantConfig(guildId);
  const next = normalizeConfig(guildId, { ...current, ...patch });
  memoryStore.set(guildId, next);
  writeQueue = writeQueue.then(saveConfigs, saveConfigs);
  await writeQueue;
  return next;
}

async function loadConfigs() {
  if (loaded) {
    return;
  }

  loaded = true;

  try {
    const rawData = await readFile(CONFIG_PATH, "utf8");
    const parsedData = JSON.parse(rawData);

    for (const [guildId, config] of Object.entries(parsedData)) {
      memoryStore.set(guildId, normalizeConfig(guildId, config));
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("음성비서 로컬 설정을 읽지 못해 새 설정으로 시작합니다.", error);
    }
  }
}

async function saveConfigs() {
  await mkdir(DATA_DIRECTORY, { recursive: true });
  const serialized = JSON.stringify(Object.fromEntries(memoryStore), null, 2);
  await writeFile(TEMP_CONFIG_PATH, serialized, "utf8");
  await rename(TEMP_CONFIG_PATH, CONFIG_PATH);
}
