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
      className={`bg-gradient-to-br from-primary to-secondary text-primary-foreground p-16 shadow-2xl ${className}`}
      style={{ 
        width: '1080px', 
        height: '1920px', 
        aspectRatio: '9/16',
        borderRadius: '0px'
      }}
    >
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-4 mb-4">
          <Film className="w-12 h-12" />
          <h1 className="text-4xl font-bold">CineDraft</h1>
        </div>
        <p className="text-xl opacity-90">The Ultimate Movie Draft Experience</p>
      </div>

      {/* Draft Title */}
      <div className="text-center mb-16">
        <h2 className="text-5xl font-bold mb-6 line-clamp-3 leading-tight">{draftTitle}</h2>
        <div className="w-32 h-2 bg-white/30 mx-auto"></div>
      </div>

      {/* Winner Section */}
      {winner && (
        <div className="bg-white/10 p-8 mb-8 backdrop-blur-sm">
          <div className="flex items-center gap-6 mb-6">
            <Trophy className="w-16 h-16 text-yellow-300" />
            <div>
              <p className="text-2xl opacity-80 font-medium">CHAMPION</p>
              <p className="text-4xl font-bold">{winner.playerName}</p>
            </div>
          </div>
          
          <div className="flex justify-between items-center text-xl">
            <div>
              <p className="opacity-80 text-2xl mb-2">Final Score</p>
              <p className="text-6xl font-bold">{winner.averageScore.toFixed(1)}</p>
            </div>
            <div className="text-right">
              <p className="opacity-80 text-2xl mb-2">Movies Drafted</p>
              <p className="text-4xl font-semibold">{winner.totalPicks}</p>
            </div>
          </div>
        </div>
      )}

      {/* Top Pick */}
      {topPick && (
        <div className="bg-white/10 p-8 mb-12 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-4">
            <Star className="w-10 h-10 text-yellow-300" />
            <p className="text-2xl font-semibold opacity-80">POWER PICK</p>
          </div>
          <p className="font-bold text-3xl line-clamp-2 mb-2">{topPick.movie_title}</p>
          <p className="text-xl opacity-80">{topPick.calculated_score?.toFixed(1)} points</p>
        </div>
      )}

      {/* Leaderboard */}
      <div className="space-y-4">
        <div className="flex items-center gap-4 mb-8">
          <Award className="w-10 h-10" />
          <p className="text-2xl font-semibold opacity-80">FINAL RANKINGS</p>
        </div>
        
        {teamScores.slice(0, 3).map((team, index) => {
          const medals = ['🥇', '🥈', '🥉'];
          return (
            <div key={team.playerName} className="flex justify-between items-center py-6 px-8 bg-white/5">
              <div className="flex items-center gap-6">
                <span className="text-4xl">{medals[index]}</span>
                <span className="font-medium text-2xl">{team.playerName}</span>
              </div>
              <span className="font-bold text-3xl">{team.averageScore.toFixed(1)}</span>
            </div>
          );
        })}
        
        {teamScores.length > 3 && (
          <p className="text-center text-xl opacity-70 mt-6">
            +{teamScores.length - 3} more competitors
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="text-center mt-16 pt-8 border-t border-white/20">
        <p className="text-xl opacity-70 mb-2">Create your own movie draft</p>
        <p className="text-2xl font-semibold">#CineDraft #MovieDraft</p>
      </div>
    </div>
  );
};

export default ShareCard;