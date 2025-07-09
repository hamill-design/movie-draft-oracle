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

const APP_NAME = "CineDraft";
const APP_TAGLINE = "🎬 The Ultimate Movie Draft Experience";
const APP_HASHTAGS = "#CineDraft #MovieDraft #Movies #FilmBattle";
const CALL_TO_ACTION = "\n\n🚀 Create your own movie draft battle at";

export const generateShareText = (
  draftTitle: string,
  teamScores: TeamScore[],
  totalPicks: number
): ShareData => {
  if (teamScores.length === 0) {
    return {
      title: `${draftTitle} - ${APP_NAME} Results`,
      text: `${APP_TAGLINE}\n\n🎬 Just completed "${draftTitle}" draft! Check out the epic battle results!\n\n${APP_HASHTAGS}${CALL_TO_ACTION}`,
      url: window.location.href
    };
  }

  const winner = teamScores[0];
  const topPick = winner.picks
    .filter(pick => (pick as any).calculated_score !== null)
    .sort((a, b) => ((b as any).calculated_score || 0) - ((a as any).calculated_score || 0))[0];

  let shareText = `${APP_TAGLINE}\n\n🏆 "${draftTitle}" CHAMPION: ${winner.playerName}!\n`;
  shareText += `📊 Winning Score: ${winner.averageScore.toFixed(1)} points\n`;
  
  if (topPick) {
    const topScore = (topPick as any).calculated_score;
    shareText += `🎯 Power Pick: ${topPick.movie_title} (${topScore?.toFixed(1) || 'N/A'}pts)\n`;
  }
  
  shareText += `\n🏅 FINAL LEADERBOARD:\n`;
  teamScores.slice(0, 3).forEach((team, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    shareText += `${medal} ${team.playerName}: ${team.averageScore.toFixed(1)}pts\n`;
  });
  
  if (teamScores.length > 3) {
    shareText += `...and ${teamScores.length - 3} more competitors!\n`;
  }
  
  shareText += `\n⚡ Think you can draft better? ${APP_HASHTAGS}${CALL_TO_ACTION}`;

  return {
    title: `${draftTitle} - ${APP_NAME} Championship Results`,
    text: shareText,
    url: window.location.href
  };
};

export const generateQuickShareText = (
  draftTitle: string,
  winner: TeamScore
): string => {
  return `${APP_TAGLINE}\n🏆 "${draftTitle}" Champion: ${winner.playerName} (${winner.averageScore.toFixed(1)}pts)\n${APP_HASHTAGS}`;
};

export const generateImageShareText = (
  draftTitle: string,
  teamScores: TeamScore[]
): ShareData => {
  const winner = teamScores[0];
  
  let shareText = `🎬 ${APP_NAME} Championship Results!\n\n`;
  shareText += `🏆 "${draftTitle}"\n`;
  shareText += `👑 Champion: ${winner.playerName}\n`;
  shareText += `📊 Score: ${winner.averageScore.toFixed(1)} points\n\n`;
  shareText += `${APP_HASHTAGS}${CALL_TO_ACTION}`;

  return {
    title: `${draftTitle} - ${APP_NAME} Results`,
    text: shareText,
    url: window.location.href
  };
};