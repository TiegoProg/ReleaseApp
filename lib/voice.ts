import { randomUUID } from "crypto";
import { getServerSupabase } from "./supabase";

// ============================================================================
// Voz: Gemini TTS (misma key que VEO/Gemini). Voz NOMBRADA fija por persona =
// coherencia de voz. Devuelve una URL de audio (WAV) o null (stub) si no hay key.
// La salida de Gemini TTS es PCM 16-bit 24kHz; le añadimos cabecera WAV.
// ============================================================================

const AUDIO_BUCKET = "orbita-images"; // reutilizamos el bucket existente

function ttsModel(): string {
  return process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
}

// Cabecera WAV mínima para PCM 16-bit mono.
function pcmToWav(pcm: Buffer, sampleRate = 24000): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function storeWav(wav: Buffer): Promise<string | null> {
  const sb = getServerSupabase();
  if (!sb) return null;
  try {
    const path = `voice/${randomUUID()}.wav`;
    const { error } = await sb.storage
      .from(AUDIO_BUCKET)
      .upload(path, wav, { contentType: "audio/wav", upsert: true });
    if (error) return null;
    return sb.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

export interface VoiceResult {
  audioUrl?: string;
  mode: string;
}

/**
 * Genera la voz del guion con una voz nombrada fija (coherencia por persona).
 * Devuelve audioUrl (WAV) si hay key + storage; si no, mode="stub".
 */
export async function generateVoice(input: {
  text: string;
  voiceName: string;
  language?: string;
}): Promise<VoiceResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !input.text.trim()) return { mode: "stub" };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${ttsModel()}:generateContent?key=${key}`;
  const body = {
    contents: [{ parts: [{ text: input.text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: input.voiceName } },
      },
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { mode: `gemini-tts-error(${res.status})` };
    const data = await res.json();
    const b64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!b64) return { mode: "gemini-tts-empty" };
    const wav = pcmToWav(Buffer.from(b64, "base64"));
    const audioUrl = await storeWav(wav);
    // Sin storage no podemos exponer una URL descargable para Seedance.
    return audioUrl ? { audioUrl, mode: "gemini-tts" } : { mode: "gemini-tts-nostore" };
  } catch (e: any) {
    return { mode: "gemini-tts-fail" };
  }
}
