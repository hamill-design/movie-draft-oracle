/**
 * The homepage's year images: a white "20 / 02" style graphic for each year (src/assets/home/year-drafts).
 * Shared by the spinning cube on the homepage and by anything that needs the picture for one draft year
 * (the draft cards, the draft page headers).
 */
const yearSvgModules = import.meta.glob<string>('@/assets/home/year-drafts/*.svg', { eager: true, import: 'default' });

export type YearDraftTile = { label: string; src: string };

/** Every image, including the second design some 1970s years have ("1975-1.svg"). Labels repeat for those. */
export const YEAR_DRAFT_TILES: YearDraftTile[] = Object.entries(yearSvgModules).map(([path, src]) => {
  const file = path.split('/').pop() ?? 'year';
  const label = file.replace(/\.svg$/i, '').replace(/-1$/, '');
  return { label, src };
});

// One image per year: the plain "1975.svg", not the "-1" alternate.
const imageByYear = new Map<string, string>();
for (const [path, src] of Object.entries(yearSvgModules)) {
  const file = path.split('/').pop() ?? '';
  if (/-1\.svg$/i.test(file)) continue;
  imageByYear.set(file.replace(/\.svg$/i, ''), src);
}

/** The image for a draft year ("2002"), or null for a year we have no image for. */
export function yearDraftImage(year: string | number | null | undefined): string | null {
  return imageByYear.get(String(year ?? '').trim()) ?? null;
}
