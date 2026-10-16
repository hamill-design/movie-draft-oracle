/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#100029",
        brand: "#7142FF",
        accent: "#907AFF",
        gold: "#FFD60A",
        card: "#1D1D1F",
        surface: "#0E0E0F",
      },
    },
  },
  plugins: [],
};
