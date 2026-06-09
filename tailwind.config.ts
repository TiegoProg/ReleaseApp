import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "ui-sans-serif", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        canvas: "#eef1f8",
        ink: {
          DEFAULT: "#0b1020",
          soft: "#475569",
          mute: "#8a97ad",
          faint: "#cbd5e1",
        },
        surface: {
          DEFAULT: "#ffffff",
          sunken: "#f3f5fb",
        },
        line: "rgba(11,16,32,0.08)",
        // Acentos por área (marca Orbita)
        area: {
          research: "#0ea5e9",
          creative: "#ec4899",
          content: "#8b5cf6",
          media: "#10b981",
          director: "#f59e0b",
        },
        // Estados de agente (versión light)
        status: {
          idle: "#64748b",
          thinking: "#7c3aed",
          tool: "#0891b2",
          waiting: "#d97706",
          done: "#16a34a",
          error: "#dc2626",
        },
      },
      borderRadius: {
        xl: "16px",
        "2xl": "22px",
        "3xl": "28px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(11,16,32,0.04), 0 10px 28px -16px rgba(11,16,32,0.18)",
        lift: "0 2px 6px rgba(11,16,32,0.05), 0 26px 50px -22px rgba(11,16,32,0.30)",
      },
      keyframes: {
        rise: {
          from: { opacity: "0", transform: "translateY(14px) scale(0.985)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        floaty: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-5px)" },
        },
      },
      animation: {
        rise: "rise 0.6s cubic-bezier(0.16,1,0.3,1) both",
        floaty: "floaty 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
