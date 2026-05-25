export const CATEGORY_COLORS = [
  '#a855f7', // purple (primary)
  '#f43f5e', // rose
  '#34d399', // emerald
  '#fbbf24', // amber
  '#38bdf8', // sky
  '#fb923c', // orange
  '#e879f9', // fuchsia
  '#4ade80', // green
];

export function getCategoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

export function labelToColorIndex(label: string | undefined): number {
  if (!label) return 0;
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return hash % CATEGORY_COLORS.length;
}

export function labelToColor(label: string | undefined): string {
  return getCategoryColor(labelToColorIndex(label));
}
