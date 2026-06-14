import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: {
          50: "#fdfaf3",
          100: "#f8f1de",
          200: "#ede0b8",
        },
        ink: {
          900: "#1b1a17",
          700: "#3a362c",
          500: "#6b6456",
        },
        quest: {
          gold: "#c39a2b",
          emerald: "#2f8f6a",
          ruby: "#a83c3c",
          sapphire: "#3964a7",
          amethyst: "#7c4ba0",
        },
      },
      fontFamily: {
        sans: ['"Inter"', '"Noto Sans JP"', "system-ui", "sans-serif"],
        serif: ['"Cormorant Garamond"', '"Noto Serif JP"', "serif"],
      },
      boxShadow: {
        panel: "0 10px 30px -12px rgba(27, 26, 23, 0.18)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(27,26,23,0.05)",
      },
      keyframes: {
        fadeSlideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glow: {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(195,154,43,0.0)" },
          "50%": { boxShadow: "0 0 0 6px rgba(195,154,43,0.18)" },
        },
      },
      animation: {
        "fade-slide-up": "fadeSlideUp 260ms ease-out both",
        glow: "glow 1.6s ease-in-out 1",
      },
    },
  },
  plugins: [],
};

export default config;
