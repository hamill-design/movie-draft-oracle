import { Platform } from "react-native";

// Design constants from the website that can't be expressed as Tailwind classes.

export const colors = {
  ink: "#100029",
  sectionContainer: "#0E0E0F",
  uiPrimary: "#1D1D1F",
  itemStroke: "#49474B",
  buttonStroke: "#666469",
  textPrimary: "#FCFFFF",
  textGrey: "#BDC3C2",
  brand: "#7142FF",
  accent: "#907AFF",
  gold: "#FFD60A",
  goldText: "#2B2D2D",
  purple500: "#680AFF",
  purple800: "#25015E",
  purple850: "#160038",
  purple700: "#3B0394",
};

// MOVIE_DRAFTER_PURPLE_SHELL: linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)
export const gradient = {
  colors: ["#100029", "#160038", "#100029"] as const,
  locations: [0.16, 0.5, 0.83] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

// Section-card glow (web: box-shadow 0px 0px 6px #3B0394) and the heavier lobby/status glow.
export const cardGlow = { boxShadow: "0px 0px 6px #3B0394" } as const;
export const statusGlow = { boxShadow: "0px 0px 13px 12px #680AFF" } as const;

export const fonts = {
  regular: "Brockmann-Regular",
  medium: "Brockmann-Medium",
  semibold: "Brockmann-SemiBold",
  bold: "Brockmann-Bold",
  chaney: "Chaney",
};

// Monospace face for join codes.
export const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) as string;
