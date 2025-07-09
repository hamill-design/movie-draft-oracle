import { DraftPick } from '@/hooks/useDrafts';

interface TeamScore {
  playerName: string;
  picks: DraftPick[];
  averageScore: number;
  completedPicks: number;
  totalPicks: number;
}

interface ShareData {
  title: string;
  text: string;
  url: string;
}

export const generateShareText = (
  draftTitle: string,
  teamScores: TeamScore[],
  totalPicks: number
): ShareData => {
  if (teamScores.length === 0) {
    return {
      title: `${draftTitle} - Movie Draft Results`,
      text: `🎬 Just finished our Movie Draft: "${draftTitle}"! Check out the results! #MovieDraft`,
      url: window.location.href
    };
  }

  const winner = teamScores[0];
  const topPick = winner.picks
    .filter(pick => (pick as any).calculated_score !== null)
    .sort((a, b) => ((b as any).calculated_score || 0) - ((a as any).calculated_score || 0))[0];

  let shareText = `🏆 Just finished our Movie Draft: "${draftTitle}"!\n\n`;
  shareText += `Winner: ${winner.playerName} (${winner.averageScore.toFixed(1)} avg)`;
  
  if (topPick) {
    const topScore = (topPick as any).calculated_score;
    shareText += `\nTop pick: ${topPick.movie_title} (${topScore?.toFixed(1) || 'N/A'}pts)`;
  }
  
  shareText += `\n\nFinal Rankings:`;
  teamScores.slice(0, 3).forEach((team, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    shareText += `\n${medal} ${team.playerName}: ${team.averageScore.toFixed(1)}`;
  });
  
  if (teamScores.length > 3) {
    shareText += `\n...and ${teamScores.length - 3} more!`;
  }
  
  shareText += `\n\n#MovieDraft #Movies`;

  return {
    title: `${draftTitle} - Movie Draft Results`,
    text: shareText,
    url: window.location.href
  };
};

export const generateQuickShareText = (
  draftTitle: string,
  winner: TeamScore
): string => {
  return `🎬 "${draftTitle}" Movie Draft Results!\n🏆 Winner: ${winner.playerName} (${winner.averageScore.toFixed(1)} avg)\n#MovieDraft`;
};