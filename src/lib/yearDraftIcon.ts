const yearSvgModules = import.meta.glob<string>(
  '@/assets/home/year-drafts/*.svg',
  { eager: true, import: 'default' },
);

const YEAR_ICON_BY_YEAR = new Map<string, string>();

for (const [path, src] of Object.entries(yearSvgModules)) {
  const base = (path.split('/').pop() ?? '').replace(/\.svg$/i, '').replace(/-1$/, '');
  if (!/^\d{4}$/.test(base)) continue;
  const isAlt = path.includes('-1.svg');
  if (!YEAR_ICON_BY_YEAR.has(base) || !isAlt) {
    YEAR_ICON_BY_YEAR.set(base, src);
  }
}

/** Resolve a year-draft SVG from labels like "1971", "1960's", or "Draft 1999". */
export function resolveYearDraftIconSrc(label: string | null | undefined): string | null {
  if (!label?.trim()) return null;
  const match = label.match(/\b(19|20)\d{2}\b/);
  if (!match) return null;
  return YEAR_ICON_BY_YEAR.get(match[0]) ?? null;
}
