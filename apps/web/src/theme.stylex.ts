import * as stylex from "@stylexjs/stylex";

export const colors = stylex.defineVars({
  background: "#030303",
  card: "#090909",
  hover: "#111111",
  surface: "#1a1a1a",
  border: "#27272a",
  foreground: "#ffffff",
  text: "#a1a1aa",
  muted: "#71717a",
  accent: "#0057ff",
  accentText: "#78a5ff",
});

export const lightTheme = stylex.createTheme(colors, {
  background: "#fafafa",
  card: "#ffffff",
  hover: "#f4f4f5",
  surface: "#f0f0f2",
  border: "#d4d4d8",
  foreground: "#09090b",
  text: "#52525b",
  muted: "#62626c",
  accent: "#0057ff",
  accentText: "#004cdd",
});
