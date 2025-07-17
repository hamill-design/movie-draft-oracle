import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Star, DollarSign, Users, Film, Award } from 'lucide-react';
import { calculateDetailedScore, getScoreColor, getScoreGrade, MovieScoringData } from '@/utils/scoreCalculator';
import PickBadge from './PickBadge';
interface MovieScoreCardProps {
  movieTitle: string;
  movieYear?: number | null;
  movieGenre?: string | null;
  scoringData: MovieScoringData;
  posterUrl?: string | null;
  pickNumber?: number;
  category?: string;
  className?: string;
}
const MovieScoreCard: React.FC<MovieScoreCardProps> = ({
  movieTitle,
  movieYear,
  movieGenre,
  scoringData,
  posterUrl,
  pickNumber,
  category,
  className = ''
}) => {
  const scoreBreakdown = calculateDetailedScore(scoringData);
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  const ScoreMetric = ({
    icon: Icon,
    label,
    value,
    maxValue = 100,
    available = true,
    suffix = '',
    color = 'bg-blue-500'
  }: {
    icon: React.ElementType;
    label: string;
    value: number;
    maxValue?: number;
    available?: boolean;
    suffix?: string;
    color?: string;
  }) => <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className={available ? 'text-gray-400' : 'text-gray-600'} />
          <span className={`text-sm ${available ? 'text-white' : 'text-gray-500'}`}>
            {label}
          </span>
        </div>
        <span className={`text-sm font-semibold ${available ? 'text-white' : 'text-gray-500'}`}>
          {available ? `${value}${suffix}` : 'N/A'}
        </span>
      </div>
      {available && <Progress value={value / maxValue * 100} className="h-2" />}
    </div>;
  return <Card className={`bg-gray-800 border-gray-600 ${className}`}>
      <CardHeader>
        {/* Pick Number and Category */}
        {pickNumber && category && <PickBadge pickNumber={pickNumber} category={category} />}
        <div className="flex items-start gap-4">
          {/* Movie Poster */}
          {posterUrl && <div className="flex-shrink-0 w-20 h-30">
              <img src={posterUrl.startsWith('/') ? `https://image.tmdb.org/t/p/w185${posterUrl}` : posterUrl} alt={`${movieTitle} poster`} className="w-full h-full object-cover rounded border border-gray-600" onError={e => {
            e.currentTarget.style.display = 'none';
          }} />
            </div>}
          
          <div className="flex items-center justify-between flex-1">
            <div>
              <CardTitle className="text-white text-lg">{movieTitle}</CardTitle>
              {movieYear && <p className="text-gray-400 text-sm">({movieYear})</p>}
              {movieGenre}
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${getScoreColor(scoreBreakdown.finalScore)}`}>
                {scoreBreakdown.finalScore}
              </div>
              <div className="text-gray-400 text-sm">
                Grade: {getScoreGrade(scoreBreakdown.finalScore)}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Score Breakdown */}
        <div className="space-y-3">
          <h4 className="text-white font-semibold text-sm">Score Breakdown</h4>
          
          <ScoreMetric icon={DollarSign} label="Box Office Profit % (20%)" value={scoreBreakdown.boxOfficeScore} available={scoreBreakdown.availableComponents.includes('Box Office')} suffix="%" color="bg-green-500" />

          <ScoreMetric icon={Star} label="RT Critics (23%)" value={scoreBreakdown.rtCriticsScore} available={scoreBreakdown.availableComponents.includes('RT Critics')} suffix="%" color="bg-red-500" />

          <ScoreMetric icon={Award} label="Metacritic (23%)" value={scoreBreakdown.metacriticScore} available={scoreBreakdown.availableComponents.includes('Metacritic')} suffix="/100" color="bg-purple-500" />

          <ScoreMetric icon={Film} label="IMDB (23%)" value={scoreBreakdown.imdbScore} available={scoreBreakdown.availableComponents.includes('IMDB')} suffix="%" color="bg-yellow-500" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-yellow-400" />
              <span className="text-sm text-white">Oscar Status (10%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">
                +{scoreBreakdown.oscarBonus} pts
              </span>
              <Badge variant={scoringData.oscarStatus === 'winner' ? 'default' : scoringData.oscarStatus === 'nominee' ? 'secondary' : 'outline'} className={scoringData.oscarStatus === 'winner' ? 'bg-yellow-500 text-black' : ''}>
                {scoringData.oscarStatus === 'winner' ? 'Winner' : scoringData.oscarStatus === 'nominee' ? 'Nominee' : 'None'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Raw Data */}
        {(scoringData.budget || scoringData.revenue) && <div className="pt-3 border-t border-gray-600">
            <h4 className="text-white font-semibold text-sm mb-2">Box Office Data</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {scoringData.budget && <div>
                  <span className="text-gray-400">Budget:</span>
                  <span className="text-white ml-2">{formatCurrency(scoringData.budget)}</span>
                </div>}
              {scoringData.revenue && <div>
                  <span className="text-gray-400">Revenue:</span>
                  <span className="text-white ml-2">{formatCurrency(scoringData.revenue)}</span>
                </div>}
            </div>
          </div>}

        {/* Missing Data Warning */}
        {scoreBreakdown.missingComponents.length > 0 && <div className="pt-3 border-t border-gray-600">
            <p className="text-yellow-400 text-xs">
              ⚠️ Missing data: {scoreBreakdown.missingComponents.join(', ')}
            </p>
          </div>}
      </CardContent>
    </Card>;
};
export default MovieScoreCard;