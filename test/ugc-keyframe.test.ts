import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editImage } from "../lib/avatar";
import { buildKeyframePrompt } from "../lib/keyframe";
import { NEGATIVE_INSTRUCTIONS } from "../lib/ugcPrompt";

const OPENAI_EDIT = "https://api.openai.com/v1/images/edits";

// Mock de fetch: descargas de imagen devuelven bytes; el POST a /edits captura
// el FormData enviado (para inspeccionar campos image / image[]).
function mockFetch(opts: { okFor?: (url: string) => boolean } = {}) {
  const okFor = opts.okFor ?? (() => true);
  let captured: FormData | null = null;

  const fn = vi.fn(async (url: string, init?: any) => {
    if (url === OPENAI_EDIT) {
      captured = init?.body as FormData;
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [{ b64_json: "RESULT_B64" }] }),
        text: async () => "",
      } as any;
    }
    // descarga de una imagen de referencia
    if (!okFor(url)) {
      return { ok: false, status: 404, text: async () => "not found" } as any;
    }
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      headers: { get: () => "image/png" },
    } as any;
  });

  globalThis.fetch = fn as any;
  return { fn, getCaptured: () => captured };
}

describe("editImage (multi-imagen)", () => {
  beforeEach(() => mockFetch());
  afterEach(() => vi.restoreAllMocks());

  it("con 2 referencias usa el campo image[] con ambas imágenes", async () => {
    const { getCaptured } = mockFetch();
    const out = await editImage(
      ["https://x/avatar.png", "https://x/sheet.png"],
      "compose",
      "1024x1536",
      "gpt-image-1",
      "key"
    );
    expect(out).toBe("RESULT_B64");
    const form = getCaptured()!;
    expect(form.getAll("image[]").length).toBe(2);
    expect(form.getAll("image").length).toBe(0);
    expect(form.get("input_fidelity")).toBe("high"); // solo gpt-image-1
    expect(form.get("model")).toBe("gpt-image-1");
  });

  it("con 1 referencia usa el campo image (compat) y una sola imagen", async () => {
    const { getCaptured } = mockFetch();
    await editImage(["https://x/avatar.png"], "p", "1024x1536", "gpt-image-1", "key");
    const form = getCaptured()!;
    expect(form.getAll("image").length).toBe(1);
    expect(form.getAll("image[]").length).toBe(0);
  });

  it("omite una referencia secundaria que no se pudo descargar", async () => {
    const { getCaptured } = mockFetch({ okFor: (u) => !u.includes("sheet") });
    await editImage(
      ["https://x/avatar.png", "https://x/sheet.png"],
      "p",
      "1024x1536",
      "gpt-image-1",
      "key"
    );
    const form = getCaptured()!;
    // solo el avatar sobrevive → vuelve a campo `image` (no multi)
    expect(form.getAll("image").length).toBe(1);
    expect(form.getAll("image[]").length).toBe(0);
  });

  it("falla si la referencia ancla (primera) no se puede descargar", async () => {
    mockFetch({ okFor: () => false });
    await expect(
      editImage(["https://x/avatar.png"], "p", "1024x1536", "gpt-image-1", "key")
    ).rejects.toThrow(/No se pudo descargar/);
  });

  it("no añade input_fidelity para modelos que no lo soportan", async () => {
    const { getCaptured } = mockFetch();
    await editImage(["https://x/a.png"], "p", "1024x1536", "gpt-image-2", "key");
    expect(getCaptured()!.get("input_fidelity")).toBeNull();
  });

  it("exige al menos una referencia", async () => {
    await expect(editImage([], "p", "1024x1536", "gpt-image-1", "key")).rejects.toThrow(
      /al menos una referencia/
    );
  });
});

describe("buildKeyframePrompt (regla anti-collage)", () => {
  it("prohíbe el look de character sheet / collage y mantiene la identidad", () => {
    const p = buildKeyframePrompt("hombre 45-50 frente a un espejo");
    expect(p).toContain("hombre 45-50 frente a un espejo"); // la escena entra
    expect(p).toMatch(/NOT a character reference sheet/i);
    expect(p).toMatch(/NOT a collage/i);
    expect(p).toMatch(/do NOT reproduce the sheet/i);
    expect(p).toMatch(/EXACT identity/i);
    expect(p).toContain(NEGATIVE_INSTRUCTIONS); // hereda la lista negativa canónica
  });
});
