/**
 * Built-in category names from src/config/categoryConfigs.ts (CATEGORY_CONFIGS).
 * Custom actor spec categories are NOT listed here; keep this list in sync when adding global categories.
 */
const GLOBAL_STANDARD = new Set<string>([
  'Action/Adventure',
  'Animated',
  'Comedy',
  'Drama/Romance',
  'Sci-Fi/Fantasy',
  'Horror/Thriller',
  "30's",
  "40's",
  "50's",
  "60's",
  "70's",
  "80's",
  "90's",
  "2000's",
  "2010's",
  "2020's",
  'Academy Award Nominee or Winner',
  'Blockbuster (minimum of $50 Mil)',
  'Sequel',
]);

export function isGlobalStandardCategory(categoryName: string): boolean {
  return GLOBAL_STANDARD.has(categoryName);
}
