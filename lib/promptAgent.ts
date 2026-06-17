// ============================================================================
// Helpers PUROS del nodo "Agente Prompt" de la pizarra. La ruta API
// (app/api/pipeline/prompt-agent) es solo glue: arma el system + user message,
// llama a Claude (Opus 4.8) y limpia la salida con cleanPromptOutput.
//
// Separar esto en funciones puras lo hace testeable sin red.
// ============================================================================

export interface PromptAgentInput {
  context: string;
  instruction: string;
}

/** System prompt: convierte contexto+instrucción en UN prompt de generación de imagen. */
export function buildAgentSystem(): string {
  return `Eres un ingeniero de prompts para modelos de generación de IMAGEN (GPT Image).
Tu trabajo: a partir del CONTEXTO del proyecto y de la INSTRUCCIÓN del usuario, redactar
un único prompt visual, vívido y específico, listo para enviar al generador de imagen.

REGLAS:
- Escribe el prompt en inglés (los modelos de imagen rinden mejor en inglés).
- Sé concreto: sujeto, composición, iluminación, lente/encuadre, estilo, ambiente, paleta.
- Respeta el contexto del proyecto (marca, producto, tono, audiencia) cuando exista.
- No inventes texto, logos ni marcas de agua dentro de la imagen.
- Devuelve SOLO el prompt final como texto plano: sin markdown, sin cercas de
  código, sin comillas que lo envuelvan, sin etiquetas tipo "Prompt:", sin explicaciones.`;
}

/**
 * System prompt para modo VIDEO: convierte contexto+instrucción en un prompt
 * "timeline" de Seedance 2.0 reference-to-video (la técnica del reel): varios
 * beats que anclan cada imagen de referencia por su tag y un tiempo, con un
 * movimiento de cámara, y un sufijo de estilo global.
 */
export function buildVideoAgentSystem(): string {
  return `Eres un director de fotografía que escribe prompts para Seedance 2.0 (reference-to-video).
A partir del CONTEXTO del proyecto y de la INSTRUCCIÓN, redacta UN prompt en formato "timeline"
para un clip vertical 9:16 de ~8-12s, anclando las imágenes de referencia.

GRAMÁTICA (síguela exactamente):
- El clip se divide en "beats". Cada beat es una línea:
  @ImageN [MM:SS] <movimiento de cámara> <qué pasa en la escena>.
- @ImageN referencia la imagen de entrada N por su ORDEN (1ª imagen = @Image1, 2ª = @Image2, …).
  Empieza en @Image1 [00:00] y avanza los timestamps en orden.
- Movimientos de cámara concretos: "slow push-in", "low dolly left to right", "camera holds still",
  "slow zoom out", "overhead hold", "freeze".
- Cierra con UNA línea de estilo global: estética, paleta, "cinematic, photorealistic", mood.

REGLAS:
- Escribe el prompt en inglés (los modelos de video rinden mejor en inglés).
- No inventes texto/logos/marcas de agua dentro del video.
- Devuelve SOLO el prompt final como texto plano: sin markdown, sin cercas de código,
  sin comillas que lo envuelvan, sin etiquetas tipo "Prompt:", sin explicaciones.`;
}

/** Mensaje de usuario con el contexto del proyecto y la instrucción del nodo. */
export function buildAgentUserMessage(input: PromptAgentInput): string {
  const context = input.context.trim();
  const contextBlock = context
    ? `CONTEXTO DEL PROYECTO:\n${context}`
    : "CONTEXTO DEL PROYECTO:\n(sin contexto: usa solo la instrucción)";
  return `${contextBlock}\n\nINSTRUCCIÓN:\n${input.instruction.trim()}\n\nDevuelve solo el prompt final de imagen.`;
}

/** Limpia la salida del modelo: cercas de código, etiquetas y comillas envolventes. */
export function cleanPromptOutput(raw: string): string {
  let out = raw.trim();

  // Cercas de código ```...``` (con o sin lenguaje en la primera línea).
  const fence = out.match(/^```[^\n]*\n([\s\S]*?)\n?```$/);
  if (fence) out = fence[1].trim();

  // Etiqueta inicial tipo "Prompt:" / "Prompt final:".
  out = out.replace(/^prompt(\s+final)?\s*:\s*/i, "").trim();

  // Comillas que envuelven TODO el texto.
  const quoted = out.match(/^(["'])([\s\S]*)\1$/);
  if (quoted) out = quoted[2].trim();

  return out.trim();
}
