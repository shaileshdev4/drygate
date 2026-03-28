/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx,js,jsx}", "./globals.css"],
  theme: {
    extend: {
      colors: {
        bg: "#04050A",
        surface: "#0A0D16",
        "surface-plus": "#111520",
        border: "#1A2035",
        "border-plus": "#263050",
        green: "#05E27A",
        amber: "#FFB020",
        red: "#FF3D3D",
        orange: "#FF6B35",
        purple: "#A855F7",
        blue: "#3B82F6",
        text: "#EDF2F7",
        muted: "#94A3B8",
        "text-muted": "#4A5568",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(rgba(26,32,53,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(26,32,53,0.4) 1px, transparent 1px)",
        "green-glow":
          "radial-gradient(ellipse at center, rgba(5,226,122,0.15) 0%, transparent 70%)",
        "red-glow": "radial-gradient(ellipse at center, rgba(255,61,61,0.15) 0%, transparent 70%)",
        "amber-glow":
          "radial-gradient(ellipse at center, rgba(255,176,32,0.15) 0%, transparent 70%)",
      },
      backgroundSize: {
        "grid-size": "40px 40px",
      },
      animation: {
        "fade-up": "fadeUp 0.4s ease forwards",
        "fade-in": "fadeIn 0.3s ease forwards",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "draw-arc": "drawArc 1.2s ease-out forwards",
        "scan-line": "scanLine 2s linear infinite",
        blink: "blink 1s step-end infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
      boxShadow: {
        "green-glow": "0 0 20px rgba(5,226,122,0.3), 0 0 60px rgba(5,226,122,0.1)",
        "red-glow": "0 0 20px rgba(255,61,61,0.3), 0 0 60px rgba(255,61,61,0.1)",
        "amber-glow": "0 0 20px rgba(255,176,32,0.3), 0 0 60px rgba(255,176,32,0.1)",
        card: "0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)",
      },
    },
  },
  plugins: [],
};
