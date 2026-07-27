import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces — a clean light workspace with subtle steps.
        canvas: "#F6F7F9",
        surface: "#FFFFFF",
        surface2: "#F9FAFB",
        elevated: "#FFFFFF",
        // Hairlines are cool slate on light — soft etched panel lines.
        hair: "rgba(15,23,42,0.09)",
        hair2: "rgba(15,23,42,0.16)",
        // Brand — a professional indigo. The 300–500 steps are tuned to read
        // as accent text on white; 50–200 are light tints for fills/badges.
        brand: {
          DEFAULT: "#4F46E5",
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#6366F1",
          400: "#4F46E5",
          500: "#4338CA",
          600: "#3730A3",
          700: "#312E81",
          800: "#232065",
          900: "#171449",
        },
        // The component set encodes ink/muted text with the `zinc` scale on a
        // once-dark canvas (zinc-50 = brightest). For light mode we INVERT the
        // scale so the same class names read correctly on white: zinc-50/100
        // become the darkest ink (headings), the mid steps stay muted grays,
        // and the high steps become light fills.
        zinc: {
          50: "#0B0E14",
          100: "#111827",
          200: "#1F2937",
          300: "#374151",
          400: "#4B5563",
          500: "#6B7280",
          600: "#9CA3AF",
          700: "#D1D5DB",
          800: "#E5E7EB",
          900: "#F3F4F6",
          950: "#F9FAFB",
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
        // Quiet panel depth for light surfaces — a hairline plus a soft drop.
        card: "0 1px 2px 0 rgba(15,23,42,0.04), 0 10px 30px -18px rgba(15,23,42,0.18)",
        glow: "0 0 0 1px rgba(79,70,229,0.30), 0 10px 34px -10px rgba(79,70,229,0.35)",
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
