const NEIS_API_BASE_URL = "https://open.neis.go.kr/hub";
const SCHOOL_SEARCH_CACHE = new Map();

function getRows(payload, datasetName) {
  const dataset = payload?.[datasetName];

  if (!Array.isArray(dataset) || dataset.length < 2) {
    return [];
  }

  return Array.isArray(dataset[1]?.row) ? dataset[1].row : [];
}

function buildUrl(pathname, query) {
  const url = new URL(pathname, NEIS_API_BASE_URL);
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    params.set(key, String(value));
  }

  url.search = params.toString();
  return url;
}

async function fetchNeisJson(pathname, query) {
  const url = buildUrl(pathname, query);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`나이스 API 요청 실패 (${response.status})`);
  }

  return response.json();
}

function normalizeSchoolName(name) {
  if (typeof name !== "string") {
    return "";
  }

  return name.replace(/\s+/g, "").toLowerCase();
}

function findBestSchoolMatch(rows, schoolName, educationOfficeName) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  if (rows.length === 1) {
    return rows[0];
  }

  const normalizedTargetName = normalizeSchoolName(schoolName);
  const normalizedOfficeName =
    typeof educationOfficeName === "string"
      ? educationOfficeName.trim().toLowerCase()
      : "";

  const exactNameMatches = rows.filter((row) => {
    const rowName = normalizeSchoolName(row?.SCHUL_NM);
    return rowName === normalizedTargetName;
  });

  if (exactNameMatches.length === 1) {
    return exactNameMatches[0];
  }

  if (normalizedOfficeName) {
    const officeMatches = exactNameMatches.filter((row) =>
      String(row?.ATPT_OFCDC_SC_NM ?? "")
        .toLowerCase()
        .includes(normalizedOfficeName),
    );

    if (officeMatches.length === 1) {
      return officeMatches[0];
    }
  }

  return exactNameMatches[0] ?? rows[0];
}

export async function resolveSchoolInfo({
  apiKey,
  schoolName,
  educationOfficeName,
}) {
  if (!apiKey) {
    throw new Error("나이스 API 키가 설정되지 않았어요.");
  }

  const trimmedSchoolName = typeof schoolName === "string" ? schoolName.trim() : "";

  if (!trimmedSchoolName) {
    throw new Error("학교 이름을 입력해 주세요.");
  }

  const cacheKey = `${trimmedSchoolName}::${educationOfficeName ?? ""}`;

  if (SCHOOL_SEARCH_CACHE.has(cacheKey)) {
    return SCHOOL_SEARCH_CACHE.get(cacheKey);
  }

  const payload = await fetchNeisJson("schoolInfo", {
    KEY: apiKey,
    Type: "json",
    pIndex: 1,
    pSize: 100,
    SCHUL_NM: trimmedSchoolName,
  });

  const rows = getRows(payload, "schoolInfo");

  if (rows.length === 0) {
    throw new Error("학교를 찾지 못했어요. 학교명을 다시 확인해 주세요.");
  }

  const school = findBestSchoolMatch(rows, trimmedSchoolName, educationOfficeName);

  if (!school) {
    throw new Error("학교 정보를 찾지 못했어요.");
  }

  SCHOOL_SEARCH_CACHE.set(cacheKey, school);
  if (SCHOOL_SEARCH_CACHE.size > 200) {
    const firstKey = SCHOOL_SEARCH_CACHE.keys().next().value;

    if (firstKey) {
      SCHOOL_SEARCH_CACHE.delete(firstKey);
    }
  }

  return school;
}

export async function getMealInfoBySchool({ apiKey, school, ymd }) {
  if (!school?.ATPT_OFCDC_SC_CODE || !school?.SD_SCHUL_CODE) {
    throw new Error("학교 코드가 올바르지 않아요.");
  }

  const payload = await fetchNeisJson("mealServiceDietInfo", {
    KEY: apiKey,
    Type: "json",
    pIndex: 1,
    pSize: 5,
    ATPT_OFCDC_SC_CODE: school.ATPT_OFCDC_SC_CODE,
    SD_SCHUL_CODE: school.SD_SCHUL_CODE,
    MLSV_YMD: ymd,
  });

  const rows = getRows(payload, "mealServiceDietInfo");
  return rows[0] ?? null;
}

