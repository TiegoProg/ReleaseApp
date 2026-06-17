import { beforeEach, describe, expect, it } from "vitest";
import { usePipelineStore } from "../lib/pipelineStore";

// Verifica la lógica del store que respalda el "crear+conectar" del lienzo
// (lo que ejecuta pick() al soltar un conector en vacío) y el borrado.

const conn = (source: string, target: string) => ({
  source,
  target,
  sourceHandle: null,
  targetHandle: null,
});

beforeEach(() => usePipelineStore.getState().reset());

describe("pipelineStore: crear + conectar + borrar", () => {
  it("addNode + onConnect crea una arista válida (project -> promptAgent)", () => {
    const st = usePipelineStore.getState();
    const p = st.addNode("project", { x: 0, y: 0 });
    const a = st.addNode("promptAgent", { x: 0, y: 120 });
    usePipelineStore.getState().onConnect(conn(p, a));

    const edges = usePipelineStore.getState().edges;
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ source: p, target: a });
  });

  it("onConnect rechaza una conexión inválida (hacia un project, que no tiene entrada)", () => {
    const st = usePipelineStore.getState();
    const p = st.addNode("project", { x: 0, y: 0 });
    const a = st.addNode("promptAgent", { x: 0, y: 120 });
    usePipelineStore.getState().onConnect(conn(a, p)); // promptAgent -> project: inválido

    expect(usePipelineStore.getState().edges).toHaveLength(0);
  });

  it("removeNode borra el nodo y las aristas que lo tocan", () => {
    const st = usePipelineStore.getState();
    const p = st.addNode("project", { x: 0, y: 0 });
    const a = st.addNode("promptAgent", { x: 0, y: 120 });
    usePipelineStore.getState().onConnect(conn(p, a));

    usePipelineStore.getState().removeNode(a);

    const after = usePipelineStore.getState();
    expect(after.nodes.map((n) => n.id)).toEqual([p]);
    expect(after.edges).toHaveLength(0);
  });
});

const imgConn = (source: string, video: string) => ({
  source,
  target: video,
  sourceHandle: null,
  targetHandle: "images",
});

describe("pipelineStore: nodo Video e imageOrder", () => {
  it("conectar imágenes al handle 'images' llena imageOrder en orden", () => {
    const st = usePipelineStore.getState();
    const i1 = st.addNode("image", { x: 0, y: 0 });
    const i2 = st.addNode("asset", { x: 120, y: 0 });
    const v = st.addNode("video", { x: 0, y: 200 });

    usePipelineStore.getState().onConnect(imgConn(i1, v));
    usePipelineStore.getState().onConnect(imgConn(i2, v));

    const vid = usePipelineStore.getState().nodes.find((n) => n.id === v)!;
    expect(vid.data.imageOrder).toEqual([i1, i2]);
  });

  it("desconectar una imagen la quita de imageOrder", () => {
    const st = usePipelineStore.getState();
    const i1 = st.addNode("image", { x: 0, y: 0 });
    const i2 = st.addNode("image", { x: 120, y: 0 });
    const v = st.addNode("video", { x: 0, y: 200 });
    usePipelineStore.getState().onConnect(imgConn(i1, v));
    usePipelineStore.getState().onConnect(imgConn(i2, v));

    const edge = usePipelineStore.getState().edges.find((e) => e.source === i1)!;
    usePipelineStore.getState().onEdgesChange([{ type: "remove", id: edge.id }]);

    const vid = usePipelineStore.getState().nodes.find((n) => n.id === v)!;
    expect(vid.data.imageOrder).toEqual([i2]);
  });

  it("removeNode de una imagen la quita de imageOrder del video", () => {
    const st = usePipelineStore.getState();
    const i1 = st.addNode("image", { x: 0, y: 0 });
    const i2 = st.addNode("image", { x: 120, y: 0 });
    const v = st.addNode("video", { x: 0, y: 200 });
    usePipelineStore.getState().onConnect(imgConn(i1, v));
    usePipelineStore.getState().onConnect(imgConn(i2, v));

    usePipelineStore.getState().removeNode(i1);

    const vid = usePipelineStore.getState().nodes.find((n) => n.id === v)!;
    expect(vid.data.imageOrder).toEqual([i2]);
  });

  it("rechaza conectar texto al handle 'images' (tipo incompatible)", () => {
    const st = usePipelineStore.getState();
    const p = st.addNode("project", { x: 0, y: 0 });
    const v = st.addNode("video", { x: 0, y: 200 });
    usePipelineStore.getState().onConnect(imgConn(p, v)); // project=text -> images=url: inválido

    expect(usePipelineStore.getState().edges).toHaveLength(0);
    const vid = usePipelineStore.getState().nodes.find((n) => n.id === v)!;
    expect(vid.data.imageOrder).toEqual([]);
  });
});
