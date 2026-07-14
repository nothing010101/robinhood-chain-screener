import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0a0d0a",
        panel: "#11150f",
        line: "#1f2a1c",
        acid: "#c8ff4d",
        acid2: "#8bd63a",
        bear: "#ff5d5d",
        ink: "#e9f2df",
        muted: "#8b9a83",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(200,255,77,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(200,255,77,0.05) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};

export default config;
