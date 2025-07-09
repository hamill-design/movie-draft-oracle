import React from 'react';
import { Trophy, Star, Award, Film } from 'lucide-react';

interface TeamScore {
  playerName: string;
  picks: any[];
  averageScore: number;
  completedPicks: number;
  totalPicks: number;
}

interface ShareCardProps {
  draftTitle: string;
  teamScores: TeamScore[];
  className?: string;
}

const ShareCard: React.FC<ShareCardProps> = ({ draftTitle, teamScores, className = "" }) => {
  const winner = teamScores[0];
  const topPick = winner?.picks
    .filter(pick => pick.calculated_score !== null)
    .sort((a, b) => (b.calculated_score || 0) - (a.calculated_score || 0))[0];

  return (
    <div 
      className={`bg-gradient-to-br from-primary to-secondary text-primary-foreground p-8 shadow-2xl ${className}`}
      style={{ 
        width: '1080px', 
        height: '1920px', 
        aspectRatio: '9/16',
        borderRadius: '0px'
      }}
    >
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Film className="w-6 h-6" />
          <h1 className="text-lg font-bold">CineDraft</h1>
        </div>
        <p className="text-sm opacity-90">The Ultimate Movie Draft Experience</p>
      </div>

      {/* Draft Title */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold mb-2 line-clamp-2">{draftTitle}</h2>
        <div className="w-16 h-1 bg-white/30 mx-auto"></div>
      </div>

      {/* Winner Section */}
      {winner && (
        <div className="bg-white/10 p-4 mb-4 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-3">
            <Trophy className="w-8 h-8 text-yellow-300" />
            <div>
              <p className="text-sm opacity-80">CHAMPION</p>
              <p className="text-lg font-bold">{winner.playerName}</p>
            </div>
          </div>
          
          <div className="flex justify-between items-center text-sm">
            <div>
              <p className="opacity-80">Final Score</p>
              <p className="text-2xl font-bold">{winner.averageScore.toFixed(1)}</p>
            </div>
            <div className="text-right">
              <p className="opacity-80">Movies Drafted</p>
              <p className="text-lg font-semibold">{winner.totalPicks}</p>
            </div>
          </div>
        </div>
      )}

      {/* Top Pick */}
      {topPick && (
        <div className="bg-white/10 p-4 mb-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-5 h-5 text-yellow-300" />
            <p className="text-sm font-semibold opacity-80">POWER PICK</p>
          </div>
          <p className="font-bold line-clamp-1">{topPick.movie_title}</p>
          <p className="text-sm opacity-80">{topPick.calculated_score?.toFixed(1)} points</p>
        </div>
      )}

      {/* Leaderboard */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-5 h-5" />
          <p className="text-sm font-semibold opacity-80">FINAL RANKINGS</p>
        </div>
        
        {teamScores.slice(0, 3).map((team, index) => {
          const medals = ['🥇', '🥈', '🥉'];
          return (
            <div key={team.playerName} className="flex justify-between items-center py-2 px-3 bg-white/5">
              <div className="flex items-center gap-2">
                <span className="text-lg">{medals[index]}</span>
                <span className="font-medium">{team.playerName}</span>
              </div>
              <span className="font-bold">{team.averageScore.toFixed(1)}</span>
            </div>
          );
        })}
        
        {teamScores.length > 3 && (
          <p className="text-center text-sm opacity-70 mt-2">
            +{teamScores.length - 3} more competitors
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="text-center mt-6 pt-4 border-t border-white/20">
        <p className="text-xs opacity-70">Create your own movie draft</p>
        <p className="text-sm font-semibold">#CineDraft #MovieDraft</p>
      </div>
    </div>
  );
};

export default ShareCard;