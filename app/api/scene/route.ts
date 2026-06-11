import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "orbita-images";

const Body = z.object({
  prompt: z.string().min(1, "Describe el escenario / fondo."),
  aspect: z.enum(["9:16", "16:9", "1:1"]).optional().default("9:16"),
});

function sizeFor(aspect: string): string {
  if (aspect === "16:9") return "1536x1024";
  if (aspect === "1:1") return "1024x1024";
  return "1024x1536"; // 9:16
}

async function store(b64: string): Promise<string | null> {
  const sb = getServerSupabase();
  if (!sb) return null;
  try {
    const buffer = Buffer.from(b64, "base64");
    const path = `uploads/scene/${randomUUID()}.png`;
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: "image/png", upsert: true });
    if (error) return null;
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

// POST /api/scene -> genera una imagen de escenario/fondo (sin personas) y la
// sube a Storage. Pensada como material de referencia (@ImageN) para el compositor.
export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: e?.issues?.[0]?.message ?? "Body inválido." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { url: `https://placehold.co/1024x1536/0b1220/38bdf8?text=SCENE`, mode: "stub" },
      { status: 200 }
    );
  }

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, prompt: parsed.prompt, size: sizeFor(parsed.aspect), n: 1 }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}` }, { status: 500 });
    }
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ error: "OpenAI no devolvió imagen." }, { status: 500 });
    const url = (await store(b64)) ?? `data:image/png;base64,${b64}`;
    return NextResponse.json({ url, mode: model });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "No se pudo generar el escenario." }, { status: 500 });
  }
}
