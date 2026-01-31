const HUME_API_URL = "https://api.hume.ai/v0/tts/stream/json";

interface TTSResponse {
  generations: Array<{
    audio: string; // base64 encoded audio
    duration_ms: number;
  }>;
}

export async function textToSpeech(
  text: string,
  voiceId: string,
  apiKey?: string
): Promise<{ audio: Buffer; durationMs: number }> {
  const key = apiKey ?? process.env.HUME_API_KEY;

  if (!key) {
    throw new Error("Hume API key is required. Set HUME_API_KEY env var or pass apiKey parameter.");
  }

  const response = await fetch(HUME_API_URL, {
    method: "POST",
    headers: {
      "X-Hume-Api-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: "2",
      utterances: [
        {
          text,
          voice: {
            id: voiceId,
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hume TTS API error (${response.status}): ${errorText}`);
  }

  const data: TTSResponse = await response.json();

  if (!data.generations || data.generations.length === 0) {
    throw new Error("No audio generated from Hume TTS API");
  }

  const { audio, duration_ms } = data.generations[0];
  const audioBuffer = Buffer.from(audio, "base64");

  return {
    audio: audioBuffer,
    durationMs: duration_ms,
  };
}
