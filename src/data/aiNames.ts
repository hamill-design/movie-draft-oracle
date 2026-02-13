export const AI_NAMES = [
  "R2-D2",
  "C-3PO",
  "HAL 9000",
  "TARS",
  "Mechagodzilla",
  "R.O.B.",
  "The Think Tank",
  "Chappie",
  "Ultron",
  "J.A.R.V.I.S.",
  "Gort",
  "WALL-E",
  "Mikki",
  "Gigolo Joe",
  "B.R.A.I.N.",
  "T-1000",
  "T-800",
  "The Iron Giant",
];

/**
 * Get a random AI name from the list
 */
export function getRandomAIName(): string {
  const randomIndex = Math.floor(Math.random() * AI_NAMES.length);
  return AI_NAMES[randomIndex];
}
