import { NextResponse } from "next/server";
import { hasAnthropicKey } from "@/lib/anthropic";
import { hasSupabase } from "@/lib/supabase";
import type { ConfigStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status: ConfigStatus = {
    hasAnthropic: hasAnthropicKey(),
    hasSupabase: hasSupabase(),
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasKling: !!process.env.KLING_API_KEY,
  };
  return NextResponse.json(status);
}
