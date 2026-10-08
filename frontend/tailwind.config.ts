import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1440px" },
    },
    extend: {
      colors: {
        /* Spec design tokens — futuristic dark palette */
        background: "#0A0E1A",
        surface: "#111827",
        border: "#1F2937",
        primary: {
          DEFAULT: "#00E5FF",
          foreground: "#0A0E1A",
        },
        success: {
          DEFAULT: "#00FF9D",
          foreground: "#0A0E1A",
        },
        danger: {
          DEFAULT: "#FF3B5C",
          foreground: "#FFFFFF",
        },
        warning: {
          DEFAULT: "#FFB800",
          foreground: "#0A0E1A",
        },
        muted: {
          DEFAULT: "#111827",
          foreground: "#9CA3AF",
        },
        foreground: "#F9FAFB",
        "text-muted": "#9CA3AF",
        card: "#111827",
        accent: "#00E5FF",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(0, 229, 255, 0.3)",
        "glow-sm": "0 0 10px rgba(0, 229, 255, 0.2)",
        "glow-success": "0 0 20px rgba(0, 255, 157, 0.25)",
        "glow-danger": "0 0 20px rgba(255, 59, 92, 0.25)",
      },
      backgroundImage: {
        "ai-gradient": "linear-gradient(135deg, #00E5FF 0%, #7C3AED 50%, #FF3B5C 100%)",
      },
      keyframes: {
        pulse_live: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        flash_up: {
          "0%": { backgroundColor: "rgba(0,255,157,0.25)" },
          "100%": { backgroundColor: "transparent" },
        },
        flash_down: {
          "0%": { backgroundColor: "rgba(255,59,92,0.25)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
      animation: {
        pulse_live: "pulse_live 1.5s ease-in-out infinite",
        flash_up: "flash_up 0.6s ease-out",
        flash_down: "flash_down 0.6s ease-out",
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
