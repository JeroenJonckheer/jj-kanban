// Re-export the pure colour helpers so existing component imports keep working.
// The implementations now live in services/colors.ts (unit-tested).
export { hexToRgb, rgba, mix, readableText, normalizeColor, NEUTRAL_LANE_COLOR } from "../services/colors";
