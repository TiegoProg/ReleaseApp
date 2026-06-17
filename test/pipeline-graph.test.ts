import { describe, expect, it } from "vitest";
import {
  canConnect,
  collectInputs,
  firstInputText,
  reconcileImageOrder,
  removeNode,
  type GraphEdge,
  type GraphNode,
} from "../lib/pipelineGraph";

// Grafo de juguete: project -> promptAgent -> image
function fixture(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [
    { id: "p1", type: "project", data: { output: { text: "marca: Zen Tea" } } },
    { id: "a1", type: "promptAgent", data: { output: { text: "un prompt cinematográfico" } } },
    { id: "i1", type: "image", data: {} },
  ];
  const edges: GraphEdge[] = [
    { source: "p1", target: "a1" },
    { source: "a1", target: "i1" },
  ];
  return { nodes, edges };
}

describe("collectInputs", () => {
  it("reúne el output del nodo upstream conectado", () => {
    const { nodes, edges } = fixture();
    const got = collectInputs("a1", nodes, edges);
    expect(got.missing).toEqual([]);
    expect(got.inputs).toHaveLength(1);
    expect(got.inputs[0]).toMatchObject({
      fromId: "p1",
      fromType: "project",
      output: { text: "marca: Zen Tea" },
    });
  });

  it("reporta como missing un upstream sin output listo", () => {
    const { nodes, edges } = fixture();
    // i1 (image) aún no se ejecutó: su upstream a1 sí tiene output, pero hagamos
    // que a1 esté vacío para probar el reporte de faltantes.
    const blanked = nodes.map((n) => (n.id === "a1" ? { ...n, data: {} } : n));
    const got = collectInputs("i1", blanked, edges);
    expect(got.inputs).toEqual([]);
    expect(got.missing).toEqual(["a1"]);
  });

  it("trata texto en blanco como output no listo", () => {
    const { edges } = fixture();
    const nodes: GraphNode[] = [
      { id: "p1", type: "project", data: { output: { text: "   " } } },
      { id: "a1", type: "promptAgent", data: {} },
      { id: "i1", type: "image", data: {} },
    ];
    const got = collectInputs("a1", nodes, edges);
    expect(got.missing).toEqual(["p1"]);
  });

  it("devuelve vacío cuando el nodo no tiene conexiones entrantes", () => {
    const { nodes, edges } = fixture();
    const got = collectInputs("p1", nodes, edges);
    expect(got).toEqual({ inputs: [], missing: [] });
  });
});

describe("firstInputText", () => {
  it("devuelve el texto del primer input listo", () => {
    const { nodes, edges } = fixture();
    expect(firstInputText(collectInputs("a1", nodes, edges))).toBe("marca: Zen Tea");
  });

  it("devuelve undefined cuando no hay inputs", () => {
    const { nodes, edges } = fixture();
    expect(firstInputText(collectInputs("p1", nodes, edges))).toBeUndefined();
  });
});

describe("removeNode", () => {
  it("quita el nodo y todas las aristas que lo tocan (como source o target)", () => {
    const { nodes, edges } = fixture();
    const out = removeNode("a1", nodes, edges);
    expect(out.nodes.map((n) => n.id)).toEqual(["p1", "i1"]);
    // p1->a1 y a1->i1 deben desaparecer (a1 era source y target)
    expect(out.edges).toEqual([]);
  });

  it("no toca el grafo si el id no existe", () => {
    const { nodes, edges } = fixture();
    const out = removeNode("zzz", nodes, edges);
    expect(out.nodes).toHaveLength(3);
    expect(out.edges).toHaveLength(2);
  });

  it("conserva las aristas ajenas al nodo borrado", () => {
    const { nodes, edges } = fixture();
    const out = removeNode("i1", nodes, edges);
    expect(out.nodes.map((n) => n.id)).toEqual(["p1", "a1"]);
    expect(out.edges).toEqual([{ source: "p1", target: "a1" }]);
  });
});

