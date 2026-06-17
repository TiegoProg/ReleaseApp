import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { startVideo } from "@/lib/seedance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ============================================================================
// Nodo "Video (Seedance)" de la pizarra. Recibe las imágenes de referencia ya
// ordenadas (@Image1..N) + el prompt-timeline y lanza la generación en fal.
// Es reference-to-video de PRODUCTO (sin persona/voz). El polling lo hace el
// cliente vía GET /api/ugc/status?requestId=… (reutiliza pollVideo).
// ============================================================================

const Body = z.object({
  imageUrls: z.array(z.string().min(1)).min(1, "Conecta al menos una imagen de referencia."),
  prompt: z.string().min(1, "Falta el prompt del video."),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: e?.issues?.[0]?.message ?? "Body inválido." }, { status: 400 });
  }

  // startVideo ya maneja el caso sin FAL_KEY devolviendo un stub visible.
  const job = await startVideo({ imageUrls: parsed.imageUrls, prompt: parsed.prompt });

  if (job.status === "failed") {
    return NextResponse.json({ error: job.error ?? "No se pudo lanzar el render." }, { status: 502 });
  }
  return NextResponse.json({ job });
}
