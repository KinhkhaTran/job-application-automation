import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces — a cool slate instrument panel with subtle steps.
        canvas: "#0B0E13",
        surface: "#111621",
        surface2: "#161C28",
        elevated: "#1C2432",
        // Hairlines are cool slate, not white — etched-panel lines.
        hair: "rgba(148,163,184,0.12)",
        hair2: "rgba(148,163,184,0.22)",
        // Brand — amber CRT phosphor. The "active signal" of the console.
        brand: {
          DEFAULT: "#E8A33D",
          50: "#FBF4E5",
          100: "#F8E8C8",
          200: "#F2D293",
          300: "#EDBB63",
          400: "#E8A33D",
          500: "#DB8F26",
          600: "#B9741C",
          700: "#8E5817",
          800: "#5F3C13",
          900: "#38240D",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      letterSpacing: {
        kicker: "0.18em",
      },
      boxShadow: {
        // Quiet panel depth — a hairline top edge plus a soft drop.
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 10px 30px -18px rgba(0,0,0,0.7)",
        glow: "0 0 0 1px rgba(232,163,61,0.35), 0 10px 34px -10px rgba(232,163,61,0.4)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-signal": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out both",
        "pulse-signal": "pulse-signal 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
