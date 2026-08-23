const POLITE_ENDING_PATTERN =
  /\s*(?:으로|로)?\s*(?:바꿔|바꿔줘|변경|변경해|변경해줘|해|해줘|해주세요)$/u;
const KOREAN_NUMBER_MAP = new Map([
  ["한", 1],
  ["두", 2],
  ["세", 3],
  ["네", 4],
  ["다섯", 5],
  ["여섯", 6],
  ["일곱", 7],
  ["여덟", 8],
  ["아홉", 9],
  ["열", 10],
]);

function normalizeTranscript(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[,.!?~]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function getDateInput(text) {
  if (text.includes("내일")) {
    return "내일";
  }

  if (text.includes("어제")) {
    return "어제";
  }

  return "오늘";
}

export function parseVoiceCommand(rawTranscript) {
  const text = normalizeTranscript(rawTranscript);

  if (!text) {
    return { type: "unknown" };
  }

  if (/^(?:나가|퇴장|음성방에서 나가)(?:줘|주세요)?$/u.test(text)) {
    return { type: "leave" };
  }

  if (
    text.includes("도움말") ||
    text === "명령어" ||
    text.includes("뭐 할 수") ||
    text.includes("무엇을 할 수")
  ) {
    return { type: "help" };
  }

  const ttsMatch = text.match(/(?:tts|티티에스)\s*(켜|꺼|끄)/u);
  if (ttsMatch) {
    return { type: "tts", enabled: ttsMatch[1] === "켜" };
  }

  const limitMatch = text.match(
    /(?:(?:통화방|수다방|방)\s*)?(?:최대\s*)?인원(?:수)?(?:를|을)?\s*(무제한|\d{1,2}|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)/u,
  );
  if (limitMatch) {
    const rawLimit = limitMatch[1];
    return {
      type: "room-limit",
      userLimit:
        rawLimit === "무제한"
          ? 0
          : KOREAN_NUMBER_MAP.get(rawLimit) ?? Number(rawLimit),
    };
  }

  const renameMatch = text.match(
    /(?:(?:통화방|수다방|방)\s*)?이름(?:을|를)?\s+(.+)/u,
  );
  if (renameMatch) {
    const name = renameMatch[1].replace(POLITE_ENDING_PATTERN, "").trim();

    if (name) {
      return { type: "room-name", name };
    }
  }

  if (text.includes("급식")) {
    return { type: "meal", dateInput: getDateInput(text) };
  }

  if (text.includes("시간표")) {
    const gradeClassMatch = text.match(/(\d{1,2})\s*학년\s*(\d{1,2})\s*반/u);

    if (gradeClassMatch) {
      return {
        type: "timetable",
        grade: Number(gradeClassMatch[1]),
        classNumber: Number(gradeClassMatch[2]),
        dateInput: getDateInput(text),
      };
    }
  }

  return { type: "unknown" };
}

function buildWakePattern(wakeWord) {
  if (wakeWord.replace(/\s+/gu, "") === "동봇") {
    return /동\s*(?:봇|보(?:트|땅|탄|탕)?|포(?:당|탕)?|본|봄)(?:아|이)?/u;
  }

  const escaped = wakeWord
    .split("")
    .map((character) => character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s*");

  return new RegExp(`${escaped}(?:아|이)?`, "u");
}

export class WakeWordSession {
  constructor({ wakeWord = "동봇" } = {}) {
    this.wakePattern = buildWakePattern(wakeWord);
  }

  consume(rawTranscript) {
    const transcript = normalizeTranscript(rawTranscript);
    const wakeMatch = transcript.match(this.wakePattern);

    if (wakeMatch) {
      const commandText = transcript
        .slice((wakeMatch.index ?? 0) + wakeMatch[0].length)
        .replace(/^\s*(?:야|아|이|,)?\s*/u, "")
        .trim();

      return {
        awakened: true,
        commandText: commandText || null,
      };
    }

    return null;
  }
}
