
import { useState, useMemo, useCallback } from 'react';

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
  const [initialPlayerOrder, setInitialPlayerOrder] = useState<Player[]>([]);

  // Create stable randomized players - only randomize once or use existing order
  const randomizedPlayers = useMemo(() => {
    if (initialPlayerOrder.length > 0) {
      // Use existing order if we have one
      return initialPlayerOrder;
    }
    
    if (!participants) return [];
    
    // Create new randomized order
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const newOrder = shuffled.map((name, index) => ({ id: index, name }));
    setInitialPlayerOrder(newOrder);
    return newOrder;
  }, [participants, initialPlayerOrder]);

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

  const loadExistingPicks = useCallback((existingPicks: any[]) => {
    if (existingPicks && existingPicks.length > 0) {
      // Extract player order from existing picks to maintain consistency
      const playerNames = new Set<string>();
      existingPicks.forEach(pick => playerNames.add(pick.player_name));
      
      // Create player order based on the saved picks
      const savedPlayerOrder = Array.from(playerNames).map((name, index) => ({
        id: index,
        name
      }));
      
      setInitialPlayerOrder(savedPlayerOrder);
      
      const convertedPicks: Pick[] = existingPicks.map((pick) => ({
        playerId: savedPlayerOrder.find(p => p.name === pick.player_name)?.id || 0,
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
  }, []);

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
