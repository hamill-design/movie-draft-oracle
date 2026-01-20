
import { useState, useMemo, useCallback, useEffect } from 'react';

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

  // Initialize player order once when participants change and we don't have an order yet
  useEffect(() => {
    if (initialPlayerOrder.length === 0 && participants && participants.length > 0) {
      // Create new randomized order
      const shuffled = [...participants].sort(() => Math.random() - 0.5);
      const newOrder = shuffled.map((name, index) => ({ id: index, name }));
      setInitialPlayerOrder(newOrder);
    }
  }, [participants, initialPlayerOrder.length]);

  // Create stable randomized players - only randomize once or use existing order
  const randomizedPlayers = useMemo(() => {
    if (initialPlayerOrder.length > 0) {
      // Use existing order if we have one
      return initialPlayerOrder;
    }
    
    if (!participants) return [];
    
    // Return empty array if not initialized yet (will be set by useEffect)
    return [];
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
  // Only consider complete when we have a real draft order and all slots are filled.
  // Avoids a race: on first render, initialPlayerOrder is [] (set async in useEffect),
  // so draftOrder is [] and "0 >= 0" would incorrectly be true, causing saveCompletion
  // to persist is_complete with zero picks.
  const isComplete = draftOrder.length > 0 && currentPickIndex >= draftOrder.length;

  const addPick = (pick: Pick) => {
    const updatedPicks = [...picks, pick];
    setPicks(updatedPicks);
    setCurrentPickIndex(currentPickIndex + 1);
    return updatedPicks;
  };

  const loadExistingPicks = useCallback((existingPicks: any[], originalParticipants?: string[]) => {
    if (existingPicks && existingPicks.length > 0) {
      // Use original participants list if provided, otherwise fall back to extracting from picks
      let playerOrder: Player[];
      
      if (originalParticipants && originalParticipants.length > 0) {
        // Preserve the original participants list to maintain all players
        playerOrder = originalParticipants.map((name, index) => ({
          id: index,
          name
        }));
      } else {
        // Fallback: Extract player order from existing picks (old behavior)
        const playerNames = new Set<string>();
        existingPicks.forEach(pick => playerNames.add(pick.player_name));
        playerOrder = Array.from(playerNames).map((name, index) => ({
          id: index,
          name
        }));
      }
      
      setInitialPlayerOrder(playerOrder);
      
      const convertedPicks: Pick[] = existingPicks.map((pick) => ({
        playerId: playerOrder.find(p => p.name === pick.player_name)?.id || 0,
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
