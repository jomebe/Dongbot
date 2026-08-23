import { EndBehaviorType } from "@discordjs/voice";
import prism from "prism-media";

const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2;
const MAX_UTTERANCE_MS = 15_000;
const MIN_PCM_BYTES = SAMPLE_RATE * BYTES_PER_SAMPLE * 0.2;
const MAX_STEREO_PCM_BYTES =
  SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE * (MAX_UTTERANCE_MS / 1000);

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
}) {
  const receiver = connection.receiver;
  let stopped = false;
  let busy = false;
  let activeOpusStream = null;
  let activeDecoder = null;
  let captureTimeout = null;

  const clearCapture = () => {
    if (captureTimeout) {
      clearTimeout(captureTimeout);
      captureTimeout = null;
    }

    activeOpusStream = null;
    activeDecoder = null;
  };

  const handleSpeakingStart = (speakingUserId) => {
    if (stopped || busy || speakingUserId !== userId) {
      return;
    }

    busy = true;
    const chunks = [];
    let totalBytes = 0;
    let finalized = false;

    const opusStream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 900,
      },
    });
    const decoder = new prism.opus.Decoder({
      rate: SAMPLE_RATE,
      channels: CHANNELS,
      frameSize: 960,
    });

    activeOpusStream = opusStream;
    activeDecoder = decoder;

    const finalize = async () => {
      if (finalized) {
        return;
      }

      finalized = true;
      clearCapture();
      opusStream.destroy();
      decoder.destroy();

      try {
        const stereoPcm = Buffer.concat(chunks, totalBytes);
        const monoPcm = downmixStereoToMono(stereoPcm);

        if (monoPcm.length < MIN_PCM_BYTES) {
          return;
        }

        const transcript = await transcribe(monoPcm);

        if (transcript) {
          await onTranscript(transcript);
        }
      } catch (error) {
        onError(error);
      } finally {
        busy = false;
      }
    };

    decoder.on("data", (chunk) => {
      if (totalBytes >= MAX_STEREO_PCM_BYTES) {
        return;
      }

      const remainingBytes = MAX_STEREO_PCM_BYTES - totalBytes;
      const nextChunk =
        chunk.length <= remainingBytes ? chunk : chunk.subarray(0, remainingBytes);
      chunks.push(nextChunk);
      totalBytes += nextChunk.length;
    });
    decoder.once("end", () => void finalize());
    decoder.once("error", (error) => {
      onError(error);
      void finalize();
    });
    opusStream.once("error", (error) => {
      onError(error);
      void finalize();
    });
    opusStream.pipe(decoder);

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
    activeDecoder?.destroy();
  };
}
