import assert from "node:assert/strict";
import test from "node:test";

import {
  WakeWordSession,
  parseVoiceCommand,
} from "../src/features/voice/voiceCommandParser.js";

test("호출어 뒤의 같은 발화 명령을 추출한다", () => {
  const session = new WakeWordSession();
  assert.deepEqual(session.consume("헤이 동봇 인원 5명"), {
    awakened: true,
    commandText: "인원 5명",
    waitingForCommand: false,
  });
});

test("헤이 동봇 호출 뒤의 다음 발화를 8초 동안 명령으로 받는다", () => {
  const session = new WakeWordSession({ followUpWindowMs: 8_000 });

  assert.deepEqual(session.consume("헤이 동봇", 1_000), {
    awakened: true,
    commandText: null,
    waitingForCommand: true,
  });
  assert.deepEqual(session.consume("방 이름 게임방으로 바꿔줘", 5_000), {
    awakened: true,
    commandText: "방 이름 게임방으로 바꿔줘",
    waitingForCommand: false,
  });
});

test("호출 뒤 대기 시간이 지나면 일반 대화를 무시한다", () => {
  const session = new WakeWordSession({ followUpWindowMs: 8_000 });
  session.consume("헤이 동봇", 1_000);
  assert.equal(session.consume("방 인원 5명", 10_000), null);
});

test("호출어 없는 일반 대화를 무시한다", () => {
  const session = new WakeWordSession();
  assert.equal(session.consume("방 인원 5명"), null);
});

test("헤이 동봇 계열만 호출어로 인식한다", () => {
  const session = new WakeWordSession();

  for (const phrase of [
    "헤이 동봇",
    "헤이동봇",
    "헤이 동복",
    "헤이 동보",
    "헤이 동보트",
    "hey 동봇",
  ]) {
    assert.equal(session.matchesWakeWord(phrase), true, phrase);
  }

  for (const phrase of ["동봇", "동복", "동보", "동포당", "운동", "자동봇"]) {
    assert.equal(session.matchesWakeWord(phrase), false, phrase);
  }
});

test("호출어를 여러 번 반복해도 명령으로 취급하지 않는다", () => {
  const session = new WakeWordSession();

  assert.deepEqual(session.consume("헤이 동봇 헤이 동봇"), {
    awakened: true,
    commandText: null,
    waitingForCommand: true,
  });
});

test("통화방 이름과 인원 명령을 해석한다", () => {
  assert.deepEqual(parseVoiceCommand("방 이름 게임방으로 바꿔줘"), {
    type: "room-name",
    name: "게임방",
  });
  assert.deepEqual(parseVoiceCommand("통화방 최대 인원을 7명으로 해줘"), {
    type: "room-limit",
    userLimit: 7,
  });
  assert.deepEqual(parseVoiceCommand("수다방 인원 무제한"), {
    type: "room-limit",
    userLimit: 0,
  });
});


test("일반 대화의 이름 언급을 방 이름 변경으로 오인하지 않는다", () => {
  assert.deepEqual(parseVoiceCommand("형 이름 왜 범활이야"), {
    type: "unknown",
  });
  assert.deepEqual(parseVoiceCommand("내 이름 동화야"), {
    type: "unknown",
  });
});

test("TTS, 급식, 시간표 명령을 해석한다", () => {
  assert.deepEqual(parseVoiceCommand("티티에스 켜줘"), {
    type: "tts",
    enabled: true,
  });
  assert.deepEqual(parseVoiceCommand("내일 급식 알려줘"), {
    type: "meal",
    dateInput: "내일",
  });
  assert.deepEqual(parseVoiceCommand("내일 2학년 3반 시간표"), {
    type: "timetable",
    grade: 2,
    classNumber: 3,
    dateInput: "내일",
  });
});
