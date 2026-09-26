import { createTheme, type MantineColorsTuple } from "@mantine/core";

const brandBlue: MantineColorsTuple = [
  "#eef0ff",
  "#dce1ff",
  "#bcc5ff",
  "#99a6ff",
  "#7a8aff",
  "#506DFF",
  "#4560ec",
  "#3b50c4",
  "#30429e",
  "#25347b",
];

const signalGreen: MantineColorsTuple = [
  "#e9fbf3",
  "#d2f5e5",
  "#a7eacb",
  "#78ddb0",
  "#53cd98",
  "#43b991",
  "#35a67d",
  "#278468",
  "#1d6753",
  "#124a3e",
];

const neutralGray: MantineColorsTuple = [
  "#f8f9fa",
  "#f1f3f5",
  "#e9ecef",
  "#dee2e6",
  "#ced4da",
  "#adb5bd",
  "#868e96",
  "#495057",
  "#343a40",
  "#212529",
];

export const prototypeTheme = createTheme({
  primaryColor: "brand",
  colors: { brand: brandBlue, signal: signalGreen, gray: neutralGray },
  fontFamily: "Manrope, sans-serif",
  headings: { fontFamily: "Manrope, sans-serif", fontWeight: "700" },
  defaultRadius: "sm",
  radius: { xs: "2px", sm: "4px", md: "6px", lg: "8px", xl: "12px" },
  primaryShade: { light: 5, dark: 4 },
  focusRing: "auto",
  cursorType: "pointer",
  other: { monoFontFamily: "Space Mono, monospace" },
});
