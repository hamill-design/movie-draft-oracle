
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Trophy } from 'lucide-react';
import { DraftPick } from '@/hooks/useDrafts';
import MovieScoreCard from './MovieScoreCard';
import { getScoreColor, getScoreGrade } from '@/utils/scoreCalculator';

interface TeamRosterProps {
  playerName: string;
  picks: DraftPick[];
  teamRank?: number;
}

const TeamRoster: React.FC<TeamRosterProps> = ({ 
  playerName, 
  picks, 
  teamRank 
}) => {
  // Calculate team average score - using any to access new columns
  const validScores = picks
    .filter(pick => (pick as any).calculated_score !== null)
    .map(pick => (pick as any).calculated_score!);
  
  const teamAverage = validScores.length > 0 
    ? validScores.reduce((sum: number, score: number) => sum + score, 0) / validScores.length
    : 0;

  const sortedPicks = [...picks].sort((a, b) => a.pick_order - b.pick_order);

  return (
    <div className="space-y-6">
      {/* Team Header */}
      <Card className="bg-gray-800 border-gray-600">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="text-yellow-400" size={24} />
              <div>
                <CardTitle className="text-white text-xl">{playerName}</CardTitle>
                <p className="text-gray-400 text-sm">{picks.length} movies drafted</p>
              </div>
            </div>
            <div className="text-right">
              {teamRank && (
                <div className="flex items-center gap-2 mb-2">
                  <Trophy size={16} className="text-yellow-400" />
                  <span className="text-gray-400 text-sm">Rank #{teamRank}</span>
                </div>
              )}
              <div className={`text-2xl font-bold ${getScoreColor(teamAverage)}`}>
                {teamAverage.toFixed(1)}
              </div>
              <div className="text-gray-400 text-sm">
                Team Average ({getScoreGrade(teamAverage)})
              </div>
            </div>
          </div>
        </CardHeader>
        
        {validScores.length < picks.length && (
          <CardContent>
            <p className="text-yellow-400 text-sm">
              ⚠️ {picks.length - validScores.length} movie(s) still being processed for scoring data
            </p>
          </CardContent>
        )}
      </Card>

      {/* Individual Movie Cards */}
      <div className="space-y-4">
        {sortedPicks.map((pick) => {
          const pickWithScoring = pick as any; // Type assertion to access new columns
          return (
            <div key={pick.id} className="relative">
              <div className="absolute -left-4 top-4 bg-yellow-400 text-black rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                {pick.pick_order}
              </div>
              <MovieScoreCard
                movieTitle={pick.movie_title}
                movieYear={pick.movie_year}
                movieGenre={pick.movie_genre}
                scoringData={{
                  budget: pickWithScoring.movie_budget,
                  revenue: pickWithScoring.movie_revenue,
                  rtCriticsScore: pickWithScoring.rt_critics_score,
                  rtAudienceScore: pickWithScoring.rt_audience_score,
                  metacriticScore: pickWithScoring.metacritic_score,
                  imdbRating: pickWithScoring.imdb_rating,
                  oscarStatus: pickWithScoring.oscar_status
                }}
                className="ml-6"
              />
              <div className="ml-6 mt-2">
                <span className="bg-gray-700 text-yellow-400 px-2 py-1 rounded text-xs font-medium">
                  {pick.category}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TeamRoster;
