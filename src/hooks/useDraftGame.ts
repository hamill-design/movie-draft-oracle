
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Participant, normalizeParticipants } from '@/types/participant';

interface Player {
  id: number;
  name: string;
  isAI: boolean;
}

interface Pick {
  playerId: number;
  playerName: string;
  movie: any;
  category: string;
}

export const useDraftGame = (participants: string[] | Participant[], categories: string[]) => {
  // Normalize participants to Participant[] format (handles backward compatibility)
  const normalizedParticipants = useMemo(() => normalizeParticipants(participants), [participants]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [currentPickIndex, setCurrentPickIndex] = useState(0);
  const [initialPlayerOrder, setInitialPlayerOrder] = useState<Player[]>([]);

  // Set player order once from the participants passed in.
  // The caller (DraftInterface) is responsible for shuffling new drafts and passing
  // the saved (already-shuffled) order when resuming — so we never re-shuffle here.
  useEffect(() => {
    if (initialPlayerOrder.length === 0 && normalizedParticipants && normalizedParticipants.length > 0) {
      const newOrder = normalizedParticipants.map((participant, index) => ({
        id: index,
        name: participant.name,
        isAI: participant.isAI
      }));
      setInitialPlayerOrder(newOrder);
    }
  }, [normalizedParticipants, initialPlayerOrder.length]);

  // Create stable randomized players - only randomize once or use existing order
  const randomizedPlayers = useMemo(() => {
    if (initialPlayerOrder.length > 0) {
      // Use existing order if we have one
      return initialPlayerOrder;
    }
    
    if (!normalizedParticipants || normalizedParticipants.length === 0) return [];
    
    // Return empty array if not initialized yet (will be set by useEffect)
    return [];
  }, [normalizedParticipants, initialPlayerOrder]);

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

  const addPick = useCallback((pick: Pick) => {
    const updatedPicks = [...picks, pick];
    setPicks(updatedPicks);
    setCurrentPickIndex(currentPickIndex + 1);
    return updatedPicks;
  }, [picks, currentPickIndex]);

  const loadExistingPicks = useCallback((existingPicks: any[], originalParticipants?: string[] | Participant[]) => {
    if (existingPicks && existingPicks.length > 0) {
      // Derive the true draft order from the picks themselves (sorted by pick_order).
      // This is reliable because the picks record who actually went in what slot —
      // unlike the participants field in the DB, which may store the original input order
      // rather than the shuffled draft order.
      const sortedPicks = [...existingPicks].sort((a, b) => (a.pick_order || 0) - (b.pick_order || 0));

      // Extract player names in first-appearance order — that IS the round-0 draft order.
      const seenNames = new Set<string>();
      const orderedNames: string[] = [];
      sortedPicks.forEach(pick => {
        if (!seenNames.has(pick.player_name)) {
          seenNames.add(pick.player_name);
          orderedNames.push(pick.player_name);
        }
      });

      // Add any players who haven't picked yet (they won't appear in picks).
      const allParticipants = normalizeParticipants(originalParticipants || []);
      allParticipants.forEach(p => {
        if (!seenNames.has(p.name)) orderedNames.push(p.name);
      });

      const playerOrder: Player[] = orderedNames.map((name, index) => {
        const participant = allParticipants.find(p => p.name === name);
        return { id: index, name, isAI: participant?.isAI ?? false };
      });

      setInitialPlayerOrder(playerOrder);

      const convertedPicks: Pick[] = sortedPicks.map((pick) => ({
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
