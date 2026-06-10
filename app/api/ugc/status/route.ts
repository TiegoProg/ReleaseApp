import { NextRequest, NextResponse } from "next/server";
import { pollVideo } from "@/lib/seedance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/ugc/status?requestId=... -> estado del render de Seedance
export async function GET(req: NextRequest) {
  const requestId = req.nextUrl.searchParams.get("requestId");
  if (!requestId) {
    return NextResponse.json({ error: "Falta requestId." }, { status: 400 });
  }
  const job = await pollVideo(requestId);
  return NextResponse.json({ job });
}
