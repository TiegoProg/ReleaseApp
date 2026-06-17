import { describe, expect, it } from "vitest";
import {
  buildAgentSystem,
  buildAgentUserMessage,
  buildVideoAgentSystem,
  cleanPromptOutput,
} from "../lib/promptAgent";

describe("buildAgentSystem", () => {
  it("instruye devolver SOLO el prompt, sin markdown, para generación de imagen", () => {
    const sys = buildAgentSystem();
    expect(sys).toMatch(/SOLO el prompt/);
    expect(sys).toMatch(/sin markdown/i);
    expect(sys).toMatch(/imagen/i);
  });
});

describe("buildVideoAgentSystem", () => {
  it("describe la gramática timeline @ImageN con timestamps, cámara y estilo global; solo el prompt", () => {
    const sys = buildVideoAgentSystem();
    expect(sys).toMatch(/@Image/);
    expect(sys).toMatch(/\[MM:SS\]|\[00:00\]|timestamp|tiempo/i);
    expect(sys).toMatch(/c[aá]mara/i);
    expect(sys).toMatch(/SOLO el prompt/);
  });
});

describe("buildAgentUserMessage", () => {
  it("incluye el contexto del proyecto y la instrucción", () => {
    const msg = buildAgentUserMessage({
      context: "Marca: Zen Tea, té matcha premium",
      instruction: "una foto de producto sobre madera clara",
    });
    expect(msg).toContain("Zen Tea");
    expect(msg).toContain("una foto de producto sobre madera clara");
  });

  it("tolera contexto vacío sin romperse", () => {
    const msg = buildAgentUserMessage({ context: "", instruction: "un gato astronauta" });
    expect(msg).toContain("un gato astronauta");
  });
});

describe("cleanPromptOutput", () => {
  it("recorta espacios", () => {
    expect(cleanPromptOutput("  hola mundo  ")).toBe("hola mundo");
  });

  it("quita cercas de código con o sin lenguaje", () => {
    expect(cleanPromptOutput("```\nun prompt limpio\n```")).toBe("un prompt limpio");
    expect(cleanPromptOutput("```text\nun prompt limpio\n```")).toBe("un prompt limpio");
  });

  it("quita una etiqueta inicial tipo 'Prompt:'", () => {
    expect(cleanPromptOutput("Prompt: un atardecer dorado")).toBe("un atardecer dorado");
    expect(cleanPromptOutput("Prompt final: un atardecer dorado")).toBe("un atardecer dorado");
  });

  it("quita comillas que envuelven todo el texto", () => {
    expect(cleanPromptOutput('"un atardecer dorado"')).toBe("un atardecer dorado");
    expect(cleanPromptOutput("'un atardecer dorado'")).toBe("un atardecer dorado");
  });

  it("combina cercas + etiqueta + comillas", () => {
    expect(cleanPromptOutput('```\nPrompt: "un atardecer dorado"\n```')).toBe(
      "un atardecer dorado"
    );
  });

  it("deja intacto un prompt ya limpio", () => {
    const p = "cinematic product shot of matcha tea on light oak, soft window light";
    expect(cleanPromptOutput(p)).toBe(p);
  });
});
