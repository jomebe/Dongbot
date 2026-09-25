import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "node:url";

const protoPath = fileURLToPath(new URL("./riva_asr.proto", import.meta.url));
const packageDefinition = protoLoader.loadSync(protoPath, {
  defaults: true,
  enums: String,
  keepCase: false,
  longs: String,
  oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDefinition);
const RivaSpeechRecognition = proto.nvidia.riva.asr.RivaSpeechRecognition;

export function createNvidiaAsrClient({
  apiKey,
  functionId,
  server,
  languageCode = "ko-KR",
  wakeWord = "동봇",
  maxAlternatives = 3,
  enableWakeWordBoost = true,
}) {
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY가 필요합니다.");
  }

  const client = new RivaSpeechRecognition(
    server,
    grpc.credentials.createSsl(),
  );

  return {
    async transcribePcm(
      pcmBuffer,
      {
        speechPhrases = null,
        speechBoost = null,
      } = {},
    ) {
      if (!Buffer.isBuffer(pcmBuffer) || pcmBuffer.length === 0) {
        return "";
      }

      const metadata = new grpc.Metadata();
      metadata.set("authorization", `Bearer ${apiKey}`);
      metadata.set("function-id", functionId);

      const request = {
        config: {
          encoding: "LINEAR_PCM",
          sampleRateHertz: 48_000,
          languageCode,
          maxAlternatives,
          ...(
            Array.isArray(speechPhrases) && speechPhrases.length > 0
              ? {
                  speechContexts: [
                    {
                      phrases: speechPhrases,
                      boost: speechBoost ?? 80,
                    },
                  ],
                }
              : enableWakeWordBoost
                ? {
                    speechContexts: [
                      {
                        phrases: [wakeWord, `헤이 ${wakeWord}`, `헤이${wakeWord}`],
                        boost: 80,
                      },
                    ],
                  }
                : {}
          ),
          audioChannelCount: 1,
          enableAutomaticPunctuation: true,
        },
        audio: pcmBuffer,
      };

      const response = await new Promise((resolve, reject) => {
        client.recognize(
          request,
          metadata,
          { deadline: Date.now() + 20_000 },
          (error, value) => {
            if (error) {
              reject(error);
              return;
            }

            resolve(value);
          },
        );
      });

      const resultAlternatives = response.results ?? [];
      const maxAlternativeCount = Math.max(
        0,
        ...resultAlternatives.map((result) => result.alternatives?.length ?? 0),
      );
      const transcripts = [];

      for (let alternativeIndex = 0; alternativeIndex < maxAlternativeCount; alternativeIndex += 1) {
        const transcript = resultAlternatives
          .map((result) => result.alternatives?.[alternativeIndex]?.transcript ?? "")
          .join(" ")
          .trim();

        if (transcript && !transcripts.includes(transcript)) {
          transcripts.push(transcript);
        }
      }

      return transcripts;
    },
    close() {
      client.close();
    },
  };
}
