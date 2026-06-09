import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Estados de los agentes en la orbita
        agent: {
          idle: "#64748b",      // slate-500
          thinking: "#a855f7",  // purple-500
          tool: "#22d3ee",      // cyan-400
          waiting: "#f59e0b",   // amber-500
          done: "#22c55e",      // green-500
          error: "#ef4444",     // red-500
        },
      },
      fontFamily: {
        sans: ["var(--font-geist)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        pulseLink: {
          "0%, 100%": { opacity: "0.15" },
          "50%": { opacity: "0.9" },
        },
        floaty: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
      animation: {
        pulseLink: "pulseLink 1.4s ease-in-out infinite",
        floaty: "floaty 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
