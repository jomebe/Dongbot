const PROFANITY_TERMS = [
  "씨발",
  "시발",
  "ㅅㅂ",
  "병신",
  "ㅂㅅ",
  "ㅄ",
  "개새끼",
  "지랄",
  "ㅈㄹ",
  "좆",
  "존나",
  "fuck",
  "fucking",
  "shit",
  "bitch",
  "asshole",
];

const PROFANITY_EXCLUSION_PHRASES = [
  "시발점",
];

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

const normalizedProfanityTerms = PROFANITY_TERMS
  .map((term) => normalizeForProfanityDetection(term))
  .filter(Boolean);

const normalizedExclusionPhrases = PROFANITY_EXCLUSION_PHRASES
  .map((phrase) => normalizeForProfanityDetection(phrase))
  .filter(Boolean);

const obfuscatedEnglishPatterns = [
  /f[\W_]*u[\W_]*c[\W_]*k+/i,
  /s[\W_]*h[\W_]*i[\W_]*t+/i,
  /b[\W_]*i[\W_]*t[\W_]*c[\W_]*h+/i,
  /a[\W_]*s[\W_]*s[\W_]*h[\W_]*o[\W_]*l[\W_]*e+/i,
];

export function detectProfanity(content, options = {}) {
  const normalizedContent = normalizeForProfanityDetection(content);

  if (!normalizedContent) {
    return null;
  }

  const dynamicTerms = normalizeTermList(options.extraTerms);
  const dynamicExclusionPhrases = normalizeTermList(options.exclusionPhrases);
  const allExclusionPhrases = [
    ...normalizedExclusionPhrases,
    ...dynamicExclusionPhrases,
  ];
  const allProfanityTerms = [...normalizedProfanityTerms, ...dynamicTerms];

  for (const exclusionPhrase of allExclusionPhrases) {
    if (exclusionPhrase && normalizedContent.includes(exclusionPhrase)) {
      return null;
    }
  }

  for (const profanityTerm of allProfanityTerms) {
    if (normalizedContent.includes(profanityTerm)) {
      return profanityTerm;
    }
  }

  if (typeof content === "string") {
    for (const pattern of obfuscatedEnglishPatterns) {
      if (pattern.test(content)) {
        return "obfuscated-en";
      }
    }
  }

  return null;
}

export function containsProfanity(content, options = {}) {
  return Boolean(detectProfanity(content, options));
}