export async function getTimetableBySchool({
  apiKey,
  school,
  ymd,
  grade,
  classNm,
}) {
  if (!school?.ATPT_OFCDC_SC_CODE || !school?.SD_SCHUL_CODE) {
    throw new Error("학교 코드가 올바르지 않아요.");
  }

  const endpointCandidates = ["hisTimetable", "misTimetable", "elsTimetable"];

  for (const endpoint of endpointCandidates) {
    const payload = await fetchNeisJson(endpoint, {
      KEY: apiKey,
      Type: "json",
      pIndex: 1,
      pSize: 100,
      ATPT_OFCDC_SC_CODE: school.ATPT_OFCDC_SC_CODE,
      SD_SCHUL_CODE: school.SD_SCHUL_CODE,
      ALL_TI_YMD: ymd,
      GRADE: grade,
      CLASS_NM: classNm,
    });

    const rows = getRows(payload, endpoint);

    if (rows.length > 0) {
      return rows;
    }
  }

  return [];
}

function parseFormatterParts(date, localeOptions) {
  const formatter = new Intl.DateTimeFormat("ko-KR", localeOptions);
  const parts = formatter.formatToParts(date);
  const valueByType = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      valueByType[part.type] = part.value;
    }
  }

  return valueByType;
}

function getCurrentSeoulDate() {
  const now = new Date();
  const dateString = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return new Date(`${dateString}T00:00:00+09:00`);
}

function isValidYmd(ymd) {
  if (!/^\d{8}$/.test(ymd)) {
    return false;
  }

  const year = Number.parseInt(ymd.slice(0, 4), 10);
  const month = Number.parseInt(ymd.slice(4, 6), 10);
  const day = Number.parseInt(ymd.slice(6, 8), 10);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function formatYmdFromDate(date) {
  const parts = parseFormatterParts(date, {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return `${parts.year}${parts.month}${parts.day}`;
}

export function parseNeisDateInput(rawDateInput) {
  const today = getCurrentSeoulDate();

  if (!rawDateInput || typeof rawDateInput !== "string") {
    const ymd = formatYmdFromDate(today);

    return {
      ymd,
      label: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`,
    };
  }

  const trimmed = rawDateInput.trim().toLowerCase();

  if (!trimmed) {
    const ymd = formatYmdFromDate(today);

    return {
      ymd,
      label: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`,
    };
  }

  if (trimmed === "오늘" || trimmed === "today") {
    const ymd = formatYmdFromDate(today);

    return {
      ymd,
      label: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`,
    };
  }

  if (trimmed === "내일" || trimmed === "tomorrow") {
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const ymd = formatYmdFromDate(tomorrow);

    return {
      ymd,
      label: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`,
    };
  }

  const digits = trimmed.replace(/[^\d]/g, "");

  if (!isValidYmd(digits)) {
    throw new Error("날짜는 YYYYMMDD 또는 YYYY-MM-DD 형식으로 입력해 주세요.");
  }

  return {
    ymd: digits,
    label: `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`,
  };
}

export function formatMealText(rawMealText) {
  if (typeof rawMealText !== "string") {
    return "정보 없음";
  }

  return rawMealText
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\(\d+(?:\.\d+)*\)/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatTimetableRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return "시간표 정보가 없어요.";
  }

  const sortedRows = [...rows].sort((a, b) => {
    const first = Number.parseInt(String(a?.PERIO ?? "0"), 10);
    const second = Number.parseInt(String(b?.PERIO ?? "0"), 10);
    return first - second;
  });

  const lines = sortedRows.map((row) => {
    const period = row?.PERIO ?? "?";
    const subject = String(row?.ITRT_CNTNT ?? "").trim() || "(미상)";
    return `${period}교시 - ${subject}`;
  });

  return lines.join("\n");
}
