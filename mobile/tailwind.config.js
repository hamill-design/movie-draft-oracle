/** @type {import('tailwindcss').Config} */
// Colours and type match the website (tailwind.config.ts + src/index.css). Hex literals
// instead of CSS variables so nothing silently falls back.
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Existing names used across screens (kept working)
        ink: "#100029",
        brand: "#7142FF",
        accent: "#907AFF",
        gold: "#FFD60A",
        card: "#1D1D1F",
        surface: "#0E0E0F",

        "brand-primary": "#7142FF",
        purple: {
          50: "#F8F7FF",
          100: "#EDEBFF",
          150: "#D3CFFF",
          200: "#BCB2FF",
          300: "#907AFF",
          400: "#794DFF",
          500: "#680AFF",
          600: "#5106C9",
          700: "#3B0394",
          800: "#25015E",
          850: "#160038",
          900: "#100029",
        },
        "greyscale-purp": {
          100: "#FDFCFF",
          150: "#ECEBF0",
          200: "#DAD9E0",
          300: "#BEBDC3",
          400: "#9E9CA3",
          500: "#848287",
          600: "#666469",
          700: "#49474B",
          800: "#2C2B2D",
          850: "#1D1D1F",
          900: "#0E0E0F",
        },
        "greyscale-blue": {
          100: "#FCFFFF",
          150: "#EBF0EF",
          200: "#D9E0DF",
          300: "#BDC3C2",
          400: "#9CA3A2",
          500: "#828786",
          600: "#646968",
          700: "#474B4B",
          800: "#2B2D2D",
          900: "#0E0F0F",
        },
        yellow: { 200: "#FFF2B2", 300: "#FFE97A", 400: "#FFDF42", 500: "#FFD60A", 600: "#C9A806", 800: "#5E4F01", 900: "#292200" },
        teal: { 200: "#B2FFEA", 500: "#0AFFBE", 900: "#00291E" },
        "error-red": { 200: "#FFC0C0", 400: "#FF6C6C", 500: "#FF4242", 600: "#CE0606" },
        "positive-green": { 200: "#ADF2CC", 400: "#41DA86", 500: "#13CE66", 900: "#002912" },

        // Figma semantic aliases the web uses via var(--X, #fallback)
        "section-container": "#0E0E0F",
        "ui-primary": "#1D1D1F",
        "ui-pressed": "#25015E",
        "item-stroke": "#49474B",
        "button-stroke": "#666469",
        "text-primary": "#FCFFFF",
        "text-grey": "#BDC3C2",
      },
      // React Native picks a font file per family, not per weight, so each weight is its own family.
      fontFamily: {
        brockmann: ["Brockmann-Regular"],
        "brockmann-medium": ["Brockmann-Medium"],
        "brockmann-semibold": ["Brockmann-SemiBold"],
        "brockmann-bold": ["Brockmann-Bold"],
        chaney: ["Chaney"],
      },
      borderRadius: { card: "8px", control: "2px", tile: "6px" },
    },
  },
  plugins: [],
};
