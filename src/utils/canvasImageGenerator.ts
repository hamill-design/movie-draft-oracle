interface TeamScore {
  playerName: string;
  picks: any[];
  averageScore: number;
  completedPicks: number;
  totalPicks: number;
}

interface ShareCardData {
  draftTitle: string;
  teamScores: TeamScore[];
}

export const generateShareImageCanvas = (data: ShareCardData): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  // Set canvas dimensions for Instagram story (9:16 aspect ratio)
  canvas.width = 1080;
  canvas.height = 1920;
  
  // Create gradient background
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, 'hsl(262.1 83.3% 57.8%)'); // primary
  gradient.addColorStop(1, 'hsl(346.8 77.2% 49.8%)'); // secondary
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  let y = 80; // Starting Y position
  
  // Header
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.font = 'bold 64px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🎬 CineDraft', canvas.width / 2, y);
  
  y += 40;
  ctx.font = '32px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillText('The Ultimate Movie Draft Experience', canvas.width / 2, y);
  
  y += 120;
  
  // Draft Title
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.font = 'bold 72px Inter, sans-serif';
  const maxTitleWidth = canvas.width - 160;
  const titleLines = wrapText(ctx, data.draftTitle, maxTitleWidth);
  
  titleLines.forEach(line => {
    ctx.fillText(line, canvas.width / 2, y);
    y += 80;
  });
  
  y += 60;
  
  // Divider
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(canvas.width / 2 - 80, y, 160, 8);
  
  y += 100;
  
  const winner = data.teamScores[0];
  const topPick = winner?.picks
    .filter(pick => pick.calculated_score !== null)
    .sort((a, b) => (b.calculated_score || 0) - (a.calculated_score || 0))[0];
  
  // Winner Section
  if (winner) {
    // Winner background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(80, y - 40, canvas.width - 160, 280);
    
    y += 20;
    
    // Trophy and Champion text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '36px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🏆 CHAMPION', 120, y);
    
    y += 60;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.font = 'bold 64px Inter, sans-serif';
    ctx.fillText(winner.playerName, 120, y);
    
    y += 80;
    
    // Score and movies
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '28px Inter, sans-serif';
    ctx.fillText('Final Score', 120, y);
    
    ctx.textAlign = 'right';
    ctx.fillText('Movies Drafted', canvas.width - 120, y);
    
    y += 50;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.font = 'bold 80px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(winner.averageScore.toFixed(1), 120, y);
    
    ctx.textAlign = 'right';
    ctx.font = 'bold 64px Inter, sans-serif';
    ctx.fillText(winner.totalPicks.toString(), canvas.width - 120, y);
    
    y += 120;
  }
  
  // Top Pick Section
  if (topPick) {
    // Top pick background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(80, y - 40, canvas.width - 160, 200);
    
    y += 20;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '36px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('⭐ POWER PICK', 120, y);
    
    y += 70;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.font = 'bold 48px Inter, sans-serif';
    const movieLines = wrapText(ctx, topPick.movie_title, canvas.width - 240);
    movieLines.slice(0, 2).forEach(line => {
      ctx.fillText(line, 120, y);
      y += 55;
    });
    
    y += 20;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '32px Inter, sans-serif';
    ctx.fillText(`${topPick.calculated_score?.toFixed(1)} points`, 120, y);
    
    y += 100;
  }
  
  // Leaderboard
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = '36px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🏆 FINAL RANKINGS', 120, y);
  
  y += 80;
  
  const medals = ['🥇', '🥈', '🥉'];
  data.teamScores.slice(0, 3).forEach((team, index) => {
    // Leaderboard item background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(80, y - 35, canvas.width - 160, 100);
    
    // Medal
    ctx.font = '64px Inter, sans-serif';
    ctx.fillText(medals[index], 120, y + 10);
    
    // Player name
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.font = '40px Inter, sans-serif';
    ctx.fillText(team.playerName, 220, y + 10);
    
    // Score
    ctx.font = 'bold 48px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(team.averageScore.toFixed(1), canvas.width - 120, y + 10);
    
    ctx.textAlign = 'left';
    y += 120;
  });
  
  if (data.teamScores.length > 3) {
    y += 40;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '28px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`+${data.teamScores.length - 3} more competitors`, canvas.width / 2, y);
  }
  
  // Footer
  y = canvas.height - 200;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(120, y);
  ctx.lineTo(canvas.width - 120, y);
  ctx.stroke();
  
  y += 60;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '32px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Create your own movie draft', canvas.width / 2, y);
  
  y += 50;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = 'bold 36px Inter, sans-serif';
  ctx.fillText('#CineDraft #MovieDraft', canvas.width / 2, y);
  
  return canvas;
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}