// Banco de pruebas de voces — genera el MISMO texto con varias voces y sube los
// audios a Supabase para escucharlos y comparar. NO toca Seedance (cero costo de
// video). Reutilizable para auditar voces antes de fijar el voice lock.
//
//   node scripts/voice-bench.mjs gemini "Charon,Algenib,Gacrux" "Texto a decir"
//   node scripts/voice-bench.mjs eleven "voiceIdA,voiceIdB" "Texto" [modelId]
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function parseEnv(txt) {
  const map = {};
  for (const raw of txt.split(/\r?\n/)) {
    const t = raw.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    const c = v.indexOf(" #");
    if (c >= 0) v = v.slice(0, c).trim();
    map[t.slice(0, i).trim()] = v;
  }
  return map;
}

function pcmToWav(pcm, sampleRate = 24000) {
  const numChannels = 1, bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(numChannels, 22); h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(byteRate, 28); h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(bitsPerSample, 34); h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

const [, , provider, voicesArg, text, modelArg] = process.argv;
if (!provider || !voicesArg || !text) {
  console.error('Uso: node scripts/voice-bench.mjs <gemini|eleven> "v1,v2,..." "texto" [modelId]');
  process.exit(1);
}
const voices = voicesArg.split(",").map((s) => s.trim()).filter(Boolean);

const env = parseEnv(fs.readFileSync(".env.local", "utf8"));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function upload(buf, ext, contentType, tag) {
  const path = `voice/bench-${tag}-${Date.now()}.${ext}`;
  const up = await sb.storage.from("orbita-images").upload(path, buf, { contentType, upsert: true });
  if (up.error) return null;
  return sb.storage.from("orbita-images").getPublicUrl(path).data.publicUrl;
}

async function gemini(voiceName) {
  const model = env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    }),
  });
  if (!res.ok) return { error: `${res.status} ${(await res.text()).slice(0, 140)}` };
  const data = await res.json();
  const b64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) return { error: "sin audio en la respuesta" };
  const wav = pcmToWav(Buffer.from(b64, "base64"));
  const u = await upload(wav, "wav", "audio/wav", voiceName);
  return u ? { url: u } : { error: "upload falló" };
}

async function eleven(voiceId) {
  const model = modelArg || env.ELEVENLABS_MODEL || "eleven_v3";
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
  });
  if (!res.ok) return { error: `${res.status} ${(await res.text()).slice(0, 140)}` };
  const u = await upload(Buffer.from(await res.arrayBuffer()), "mp3", "audio/mpeg", voiceId);
  return u ? { url: u } : { error: "upload falló" };
}

for (const v of voices) {
  const r = provider === "eleven" ? await eleven(v) : await gemini(v);
  console.log(r.url ? `✅ ${v}\n   ${r.url}` : `❌ ${v}: ${r.error}`);
}
