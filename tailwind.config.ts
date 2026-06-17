import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#3b82f6",
        secondary: "#1f2937",
        // Theme tokens driven by CSS variables (set by ThemeProvider).
        brand: "var(--color-primary)",
        brandDark: "var(--color-secondary)",
        accent: "var(--color-accent)",
        themeText: "var(--color-text-primary)",
        themeMuted: "var(--color-text-secondary)",
        themeBorder: "var(--color-border)",
        themeBg: "var(--color-background)",
      },
    },
  },
  plugins: [],
};
export default config;
