import React from 'react';

interface TeamScore {
  playerName: string;
  totalScore: number;
  completedPicks: number;
  totalPicks: number;
}

interface Movie {
  title: string;
  score: number;
  playerName: string;
  poster?: string;
  year?: number;
  genre?: string;
  category?: string;
  pickNumber?: number;
}

interface ShareImageData {
  title: string;
  teamScores: TeamScore[];
  totalMovies: number;
  bestMovie?: Movie;
  firstPick?: Movie;
}

interface ShareImageComponentProps {
  data: ShareImageData;
}

const ShareImageComponent: React.FC<ShareImageComponentProps> = ({ data }) => {
  return (
    <div className="w-[1080px] min-h-[1080px] bg-background p-16 font-brockmann">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold text-foreground mb-4 leading-tight">
          {data.title}
        </h1>
        <p className="text-2xl text-muted-foreground font-medium">
          Final Draft Results
        </p>
      </div>

      {/* Team Scores Section */}
      <div className="mb-16">
        <h2 className="text-4xl font-bold text-foreground mb-8 text-center">
          Team Scores
        </h2>
        <div className="grid grid-cols-1 gap-6">
          {data.teamScores
            .sort((a, b) => b.totalScore - a.totalScore)
            .map((team, index) => (
              <div 
                key={team.playerName}
                className="flex items-center justify-between p-6 bg-card rounded-lg border-2 border-border"
              >
                <div className="flex items-center gap-6">
                  <div className="text-3xl font-bold text-foreground bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center">
                    #{index + 1}
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-foreground">
                      {team.playerName}
                    </h3>
                    <p className="text-xl text-muted-foreground">
                      {team.completedPicks} / {team.totalPicks} picks completed
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-bold text-primary">
                    {team.totalScore.toFixed(1)}
                  </div>
                  <p className="text-xl text-muted-foreground">points</p>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Movie Highlights Section */}
      <div className="grid grid-cols-2 gap-12">
        {/* Best Movie */}
        {data.bestMovie && (
          <div className="bg-card p-8 rounded-lg border-2 border-border">
            <h3 className="text-3xl font-bold text-foreground mb-6 text-center">
              🏆 Best Movie
            </h3>
            <div className="text-center">
              {data.bestMovie.poster && (
                <img 
                  src={data.bestMovie.poster}
                  alt={data.bestMovie.title}
                  className="w-32 h-48 object-cover rounded-lg mx-auto mb-4 border-2 border-border"
                />
              )}
              <h4 className="text-2xl font-bold text-foreground mb-2">
                {data.bestMovie.title}
              </h4>
              {data.bestMovie.year && (
                <p className="text-xl text-muted-foreground mb-2">
                  ({data.bestMovie.year})
                </p>
              )}
              <div className="text-3xl font-bold text-primary mb-2">
                {data.bestMovie.score.toFixed(1)} points
              </div>
              <p className="text-lg text-muted-foreground">
                Picked by {data.bestMovie.playerName}
              </p>
              {data.bestMovie.category && (
                <p className="text-sm text-muted-foreground mt-2 bg-secondary/50 px-3 py-1 rounded-full inline-block">
                  {data.bestMovie.category}
                </p>
              )}
            </div>
          </div>
        )}

        {/* First Pick */}
        {data.firstPick && (
          <div className="bg-card p-8 rounded-lg border-2 border-border">
            <h3 className="text-3xl font-bold text-foreground mb-6 text-center">
              🥇 First Pick
            </h3>
            <div className="text-center">
              {data.firstPick.poster && (
                <img 
                  src={data.firstPick.poster}
                  alt={data.firstPick.title}
                  className="w-32 h-48 object-cover rounded-lg mx-auto mb-4 border-2 border-border"
                />
              )}
              <h4 className="text-2xl font-bold text-foreground mb-2">
                {data.firstPick.title}
              </h4>
              {data.firstPick.year && (
                <p className="text-xl text-muted-foreground mb-2">
                  ({data.firstPick.year})
                </p>
              )}
              <div className="text-3xl font-bold text-primary mb-2">
                {data.firstPick.score.toFixed(1)} points
              </div>
              <p className="text-lg text-muted-foreground">
                Picked by {data.firstPick.playerName}
              </p>
              {data.firstPick.category && (
                <p className="text-sm text-muted-foreground mt-2 bg-secondary/50 px-3 py-1 rounded-full inline-block">
                  {data.firstPick.category}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-16 text-center">
        <p className="text-xl text-muted-foreground">
          Total Movies Drafted: {data.totalMovies}
        </p>
        <p className="text-lg text-muted-foreground/70 mt-2">
          Generated by Movie Draft League
        </p>
      </div>
    </div>
  );
};

export default ShareImageComponent;