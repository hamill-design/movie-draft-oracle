import { useState, useCallback } from 'react';
import { Movie } from '@/data/movies';
import { supabase } from '@/integrations/supabase/client';
import { mergeOscarStatusFromSources } from '@/utils/movieCategoryUtils';

export type DraftBoardPickerState = {
  activeCategory: string | null;
  searchQuery: string;
  selectedMovie: Movie | null;
  checkingOscarStatus: boolean;
};

type UseDraftBoardPickerOptions = {
  isMyTurn: boolean;
  currentPlayerId: number;
  picks: Array<{ playerId: number; category: string }>;
  onSubmit: (movie: Movie, category: string, options?: { houseOverride?: boolean }) => Promise<void>;
};

export function useDraftBoardPicker({
  isMyTurn,
  currentPlayerId,
  picks,
  onSubmit,
}: UseDraftBoardPickerOptions) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [checkingOscarStatus, setCheckingOscarStatus] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const resetPicker = useCallback(() => {
    setActiveCategory(null);
    setSearchQuery('');
    setSelectedMovie(null);
    setCheckingOscarStatus(false);
  }, []);

  const isCategoryAvailable = useCallback(
    (category: string) => {
      return !picks.some((p) => p.playerId === currentPlayerId && p.category === category);
    },
    [picks, currentPlayerId]
  );

  const startSelect = useCallback(
    (category: string) => {
      if (!isMyTurn) return;
      if (!isCategoryAvailable(category)) return;
      setActiveCategory(category);
    },
    [isMyTurn, isCategoryAvailable]
  );

  const cancel = useCallback(() => {
    resetPicker();
  }, [resetPicker]);

  const selectMovie = useCallback(async (movie: Movie) => {
    setSelectedMovie(movie);

    if (!movie.id) {
      setCheckingOscarStatus(false);
      return;
    }

    setCheckingOscarStatus(true);
    try {
      const { data: cached } = await supabase
        .from('oscar_cache')
        .select('oscar_status')
        .eq('tmdb_id', movie.id)
        .maybeSingle();

      if (cached) {
        const merged = mergeOscarStatusFromSources(movie.oscar_status, cached.oscar_status);
        setSelectedMovie({
          ...movie,
          oscar_status: merged.oscar_status,
          hasOscar: merged.hasOscar,
        });
        setCheckingOscarStatus(false);
      } else {
        supabase.functions
          .invoke('enrich-movie-data', {
            body: { movieId: movie.id, movieTitle: movie.title, movieYear: movie.year },
          })
          .then(({ data: enrichmentData }) => {
            if (enrichmentData?.enrichmentData) {
              const fromEnrich =
                enrichmentData.enrichmentData.oscarStatus ||
                enrichmentData.enrichmentData.oscar_status ||
                undefined;
              const merged = mergeOscarStatusFromSources(movie.oscar_status, fromEnrich);
              setSelectedMovie({
                ...movie,
                oscar_status: merged.oscar_status,
                hasOscar: merged.hasOscar,
              });
            }
            setCheckingOscarStatus(false);
          })
          .catch(() => {
            setCheckingOscarStatus(false);
          });
      }
    } catch {
      setCheckingOscarStatus(false);
    }
  }, []);

  const confirmPick = useCallback(async (houseOverride = false) => {
    if (!selectedMovie || !activeCategory || !isMyTurn || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(selectedMovie, activeCategory, { houseOverride });
      resetPicker();
    } finally {
      setSubmitting(false);
    }
  }, [selectedMovie, activeCategory, isMyTurn, submitting, onSubmit, resetPicker]);

  return {
    pickerState: {
      activeCategory,
      searchQuery,
      selectedMovie,
      checkingOscarStatus,
    } satisfies DraftBoardPickerState,
    submitting,
    startSelect,
    cancel,
    selectMovie,
    confirmPick,
    setSearchQuery,
    isCategoryAvailable,
    resetPicker,
  };
}
