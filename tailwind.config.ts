import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "hsl(var(--canvas))",
        ink: "hsl(var(--ink))",
        muted: "hsl(var(--muted))",
        line: "hsl(var(--line))",
        surface: "hsl(var(--surface))",
        accent: "hsl(var(--accent))",
        success: "hsl(var(--success))",
        danger: "hsl(var(--danger))",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Iowan Old Style", "Baskerville", "Georgia", "serif"],
        mono: ["SFMono-Regular", "Consolas", "Liberation Mono", "monospace"],
      },
      boxShadow: {
        soft: "0 18px 55px hsla(var(--shadow), 0.12)",
        lift: "0 8px 24px hsla(var(--shadow), 0.14)",
      },
      keyframes: {
        "word-in": {
          "0%": { opacity: "0", transform: "translateY(8px) scale(.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "pulse-ring": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsla(var(--success), .0)" },
          "50%": { boxShadow: "0 0 0 7px hsla(var(--success), .12)" },
        },
      },
      animation: {
        "word-in": "word-in 320ms cubic-bezier(.2,.8,.2,1) both",
        "pulse-ring": "pulse-ring 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
