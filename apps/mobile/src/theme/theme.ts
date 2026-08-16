export const colors = {
  background: "#EBF2F4",
  surface: "#FFFFFF",
  panel: "#FFFFFF",
  text: "#23303A",
  textMuted: "#5C6B73",
  textFaint: "#8A99A1",

  blue: "#535D7B",
  orange: "#E38670",
  reference: "#B8C7CD",

  low: "#E38670",
  high: "#E38670",
  normal: "#535D7B",

  border: "#D7E2E6",
  divider: "#E4EBEE",

  primary: "#535D7B",
  primaryText: "#FFFFFF",
  danger: "#C25B4D",
  ok: "#3E7C5B"
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14
} as const;

export const typography = {
  title: { fontSize: 20, fontWeight: "700" as const },
  heading: { fontSize: 17, fontWeight: "700" as const },
  subheading: { fontSize: 15, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  caption: { fontSize: 13, fontWeight: "400" as const },
  small: { fontSize: 12, fontWeight: "400" as const },
  value: { fontSize: 26, fontWeight: "700" as const }
} as const;

export type InterpretationTone = "low" | "normal" | "high" | "unknown";
