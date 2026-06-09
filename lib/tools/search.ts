import type { ToolDef } from "./context";

/**
 * web_search — interfaz fija + STUB.
 * Si existe TAVILY_API_KEY hace una búsqueda real (Tavily); si no, devuelve
 * resultados simulados plausibles para que la investigación pueda avanzar.
 * Más adelante esto puede reemplazarse por una tool vía MCP (ver lib/mcp.ts).
 */
export const webSearch: ToolDef = {
  schema: {
    name: "web_search",
    description:
      "Busca información de mercado, competencia, tendencias o audiencia en la web. Devuelve un resumen de resultados.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Consulta de búsqueda." },
      },
      required: ["query"],
    },
  },
  handler: async (input, ctx) => {
    const query = String(input.query ?? "");

    if (process.env.TAVILY_API_KEY) {
      try {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query,
            max_results: 5,
            search_depth: "basic",
          }),
          signal: ctx.signal,
        });
        if (!res.ok) throw new Error(`Tavily ${res.status}`);
        const data = await res.json();
        const results = (data?.results ?? [])
          .map((r: any) => `• ${r.title}: ${r.content?.slice(0, 240)} (${r.url})`)
          .join("\n");
        return results || "Sin resultados.";
      } catch {
        // cae al stub
      }
    }

    // STUB: resultados simulados (marcados como tales para no confundir al agente).
    return [
      `[SIMULADO — sin TAVILY_API_KEY] Resultados para "${query}":`,
      "• Tendencia: el formato UGC vertical de 9-15s domina el rendimiento en TikTok/Reels para captación.",
      "• Audiencia: mayor CTR en mensajes que abren con un problema concreto en los primeros 2s.",
      "• Competencia: los anuncios ganadores usan prueba social (testimonios) y una oferta clara con urgencia.",
      "• Benchmark: CPA objetivo varía por nicho; iniciar con presupuesto de prueba y escalar lo que baje el CPA.",
    ].join("\n");
  },
};
