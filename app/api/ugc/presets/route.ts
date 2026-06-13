import { NextResponse } from "next/server";
import { CAMERA_PRESETS } from "@/lib/ugcPrompt";
import { UGC_TEMPLATES } from "@/lib/ugcTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/ugc/presets — catálogo del estudio: presets de cámara (estilo
// Higgsfield, acotados a UGC) y templates de formato. Fuente única de verdad
// para la UI, el MCP server y los agentes.
export async function GET() {
  return NextResponse.json({
    cameraPresets: CAMERA_PRESETS,
    templates: UGC_TEMPLATES.map((t) => ({
      id: t.id,
      label: t.label,
      tagline: t.tagline,
      why: t.why,
      fields: t.fields.map((f) => ({ key: f.key, label: f.label, required: !!f.required })),
    })),
  });
}
