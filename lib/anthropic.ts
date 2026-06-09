import Anthropic from "@anthropic-ai/sdk";

// Modelos (IDs exactos confirmados)
export const MODEL_DIRECTOR = "claude-opus-4-8";
export const MODEL_AREA = "claude-sonnet-4-6";

let _client: Anthropic | null = null;

export function hasAnthropicKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// La key vive SOLO en el servidor. Este modulo nunca debe importarse en el cliente.
export function getAnthropic(): Anthropic {
  if (!hasAnthropicKey()) {
    throw new Error(
      "Falta ANTHROPIC_API_KEY. Crea .env.local con tu key de Anthropic y reinicia el server."
    );
  }
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export type { Anthropic };
