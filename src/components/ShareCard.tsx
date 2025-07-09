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
      className={`bg-gradient-to-br from-primary to-secondary text-primary-foreground p-4 shadow-2xl ${className}`}
      style={{ 
        width: '270px', 
        height: '480px', 
        aspectRatio: '9/16',
        borderRadius: '0px',
        transform: 'scale(4)',
        transformOrigin: 'top left'
      }}
    >
      {/* Header */}
      <div className="text-center mb-3">
        <div className="flex items-center justify-center gap-1 mb-1">
          <Film className="w-3 h-3" />
          <h1 className="text-xl font-bold">CineDraft</h1>
        </div>
        <p className="text-xs opacity-90">The Ultimate Movie Draft Experience</p>
      </div>

      {/* Draft Title */}
      <div className="text-center mb-4">
        <h2 className="text-lg font-bold mb-2 line-clamp-3 leading-tight">{draftTitle}</h2>
        <div className="w-8 h-0.5 bg-white/30 mx-auto"></div>
      </div>

      {/* Winner Section */}
      {winner && (
        <div className="bg-white/10 p-2 mb-2 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-yellow-300" />
            <div>
              <p className="text-xs opacity-80 font-medium">CHAMPION</p>
              <p className="text-lg font-bold">{winner.playerName}</p>
            </div>
          </div>
          
          <div className="flex justify-between items-center text-xs">
            <div>
              <p className="opacity-80 text-xs mb-1">Final Score</p>
              <p className="text-2xl font-bold">{winner.averageScore.toFixed(1)}</p>
            </div>
            <div className="text-right">
              <p className="opacity-80 text-xs mb-1">Movies Drafted</p>
              <p className="text-lg font-semibold">{winner.totalPicks}</p>
            </div>
          </div>
        </div>
      )}

      {/* Top Pick */}
      {topPick && (
        <div className="bg-white/10 p-2 mb-3 backdrop-blur-sm">
          <div className="flex items-center gap-1 mb-1">
            <Star className="w-3 h-3 text-yellow-300" />
            <p className="text-xs font-semibold opacity-80">POWER PICK</p>
          </div>
          <p className="font-bold text-sm line-clamp-2 mb-1">{topPick.movie_title}</p>
          <p className="text-xs opacity-80">{topPick.calculated_score?.toFixed(1)} points</p>
        </div>
      )}

      {/* Leaderboard */}
      <div className="space-y-1">
        <div className="flex items-center gap-1 mb-2">
          <Award className="w-3 h-3" />
          <p className="text-xs font-semibold opacity-80">FINAL RANKINGS</p>
        </div>
        
        {teamScores.slice(0, 3).map((team, index) => {
          const medals = ['🥇', '🥈', '🥉'];
          return (
            <div key={team.playerName} className="flex justify-between items-center py-1 px-2 bg-white/5">
              <div className="flex items-center gap-2">
                <span className="text-lg">{medals[index]}</span>
                <span className="font-medium text-sm">{team.playerName}</span>
              </div>
              <span className="font-bold text-lg">{team.averageScore.toFixed(1)}</span>
            </div>
          );
        })}
        
        {teamScores.length > 3 && (
          <p className="text-center text-xs opacity-70 mt-2">
            +{teamScores.length - 3} more competitors
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="text-center mt-4 pt-2 border-t border-white/20">
        <p className="text-xs opacity-70 mb-1">Create your own movie draft</p>
        <p className="text-sm font-semibold">#CineDraft #MovieDraft</p>
      </div>
    </div>
  );
};

export default ShareCard;