import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#E1F5EE",
          100: "#B3E6D3",
          200: "#80D5B5",
          300: "#4DC497",
          400: "#26B780",
          500: "#1D9E75",
          600: "#17805E",
          700: "#116247",
          800: "#0B4431",
          900: "#05261B",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
