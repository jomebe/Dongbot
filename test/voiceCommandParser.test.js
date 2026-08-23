import assert from "node:assert/strict";
import test from "node:test";

import {
  WakeWordSession,
  parseVoiceCommand,
} from "../src/features/voice/voiceCommandParser.js";

test("호출어 뒤의 같은 발화 명령을 추출한다", () => {
  const session = new WakeWordSession();
  assert.deepEqual(session.consume("동봇 인원 5명"), {
    awakened: true,
    commandText: "인원 5명",
  });
});

test("호출어만 말하면 다음 발화를 명령으로 받지 않는다", () => {
  const session = new WakeWordSession();

  assert.deepEqual(session.consume("동봇"), {
    awakened: true,
    commandText: null,
  });
  assert.equal(session.consume("방 이름 게임방으로 바꿔줘"), null);
});

test("호출어 없는 일반 대화를 무시한다", () => {
  const session = new WakeWordSession();
  assert.equal(session.consume("방 인원 5명"), null);
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
  assert.deepEqual(parseVoiceCommand("동보땅 인원 다섯 명으로 바꿔줘"), {
    type: "room-limit",
    userLimit: 5,
  });
});

test("NVIDIA가 붙여 적은 호출어도 인식한다", () => {
  const session = new WakeWordSession();
  assert.deepEqual(session.consume("동보땅 인원 다섯 명으로 바꿔줘"), {
    awakened: true,
    commandText: "인원 다섯 명으로 바꿔줘",
  });
  assert.deepEqual(session.consume("동포당 인원 다섯 명으로 바꿔줘"), {
    awakened: true,
    commandText: "인원 다섯 명으로 바꿔줘",
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