describe("canConnect", () => {
  it("rechaza conectarse a sí mismo", () => {
    const { nodes, edges } = fixture();
    expect(canConnect({ source: "a1", target: "a1" }, nodes, edges)).toBe(false);
  });

  it("rechaza conectar HACIA un nodo project (no tiene entrada)", () => {
    const { nodes } = fixture();
    expect(canConnect({ source: "a1", target: "p1" }, nodes, [])).toBe(false);
  });

  it("permite project -> promptAgent", () => {
    const { nodes } = fixture();
    expect(canConnect({ source: "p1", target: "a1" }, nodes, [])).toBe(true);
  });

  it("permite promptAgent -> image", () => {
    const { nodes } = fixture();
    expect(canConnect({ source: "a1", target: "i1" }, nodes, [])).toBe(true);
  });

  it("rechaza una segunda arista hacia un nodo de una sola entrada", () => {
    const { nodes, edges } = fixture();
    // a1 ya recibe de p1; intentar conectar i1->a1 (además de ciclo) debe fallar por capacidad
    const extra: GraphNode = { id: "p2", type: "project", data: { output: { text: "x" } } };
    expect(canConnect({ source: "p2", target: "a1" }, [...nodes, extra], edges)).toBe(false);
  });

  it("rechaza una conexión que crearía un ciclo", () => {
    const { nodes, edges } = fixture();
    // i1 -> p1 no aplica (p1 no tiene entrada); probamos i1 -> a1 que cerraría p1->a1->i1->a1
    // usando un nodo extra con entrada para aislar el chequeo de ciclo:
    const cyc: GraphNode[] = [
      { id: "a", type: "promptAgent", data: {} },
      { id: "b", type: "image", data: {} },
    ];
    const cycEdges: GraphEdge[] = [{ source: "a", target: "b" }];
    // a -> b ya existe; b -> a cerraría el ciclo
    expect(canConnect({ source: "b", target: "a" }, cyc, cycEdges)).toBe(false);
  });
});

describe("canConnect — puertos tipados (asset/video)", () => {
  const nodes: GraphNode[] = [
    { id: "img", type: "image", data: { output: { url: "u1" } } },
    { id: "asset", type: "asset", data: { output: { url: "u2" } } },
    { id: "agent", type: "promptAgent", data: { output: { text: "p" } } },
    { id: "vid", type: "video", data: {} },
  ];

  it("imagen (url) -> handle 'images' del video: válido", () => {
    expect(canConnect({ source: "img", target: "vid", targetHandle: "images" }, nodes, [])).toBe(true);
  });

  it("asset (url) -> 'images': válido", () => {
    expect(canConnect({ source: "asset", target: "vid", targetHandle: "images" }, nodes, [])).toBe(true);
  });

  it("agente (text) -> handle 'prompt' del video: válido", () => {
    expect(canConnect({ source: "agent", target: "vid", targetHandle: "prompt" }, nodes, [])).toBe(true);
  });

  it("imagen (url) -> 'prompt': inválido por tipo", () => {
    expect(canConnect({ source: "img", target: "vid", targetHandle: "prompt" }, nodes, [])).toBe(false);
  });

  it("agente (text) -> 'images': inválido por tipo", () => {
    expect(canConnect({ source: "agent", target: "vid", targetHandle: "images" }, nodes, [])).toBe(false);
  });

  it("'images' acepta varias entradas (max ∞)", () => {
    const edges: GraphEdge[] = [{ source: "img", target: "vid", targetHandle: "images" }];
    expect(canConnect({ source: "asset", target: "vid", targetHandle: "images" }, nodes, edges)).toBe(true);
  });

  it("'prompt' es de una sola entrada (max 1)", () => {
    const edges: GraphEdge[] = [{ source: "agent", target: "vid", targetHandle: "prompt" }];
    const extra: GraphNode[] = [...nodes, { id: "proj", type: "project", data: { output: { text: "c" } } }];
    expect(canConnect({ source: "proj", target: "vid", targetHandle: "prompt" }, extra, edges)).toBe(false);
  });

  it("asset no acepta entradas", () => {
    expect(canConnect({ source: "img", target: "asset" }, nodes, [])).toBe(false);
  });
});

describe("collectInputs por handle", () => {
  it("filtra por targetHandle cuando se indica", () => {
    const nodes: GraphNode[] = [
      { id: "img", type: "image", data: { output: { url: "u1" } } },
      { id: "agent", type: "promptAgent", data: { output: { text: "el prompt" } } },
      { id: "vid", type: "video", data: {} },
    ];
    const edges: GraphEdge[] = [
      { source: "img", target: "vid", targetHandle: "images" },
      { source: "agent", target: "vid", targetHandle: "prompt" },
    ];
    const promptIn = collectInputs("vid", nodes, edges, "prompt");
    expect(promptIn.inputs).toHaveLength(1);
    expect(firstInputText(promptIn)).toBe("el prompt");
  });
});

describe("reconcileImageOrder", () => {
  it("preserva el orden previo, agrega nuevos al final y descarta desconectados", () => {
    expect(reconcileImageOrder(["a", "b", "c"], ["c", "a", "d"])).toEqual(["a", "c", "d"]);
  });

  it("desde vacío toma los conectados", () => {
    expect(reconcileImageOrder([], ["x", "y"])).toEqual(["x", "y"]);
  });

  it("sin conectados queda vacío", () => {
    expect(reconcileImageOrder(["a", "b"], [])).toEqual([]);
  });
});
