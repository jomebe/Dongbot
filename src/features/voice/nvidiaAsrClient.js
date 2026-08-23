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
}) {
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY가 필요합니다.");
  }

  const client = new RivaSpeechRecognition(
    server,
    grpc.credentials.createSsl(),
  );

  return {
    async transcribePcm(pcmBuffer) {
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
          maxAlternatives: 1,
          speechContexts: [
            {
              phrases: [wakeWord],
              boost: 50,
            },
          ],
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

      return (response.results ?? [])
        .map((result) => result.alternatives?.[0]?.transcript ?? "")
        .join(" ")
        .trim();
    },
    close() {
      client.close();
    },
  };
}
