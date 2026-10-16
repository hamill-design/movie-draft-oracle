// Same logic as tieRanksForStandings in the web app's src/lib/leagueDraftMetrics.ts.
// Competition rank with ties (e.g. 1, 1, 3) by total_score then raw_score.
export function tieRanksForStandings(
  standings: { total_score: number; raw_score: number }[],
): number[] {
  const ranks: number[] = [];
  for (let i = 0; i < standings.length; i++) {
    if (i === 0) {
      ranks.push(1);
      continue;
    }
    const prev = standings[i - 1];
    const curr = standings[i];
    if (curr.total_score === prev.total_score && curr.raw_score === prev.raw_score) {
      ranks.push(ranks[i - 1]);
    } else {
      ranks.push(i + 1);
    }
  }
  return ranks;
}
