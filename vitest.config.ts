import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Tests unitarios de la lógica pura del pipeline UGC (sin red real: fetch se
// mockea). Entorno node; alias @/ por si algún módulo lo usa.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
