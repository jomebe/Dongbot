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

export function detectProfanity(content) {
  const normalizedContent = normalizeForProfanityDetection(content);

  if (!normalizedContent) {
    return null;
  }

  for (const exclusionPhrase of normalizedExclusionPhrases) {
    if (exclusionPhrase && normalizedContent.includes(exclusionPhrase)) {
      return null;
    }
  }

  for (const profanityTerm of normalizedProfanityTerms) {
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

export function containsProfanity(content) {
  return Boolean(detectProfanity(content));
}
