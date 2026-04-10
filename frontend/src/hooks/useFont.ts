const FONT_MAP: Record<string, string> = {
  outfit: "'Outfit', system-ui, sans-serif",
  inter: "'Inter', system-ui, sans-serif",
  bricolage: "'Bricolage Grotesque', system-ui, sans-serif",
};

export function applyFont(font: string): void {
  const value = FONT_MAP[font] ?? FONT_MAP['outfit'];
  document.documentElement.style.setProperty('--font-family-sans', value);
}
