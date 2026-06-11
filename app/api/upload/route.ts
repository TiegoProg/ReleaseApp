import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "orbita-images";
const MAX_BYTES = 16 * 1024 * 1024; // 16MB — cubre fotos de producto y clips/audios cortos

// POST /api/upload (multipart, campo "file") -> sube un material de referencia a
// Supabase Storage y devuelve una URL pública (Seedance/OpenAI necesitan una URL
// real). Sin Storage, cae a data-URL para no romper la previsualización.
export async function POST(req: NextRequest) {
  let file: Blob | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof Blob) file = f;
  } catch {
    return NextResponse.json({ error: "Esperaba multipart/form-data con un campo 'file'." }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El archivo supera 16MB." }, { status: 413 });
  }

  const type = file.type || "application/octet-stream";
  const kind = type.startsWith("video") ? "video" : type.startsWith("audio") ? "audio" : "image";
  const ext = (type.split("/")[1]?.split(";")[0] || "bin").replace(/[^a-z0-9]/gi, "") || "bin";
  const buf = Buffer.from(await file.arrayBuffer());

  const sb = getServerSupabase();
  if (!sb) {
    // Sin Storage: data-URL (sirve para previsualizar; fal puede no aceptarla).
    return NextResponse.json({
      url: `data:${type};base64,${buf.toString("base64")}`,
      kind,
      stored: false,
    });
  }

  try {
    const path = `uploads/${kind}/${randomUUID()}.${ext}`;
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(path, buf, { contentType: type, upsert: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ url, kind, stored: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "No se pudo subir el archivo." }, { status: 500 });
  }
}
