import { randomUUID } from "crypto";
import { getServerSupabase } from "./supabase";

// ============================================================================
// Voz con DOS providers:
// - ElevenLabs (si hay ELEVENLABS_API_KEY): mejor prosodia/emoción; soporta
//   tags como [laughs]/[excited] con el modelo v3. Salida MP3.
// - Gemini TTS (fallback / default): voz NOMBRADA fija por persona. PCM→WAV.
// Selección: VOICE_PROVIDER=elevenlabs|gemini; sin esa env, ElevenLabs si hay
// key, si no Gemini. Si ElevenLabs falla en runtime, cae a Gemini solo.
// OJO licencia: el free tier de ElevenLabs NO permite uso comercial (ads) —
// para publicar en Meta se requiere plan Starter o superior.
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

async function storeAudio(buf: Buffer, contentType: string, ext: string): Promise<string | null> {
  const sb = getServerSupabase();
  if (!sb) return null;
  try {
    const path = `voice/${randomUUID()}.${ext}`;
    const { error } = await sb.storage
      .from(AUDIO_BUCKET)
      .upload(path, buf, { contentType, upsert: true });
    if (error) return null;
    return sb.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

// --- ElevenLabs -------------------------------------------------------------
// Voz por defecto: "Adam" (masculina madura, encaja con Mark). Override por env
// ELEVENLABS_VOICE_ID; modelo por ELEVENLABS_MODEL (eleven_v3 para tags de
// emoción tipo [laughs] cuando esté disponible en tu cuenta).
function elevenVoiceId(override?: string): string {
  return override || process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB"; // Adam
}

// Modelo ElevenLabs. Default = eleven_v3 (mejor control de emoción y soporte de
// tags tipo [laughs]/[pause]). NUNCA defaultear a v2: si la env falta, v3 igual.
function elevenModel(): string {
  return process.env.ELEVENLABS_MODEL || "eleven_v3";
}

async function elevenLabsSpeech(
  text: string,
  voiceId: string,
  model: string
): Promise<{ buf?: Buffer; error?: string }> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return { error: "no ELEVENLABS_API_KEY" };
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!res.ok) {
      // Capturamos el MOTIVO (p.ej. 402 paid_plan_required) en vez de tragarlo:
      // el fallback silencioso a Gemini fue justo lo que ocultó el problema antes.
      let detail = "";
      try {
        const j: any = await res.json();
        detail = j?.detail?.message || j?.detail?.code || JSON.stringify(j).slice(0, 160);
      } catch {
        detail = (await res.text().catch(() => "")).slice(0, 160);
      }
      return { error: `elevenlabs ${res.status}: ${detail}` };
    }
    return { buf: Buffer.from(await res.arrayBuffer()) }; // audio/mpeg
  } catch (e: any) {
    return { error: `elevenlabs fetch fail: ${e?.message ?? e}` };
  }
}

export interface VoiceResult {
  audioUrl?: string;
  mode: string;
  model?: string; // modelo TTS realmente usado (verificable, no asumido)
  voiceId?: string; // voz ElevenLabs realmente usada (verificable)
  elevenError?: string; // por qué ElevenLabs NO se usó (visible, no silencioso)
}

/**
 * Genera la voz del guion. Provider: ElevenLabs si hay key (o VOICE_PROVIDER
 * lo fuerza), con fallback automático a Gemini TTS (voz nombrada por persona).
 * `elevenVoiceId` (opcional) es la voz ElevenLabs pineada DE LA PERSONA — el
 * voice lock con ElevenLabs; sin él se usa ELEVENLABS_VOICE_ID global.
 * Devuelve audioUrl si hay storage; si no hay ninguna key, mode="stub".
 */
export async function generateVoice(input: {
  text: string;
  voiceName: string;
  language?: string;
  elevenVoiceId?: string;
}): Promise<VoiceResult> {
  if (!input.text.trim()) return { mode: "stub" };

  const provider =
    process.env.VOICE_PROVIDER || (process.env.ELEVENLABS_API_KEY ? "elevenlabs" : "gemini");
  let elevenError: string | undefined;
  if (provider === "elevenlabs") {
    const model = elevenModel();
    const voiceId = elevenVoiceId(input.elevenVoiceId);
    const r = await elevenLabsSpeech(input.text, voiceId, model);
    if (r.buf) {
      const url = await storeAudio(r.buf, "audio/mpeg", "mp3");
      // Sin storage no hay URL descargable para Seedance.
      return url
        ? { audioUrl: url, mode: "elevenlabs-tts", model, voiceId }
        : { mode: "elevenlabs-nostore", model, voiceId };
    }
    // ElevenLabs falló (key/créditos/plan/red) → seguimos con Gemini, pero el
    // motivo viaja en el resultado para que el fallback NUNCA sea silencioso.
    elevenError = r.error;
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return { mode: "stub", elevenError };

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
    if (!res.ok) return { mode: `gemini-tts-error(${res.status})`, elevenError };
    const data = await res.json();
    const b64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!b64) return { mode: "gemini-tts-empty", elevenError };
    const wav = pcmToWav(Buffer.from(b64, "base64"));
    const audioUrl = await storeAudio(wav, "audio/wav", "wav");
    // Sin storage no podemos exponer una URL descargable para Seedance.
    return audioUrl
      ? { audioUrl, mode: "gemini-tts", elevenError }
      : { mode: "gemini-tts-nostore", elevenError };
  } catch (e: any) {
    return { mode: "gemini-tts-fail", elevenError };
  }
}
