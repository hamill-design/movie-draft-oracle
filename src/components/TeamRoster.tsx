
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Trophy } from 'lucide-react';
import { DraftPick } from '@/hooks/useDrafts';
import MovieScoreCard from './MovieScoreCard';
import { getScoreColor, getScoreGrade, calculateDetailedScore } from '@/utils/scoreCalculator';

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
  // Calculate team total score by recalculating each pick's score
  // This ensures we use the current calculation logic (fixed 20/80 weights)
  const recalculatedScores = picks
    .map(pick => {
      const pickWithScoring = pick as any;
      // Only recalculate if we have scoring data
      if (pickWithScoring.movie_budget || pickWithScoring.rt_critics_score || 
          pickWithScoring.imdb_rating || pickWithScoring.metacritic_score || 
          pickWithScoring.letterboxd_rating) {
        const scoringData = {
          budget: pickWithScoring.movie_budget,
          revenue: pickWithScoring.movie_revenue,
          rtCriticsScore: pickWithScoring.rt_critics_score,
          rtAudienceScore: pickWithScoring.rt_audience_score,
          metacriticScore: pickWithScoring.metacritic_score,
          imdbRating: pickWithScoring.imdb_rating,
          letterboxdRating: pickWithScoring.letterboxd_rating,
          oscarStatus: pickWithScoring.oscar_status
        };
        const scoreBreakdown = calculateDetailedScore(scoringData);
        return scoreBreakdown.finalScore;
      }
      return null;
    })
    .filter((score): score is number => score !== null && score !== undefined);
  
  const teamTotal = recalculatedScores.length > 0 
    ? recalculatedScores.reduce((sum: number, score: number) => sum + score, 0)
    : 0;

  const sortedPicks = [...picks].sort((a, b) => a.pick_order - b.pick_order);

  return (
    <div className="space-y-6">
      {/* Individual Movie Cards */}
      <div className="space-y-4">
        {sortedPicks.map((pick) => {
          const pickWithScoring = pick as any; // Type assertion to access new columns
          return (
            <div key={pick.id}>
              <MovieScoreCard
                movieTitle={pick.movie_title}
                movieYear={pick.movie_year}
                movieGenre={pick.movie_genre}
                posterUrl={pick.movie_id ? `https://image.tmdb.org/t/p/w200${pickWithScoring.poster_path || ''}` : null}
                pickNumber={pick.pick_order}
                category={pick.category}
                calculatedScore={pickWithScoring.calculated_score}
                scoringData={{
                  budget: pickWithScoring.movie_budget,
                  revenue: pickWithScoring.movie_revenue,
                  rtCriticsScore: pickWithScoring.rt_critics_score,
                  rtAudienceScore: pickWithScoring.rt_audience_score,
                  metacriticScore: pickWithScoring.metacritic_score,
                  imdbRating: pickWithScoring.imdb_rating,
                  letterboxdRating: pickWithScoring.letterboxd_rating,
                  oscarStatus: pickWithScoring.oscar_status
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TeamRoster;
