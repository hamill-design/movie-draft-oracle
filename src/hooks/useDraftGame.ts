
import { useState, useMemo } from 'react';

interface Player {
  id: number;
  name: string;
}

interface Pick {
  playerId: number;
  playerName: string;
  movie: any;
  category: string;
}

export const useDraftGame = (participants: string[], categories: string[]) => {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [currentPickIndex, setCurrentPickIndex] = useState(0);

  // Randomize player order and create snake draft order
  const randomizedPlayers = useMemo(() => {
    if (!participants) return [];
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    return shuffled.map((name, index) => ({ id: index, name }));
  }, [participants]);

  // Create snake draft order (1,2,3,4,4,3,2,1,1,2,3,4...)
  const draftOrder = useMemo(() => {
    if (!randomizedPlayers.length || !categories) return [];
    
    const numPlayers = randomizedPlayers.length;
    const numCategories = categories.length;
    const order = [];
    
    for (let round = 0; round < numCategories; round++) {
      if (round % 2 === 0) {
        // Forward order
        for (let i = 0; i < numPlayers; i++) {
          order.push({ ...randomizedPlayers[i], round, pick: order.length + 1 });
        }
      } else {
        // Reverse order
        for (let i = numPlayers - 1; i >= 0; i--) {
          order.push({ ...randomizedPlayers[i], round, pick: order.length + 1 });
        }
      }
    }
    
    return order;
  }, [randomizedPlayers, categories]);

  const currentPlayer = draftOrder[currentPickIndex];
  const isComplete = currentPickIndex >= draftOrder.length;

  const addPick = (pick: Pick) => {
    const updatedPicks = [...picks, pick];
    setPicks(updatedPicks);
    setCurrentPickIndex(currentPickIndex + 1);
    return updatedPicks;
  };

  const loadExistingPicks = (existingPicks: any[]) => {
    if (existingPicks && existingPicks.length > 0) {
      const convertedPicks: Pick[] = existingPicks.map((pick) => ({
        playerId: pick.player_id,
        playerName: pick.player_name,
        movie: {
          id: pick.movie_id,
          title: pick.movie_title,
          year: pick.movie_year,
          genre: pick.movie_genre
        },
        category: pick.category
      }));
      
      setPicks(convertedPicks);
      setCurrentPickIndex(convertedPicks.length);
    }
  };

  return {
    picks,
    currentPickIndex,
    currentPlayer,
    isComplete,
    randomizedPlayers,
    draftOrder,
    addPick,
    loadExistingPicks
  };
};
