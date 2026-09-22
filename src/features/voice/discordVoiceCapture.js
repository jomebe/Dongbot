import { EndBehaviorType } from "@discordjs/voice";
import { createRequire } from "node:module";
import OpusScript from "opusscript";

const require = createRequire(import.meta.url);

let NativeOpusEncoder = null;
try {
  ({ OpusEncoder: NativeOpusEncoder } = require("@discordjs/opus"));
} catch {
  // Optional native decoder is not available. Fall back to opusscript.
}

const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2;
const MAX_UTTERANCE_MS = 15_000;
const END_SILENCE_MS = 550;
const MIN_PCM_BYTES = SAMPLE_RATE * BYTES_PER_SAMPLE * 0.12;
const MAX_STEREO_PCM_BYTES =
  SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE * (MAX_UTTERANCE_MS / 1000);

function createPacketDecoder() {
  if (NativeOpusEncoder) {
    const decoder = new NativeOpusEncoder(SAMPLE_RATE, CHANNELS);

    return {
      name: "@discordjs/opus",
      decode(packet) {
        return Buffer.from(decoder.decode(packet));
      },
      close() {},
    };
  }

  const decoder = new OpusScript(
    SAMPLE_RATE,
    CHANNELS,
    OpusScript.Application.AUDIO,
  );

  return {
    name: "opusscript",
    decode(packet) {
      return Buffer.from(decoder.decode(packet));
    },
    close() {
      decoder.delete?.();
    },
  };
}

function downmixStereoToMono(stereoPcm) {
  const frameCount = Math.floor(stereoPcm.length / 4);
  const monoPcm = Buffer.allocUnsafe(frameCount * 2);

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const inputOffset = frameIndex * 4;
    const left = stereoPcm.readInt16LE(inputOffset);
    const right = stereoPcm.readInt16LE(inputOffset + 2);
    monoPcm.writeInt16LE(Math.round((left + right) / 2), frameIndex * 2);
  }

  return monoPcm;
}

export function captureUserUtterances({
  connection,
  userId,
  transcribe,
  onTranscript,
  onError = console.error,
  onDebug = null,
}) {
  const receiver = connection.receiver;
  let stopped = false;
  let opusStream = null;
  let packetDecoder = null;
  let utterance = null;
  let silenceTimeout = null;
  let maxUtteranceTimeout = null;
  let processingQueue = Promise.resolve();
  let restartTimeout = null;

  const clearUtteranceTimers = () => {
    if (silenceTimeout) {
      clearTimeout(silenceTimeout);
      silenceTimeout = null;
    }

    if (maxUtteranceTimeout) {
      clearTimeout(maxUtteranceTimeout);
      maxUtteranceTimeout = null;
    }
  };

  const queueTranscription = (snapshot, decoderName) => {
    const stereoPcm = Buffer.concat(snapshot.chunks, snapshot.totalBytes);
    const monoPcm = downmixStereoToMono(stereoPcm);

    onDebug?.({
      decoder: decoderName,
      decodedPackets: snapshot.decodedPackets,
      droppedPackets: snapshot.droppedPackets,
      pcmBytes: monoPcm.length,
    });

    if (monoPcm.length < MIN_PCM_BYTES) {
      if (snapshot.droppedPackets > 0 && snapshot.decodedPackets === 0) {
        onError(
          new Error(
            `Opus utterance contained no decodable packets (dropped=${snapshot.droppedPackets})`,
          ),
        );
      }
      return;
    }

    processingQueue = processingQueue
      .then(async () => {
        if (stopped) {
          return;
        }

        const transcript = await transcribe(monoPcm);

        if (
          (Array.isArray(transcript) && transcript.some(Boolean)) ||
          (!Array.isArray(transcript) && transcript)
        ) {
          await onTranscript(transcript);
        }
      })
      .catch((error) => {
        onError(error);
      });
  };

  const finalizeUtterance = () => {
    if (!utterance) {
      return;
    }

    const snapshot = utterance;
    utterance = null;
    clearUtteranceTimers();
    queueTranscription(snapshot, packetDecoder?.name ?? "unknown");
  };

  const scheduleSilenceFinalize = () => {
    if (silenceTimeout) {
      clearTimeout(silenceTimeout);
    }

    silenceTimeout = setTimeout(finalizeUtterance, END_SILENCE_MS);
  };

  const beginUtterance = () => {
    if (utterance) {
      return;
    }

    utterance = {
      chunks: [],
      totalBytes: 0,
      decodedPackets: 0,
      droppedPackets: 0,
    };

    maxUtteranceTimeout = setTimeout(
      finalizeUtterance,
      MAX_UTTERANCE_MS,
    );
  };

  const handlePacket = (packet) => {
    if (stopped) {
      return;
    }

    beginUtterance();

    try {
      const decoded = packetDecoder.decode(packet);

      if (decoded?.length) {
        utterance.decodedPackets += 1;

        if (utterance.totalBytes < MAX_STEREO_PCM_BYTES) {
          const remainingBytes =
            MAX_STEREO_PCM_BYTES - utterance.totalBytes;
          const nextChunk =
            decoded.length <= remainingBytes
              ? decoded
              : decoded.subarray(0, remainingBytes);
          utterance.chunks.push(nextChunk);
          utterance.totalBytes += nextChunk.length;
        }
      }
    } catch {
      // A damaged Discord Opus packet should not discard the entire phrase.
      utterance.droppedPackets += 1;
    }

    scheduleSilenceFinalize();

    if (utterance?.totalBytes >= MAX_STEREO_PCM_BYTES) {
      finalizeUtterance();
    }
  };

  const startPermanentSubscription = () => {
    if (stopped) {
      return;
    }

    packetDecoder?.close();
    packetDecoder = createPacketDecoder();

    opusStream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.Manual,
      },
    });

    let streamClosed = false;
    const handleStreamClosed = (error = null) => {
      if (streamClosed) {
        return;
      }

      streamClosed = true;
      finalizeUtterance();

      if (error) {
        onError(error);
      }

      if (stopped) {
        return;
      }

      packetDecoder?.close();
      packetDecoder = null;
      opusStream = null;

      if (restartTimeout) {
        clearTimeout(restartTimeout);
      }

      restartTimeout = setTimeout(startPermanentSubscription, 150);
    };

    opusStream.on("data", handlePacket);
    opusStream.once("end", () => handleStreamClosed());
    opusStream.once("close", () => handleStreamClosed());
    opusStream.once("error", (error) => handleStreamClosed(error));
  };

  startPermanentSubscription();

  return () => {
    stopped = true;
    clearUtteranceTimers();

    if (restartTimeout) {
      clearTimeout(restartTimeout);
      restartTimeout = null;
    }

    opusStream?.removeAllListeners();
    opusStream?.destroy();
    packetDecoder?.close();
    opusStream = null;
    packetDecoder = null;
    utterance = null;
  };
}
