import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces — a cool near-black stack with subtle steps.
        canvas: "#0A0B0E",
        surface: "#101218",
        surface2: "#161922",
        elevated: "#1C2029",
        hair: "rgba(255,255,255,0.07)",
        hair2: "rgba(255,255,255,0.12)",
        // Brand — a soft electric violet.
        brand: {
          DEFAULT: "#7C6CF0",
          50: "#EFEDFE",
          100: "#DED9FD",
          200: "#BDB4FB",
          300: "#9C8EF6",
          400: "#8878F2",
          500: "#7C6CF0",
          600: "#5B47E0",
          700: "#4835C4",
          800: "#372A96",
          900: "#26205E",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
        glow: "0 0 0 1px rgba(124,108,240,0.4), 0 8px 30px -8px rgba(124,108,240,0.45)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
