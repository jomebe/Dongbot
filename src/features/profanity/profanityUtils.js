import { readFileSync } from "node:fs";

const PROFANITY_LEVEL_LOW = "low";
const PROFANITY_LEVEL_MEDIUM = "medium";
const PROFANITY_LEVEL_HIGH = "high";
const LOW_REPRESENTATIVE_CSV_URL = new URL(
  "./korean_profanity_representative_low.csv",
  import.meta.url,
);
const MEDIUM_REPRESENTATIVE_CSV_URL = new URL(
  "./korean_profanity_representative_medium.csv",
  import.meta.url,
);
const HIGH_REPRESENTATIVE_CSV_URL = new URL(
  "./korean_profanity_representative_high.csv",
  import.meta.url,
);

function parseCsvRow(rawRow) {
  const columns = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < rawRow.length; index += 1) {
    const char = rawRow[index];

    if (char === '"') {
      const nextChar = rawRow[index + 1];

      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      columns.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  columns.push(current.trim());
  return columns;
}

function parseRepresentativeCsv(csvText, expectedLevel) {
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

    const [level, term] = parseCsvRow(trimmedRow);
    const normalizedLevel = level?.toLowerCase();

    if (normalizedLevel === "level" || !term) {
      continue;
    }

    if (normalizedLevel !== expectedLevel) {
      continue;
    }

    terms.push(term);
  }

  return terms;
}

function loadRepresentativeTermsFromCsv(fileUrl, expectedLevel) {
  try {
    const csvText = readFileSync(fileUrl, "utf8");
    return parseRepresentativeCsv(csvText, expectedLevel);
  } catch (error) {
    console.warn(
      `기본 욕설 CSV(${expectedLevel})를 읽지 못해 빈 목록으로 동작합니다.`,
      error,
    );
    return [];
  }
}

function loadDefaultRepresentativeTermsByLevel() {
  return {
    [PROFANITY_LEVEL_LOW]: loadRepresentativeTermsFromCsv(
      LOW_REPRESENTATIVE_CSV_URL,
      PROFANITY_LEVEL_LOW,
    ),
    [PROFANITY_LEVEL_MEDIUM]: loadRepresentativeTermsFromCsv(
      MEDIUM_REPRESENTATIVE_CSV_URL,
      PROFANITY_LEVEL_MEDIUM,
    ),
    [PROFANITY_LEVEL_HIGH]: loadRepresentativeTermsFromCsv(
      HIGH_REPRESENTATIVE_CSV_URL,
      PROFANITY_LEVEL_HIGH,
    ),
  };
}

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
    return [PROFANITY_LEVEL_LOW];
  }

  if (moderationLevel === PROFANITY_LEVEL_HIGH) {
    return [PROFANITY_LEVEL_HIGH];
  }

  return [PROFANITY_LEVEL_MEDIUM];
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

const normalizedDefaultTermsByLevel = normalizeTermsByLevel(
  loadDefaultRepresentativeTermsByLevel(),
);

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
