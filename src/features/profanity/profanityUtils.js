import { readFileSync } from "node:fs";

const PROFANITY_LEVEL_LOW = "low";
const PROFANITY_LEVEL_MEDIUM = "medium";
const PROFANITY_LEVEL_HIGH = "high";
const SLANG_CSV_URL = new URL("./slang.csv", import.meta.url);

function parseSlangCsv(csvText) {
  if (typeof csvText !== "string" || !csvText.trim()) {
    return [];
  }

  const rows = csvText.replace(/^\uFEFF/, "").split(/\r?\n/);
  const terms = [];

  for (const rawRow of rows) {
    const trimmedRow = rawRow.trim();

    if (!trimmedRow) {
      continue;
    }

    const rowWithoutTrailingComma = trimmedRow.endsWith(",")
      ? trimmedRow.slice(0, -1)
      : trimmedRow;

    const unquotedRow = rowWithoutTrailingComma
      .replace(/^"/, "")
      .replace(/"$/, "")
      .trim();

    if (!unquotedRow || unquotedRow.toLowerCase() === "slang") {
      continue;
    }

    terms.push(unquotedRow);
  }

  return terms;
}

function loadDefaultSlangTerms() {
  try {
    const csvText = readFileSync(SLANG_CSV_URL, "utf8");
    return parseSlangCsv(csvText);
  } catch (error) {
    console.warn("기본 욕설 CSV를 읽지 못해 빈 목록으로 동작합니다.", error);
    return [];
  }
}

const defaultSlangTerms = loadDefaultSlangTerms();

function normalizeForProfanityDetection(content) {
  if (typeof content !== "string") {
    return "";
  }

  return content
    .toLowerCase()
    .normalize("NFKC")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/<a?:\w+:\d+>/g, " ")
    .replace(/<[@#&]!?\d+>/g, " ")
    .replace(/[0-9]/g, "")
    .replace(/[^\p{L}]+/gu, "");
}

function normalizeTermList(rawTerms) {
  if (!Array.isArray(rawTerms)) {
    return [];
  }

  const uniqueTerms = new Set();

  for (const rawTerm of rawTerms) {
    const normalized = normalizeForProfanityDetection(rawTerm);

    if (normalized) {
      uniqueTerms.add(normalized);
    }
  }

  return [...uniqueTerms];
}

function normalizeModerationLevel(rawLevel) {
  if (typeof rawLevel !== "string") {
    return PROFANITY_LEVEL_MEDIUM;
  }

  const normalized = rawLevel.trim().toLowerCase();

  if (
    normalized !== PROFANITY_LEVEL_LOW &&
    normalized !== PROFANITY_LEVEL_MEDIUM &&
    normalized !== PROFANITY_LEVEL_HIGH
  ) {
    return PROFANITY_LEVEL_MEDIUM;
  }

  return normalized;
}

function resolveActiveDetectionLevels(moderationLevel) {
  if (moderationLevel === PROFANITY_LEVEL_LOW) {
    return [PROFANITY_LEVEL_HIGH];
  }

  if (moderationLevel === PROFANITY_LEVEL_HIGH) {
    return [
      PROFANITY_LEVEL_LOW,
      PROFANITY_LEVEL_MEDIUM,
      PROFANITY_LEVEL_HIGH,
    ];
  }

  return [PROFANITY_LEVEL_MEDIUM, PROFANITY_LEVEL_HIGH];
}

function normalizeTermsByLevel(rawTermsByLevel = {}) {
  return {
    [PROFANITY_LEVEL_LOW]: normalizeTermList(rawTermsByLevel[PROFANITY_LEVEL_LOW]),
    [PROFANITY_LEVEL_MEDIUM]: normalizeTermList(
      rawTermsByLevel[PROFANITY_LEVEL_MEDIUM],
    ),
    [PROFANITY_LEVEL_HIGH]: normalizeTermList(
      rawTermsByLevel[PROFANITY_LEVEL_HIGH],
    ),
  };
}

function splitCsvTermsByLevel(normalizedTerms) {
  const total = normalizedTerms.length;

  if (total === 0) {
    return {
      [PROFANITY_LEVEL_LOW]: [],
      [PROFANITY_LEVEL_MEDIUM]: [],
      [PROFANITY_LEVEL_HIGH]: [],
    };
  }

  const highCutoff = Math.ceil(total / 3);
  const mediumCutoff = Math.ceil((total * 2) / 3);

  return {
    [PROFANITY_LEVEL_HIGH]: normalizedTerms.slice(0, highCutoff),
    [PROFANITY_LEVEL_MEDIUM]: normalizedTerms.slice(highCutoff, mediumCutoff),
    [PROFANITY_LEVEL_LOW]: normalizedTerms.slice(mediumCutoff),
  };
}

const normalizedCsvTerms = normalizeTermList(defaultSlangTerms);
const normalizedDefaultTermsByLevel = splitCsvTermsByLevel(normalizedCsvTerms);

export function getDefaultProfanityTermsByLevel() {
  return {
    [PROFANITY_LEVEL_LOW]: [
      ...normalizedDefaultTermsByLevel[PROFANITY_LEVEL_LOW],
    ],
    [PROFANITY_LEVEL_MEDIUM]: [
      ...normalizedDefaultTermsByLevel[PROFANITY_LEVEL_MEDIUM],
    ],
    [PROFANITY_LEVEL_HIGH]: [
      ...normalizedDefaultTermsByLevel[PROFANITY_LEVEL_HIGH],
    ],
  };
}

export function detectProfanity(content, options = {}) {
  const normalizedContent = normalizeForProfanityDetection(content);

  if (!normalizedContent) {
    return null;
  }

  const moderationLevel = normalizeModerationLevel(options.moderationLevel);
  const activeLevels = resolveActiveDetectionLevels(moderationLevel);
  const dynamicTermsByLevel = normalizeTermsByLevel(options.extraTermsByLevel);
  const allExclusionPhrases = normalizeTermList(options.exclusionPhrases);

  for (const exclusionPhrase of allExclusionPhrases) {
    if (exclusionPhrase && normalizedContent.includes(exclusionPhrase)) {
      return null;
    }
  }

  for (const level of activeLevels) {
    const severityTerms = [
      ...normalizedDefaultTermsByLevel[level],
      ...dynamicTermsByLevel[level],
    ];

    for (const profanityTerm of severityTerms) {
      if (normalizedContent.includes(profanityTerm)) {
        return profanityTerm;
      }
    }
  }

  return null;
}

export function containsProfanity(content, options = {}) {
  return Boolean(detectProfanity(content, options));
}
