import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./types/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: "#12141a",
        panelBorder: "#23262f",
        accent: "#22c55e",
        accentDark: "#16a34a",
      },
    },
  },
  plugins: [],
};
export default config;