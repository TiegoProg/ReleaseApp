import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Supabase es OPCIONAL. Si no esta configurado, el store usa memoria.
// Importante: ignora los PLACEHOLDERS de .env.local.example (valores con "xxxx"),
// para que copiar el ejemplo no active Supabase con credenciales falsas.
export function hasSupabase(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  if (url.includes("xxxx") || key.includes("xxxx")) return false; // placeholders
  if (!/^https:\/\/.+\.supabase\.co/.test(url)) return false; // URL no válida
  return true;
}

let _server: SupabaseClient | null = null;

// Cliente de servidor: usa la service role key (bypassa RLS). Solo en el server.
export function getServerSupabase(): SupabaseClient | null {
  if (!hasSupabase()) return null;
  if (!_server) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    _server = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return _server;
}
