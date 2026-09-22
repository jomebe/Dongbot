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
  let busy = false;
  let activeOpusStream = null;
  let activePacketDecoder = null;
  let captureTimeout = null;

  const clearCapture = () => {
    if (captureTimeout) {
      clearTimeout(captureTimeout);
      captureTimeout = null;
    }

    activeOpusStream = null;
    activePacketDecoder = null;
  };

  const handleSpeakingStart = (speakingUserId) => {
    if (stopped || busy || speakingUserId !== userId) {
      return;
    }

    busy = true;
    const chunks = [];
    let totalBytes = 0;
    let decodedPackets = 0;
    let droppedPackets = 0;
    let finalized = false;

    const opusStream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: END_SILENCE_MS,
      },
    });
    const packetDecoder = createPacketDecoder();

    activeOpusStream = opusStream;
    activePacketDecoder = packetDecoder;

    const finalize = async () => {
      if (finalized) {
        return;
      }

      finalized = true;

      if (captureTimeout) {
        clearTimeout(captureTimeout);
        captureTimeout = null;
      }

      opusStream.removeAllListeners();
      opusStream.destroy();
      packetDecoder.close();
      clearCapture();

      try {
        const stereoPcm = Buffer.concat(chunks, totalBytes);
        const monoPcm = downmixStereoToMono(stereoPcm);

        onDebug?.({
          decoder: packetDecoder.name,
          decodedPackets,
          droppedPackets,
          pcmBytes: monoPcm.length,
        });

        if (monoPcm.length < MIN_PCM_BYTES) {
          if (droppedPackets > 0 && decodedPackets === 0) {
            onError(
              new Error(
                `Opus utterance contained no decodable packets (dropped=${droppedPackets})`,
              ),
            );
          }
          return;
        }

        const transcript = await transcribe(monoPcm);

        if (
          (Array.isArray(transcript) && transcript.some(Boolean)) ||
          (!Array.isArray(transcript) && transcript)
        ) {
          await onTranscript(transcript);
        }
      } catch (error) {
        onError(error);
      } finally {
        busy = false;
      }
    };

    opusStream.on("data", (packet) => {
      if (totalBytes >= MAX_STEREO_PCM_BYTES) {
        return;
      }

      try {
        const decoded = packetDecoder.decode(packet);

        if (!decoded?.length) {
          return;
        }

        decodedPackets += 1;
        const remainingBytes = MAX_STEREO_PCM_BYTES - totalBytes;
        const nextChunk =
          decoded.length <= remainingBytes
            ? decoded
            : decoded.subarray(0, remainingBytes);
        chunks.push(nextChunk);
        totalBytes += nextChunk.length;
      } catch {
        // Discord can occasionally deliver a corrupt/partial Opus packet.
        // Drop only that packet instead of throwing away the whole utterance.
        droppedPackets += 1;
      }
    });

    opusStream.once("end", () => void finalize());
    opusStream.once("close", () => void finalize());
    opusStream.once("error", (error) => {
      onError(error);
      void finalize();
    });

    captureTimeout = setTimeout(() => void finalize(), MAX_UTTERANCE_MS);
  };

  receiver.speaking.on("start", handleSpeakingStart);

  return () => {
    stopped = true;
    receiver.speaking.off("start", handleSpeakingStart);

    if (captureTimeout) {
      clearTimeout(captureTimeout);
    }

    activeOpusStream?.destroy();
    activePacketDecoder?.close();
  };
}
