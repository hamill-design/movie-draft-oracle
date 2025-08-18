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

interface ShareImageDebugProps {
  data: ShareImageData;
  visible?: boolean;
}

export const ShareImageDebug: React.FC<ShareImageDebugProps> = ({ data, visible = false }) => {
  const sortedScores = [...data.teamScores].sort((a, b) => b.totalScore - a.totalScore);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      width: '300px',
      backgroundColor: 'white',
      border: '2px solid #000',
      padding: '20px',
      zIndex: 9999,
      maxHeight: '80vh',
      overflow: 'auto'
    }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 'bold' }}>
        Share Image Debug
      </h3>
      
      <div style={{ fontSize: '12px', marginBottom: '10px' }}>
        <strong>Title:</strong> {data.title}
      </div>
      
      <div style={{ fontSize: '12px', marginBottom: '10px' }}>
        <strong>Total Movies:</strong> {data.totalMovies}
      </div>
      
      <div style={{ fontSize: '12px', marginBottom: '10px' }}>
        <strong>Team Scores:</strong>
        {sortedScores.slice(0, 3).map((score, index) => (
          <div key={index} style={{ marginLeft: '10px' }}>
            {index + 1}. {score.playerName}: {score.totalScore} pts
          </div>
        ))}
      </div>
      
      {data.firstPick && (
        <div style={{ fontSize: '12px', marginBottom: '10px' }}>
          <strong>First Pick:</strong> {data.firstPick.title} ({data.firstPick.score} pts)
        </div>
      )}
      
      {data.bestMovie && (
        <div style={{ fontSize: '12px', marginBottom: '10px' }}>
          <strong>Best Movie:</strong> {data.bestMovie.title} ({data.bestMovie.score} pts)
        </div>
      )}
      
      <div style={{ fontSize: '12px', marginTop: '15px' }}>
        <strong>Font Check:</strong>
        <div style={{ fontFamily: 'Chaney', marginTop: '5px' }}>Chaney Font Test</div>
        <div style={{ fontFamily: 'Brockmann', marginTop: '5px' }}>Brockmann Font Test</div>
      </div>
    </div>
  );
};

export default ShareImageDebug;