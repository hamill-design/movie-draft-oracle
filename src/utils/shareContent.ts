import { calculateDetailedScore } from '@/utils/scoreCalculator';
import type { ShareImageData, ShareScoredMovie, ShareVariant } from '@/utils/svgImageTemplate';

export type { ShareVariant, ShareFormat } from '@/utils/svgImageTemplate';

/** A draft pick as stored/loaded on the Final Scores page (snake_case DB shape). */
export interface SharePick {
  movie_title: string;
  player_name: string;
  pick_order?: number;
  category?: string;
  poster_path?: string | null;
  movie_year?: number;
  movie_genre?: string;
  movie_budget?: number;
  movie_revenue?: number;
  rt_critics_score?: number;
  rt_audience_score?: number;
  metacritic_score?: number;
  imdb_rating?: number;
  oscar_status?: string;
  calculated_score?: number;
}

export interface ShareTeamScore {
  playerName: string;
  averageScore: number;
  completedPicks: number;
  totalPicks: number;
}

export interface BuildShareContentArgs {
  variant: ShareVariant;
  draftTitle: string;
  draftId: string;
  picks: SharePick[];
  teamScores: ShareTeamScore[];
  /** my-team: which player to feature (defaults to the leader). */
  focusPlayer?: string;
  /** full-list: show the "Vote now" CTA when public voting is open. */
  votingOpen?: boolean;
}

export interface ShareContent {
  /** Data for the SVG renderer. */
  imageData: ShareImageData;
  /** Pre-filled post text (does NOT include the URL — share targets append it per platform). */
  caption: string;
  /** Public link to the draft's final scores. */
  url: string;
  /** Title for the native share sheet. */
  shareTitle: string;
}

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

const hasScoringData = (p: SharePick): boolean =>
  Boolean(p.movie_budget || p.rt_critics_score || p.imdb_rating || p.metacritic_score);

/** Recalculate a pick's score with the live scoring logic (matches the Final Scores page). */
export const scorePick = (p: SharePick): number => {
  if (!hasScoringData(p)) return 0;
  const breakdown = calculateDetailedScore({
    budget: p.movie_budget,
    revenue: p.movie_revenue,
    rtCriticsScore: p.rt_critics_score,
    rtAudienceScore: p.rt_audience_score,
    metacriticScore: p.metacritic_score,
    imdbRating: p.imdb_rating,
    oscarStatus: p.oscar_status,
  });
  return breakdown.finalScore;
};

const toScoredMovie = (p: SharePick): ShareScoredMovie => ({
  title: p.movie_title,
  score: scorePick(p),
  playerName: p.player_name,
  poster: p.poster_path ? `${TMDB_IMAGE_BASE}${p.poster_path}` : undefined,
  year: p.movie_year,
  genre: p.movie_genre,
  category: p.category,
  pickNumber: p.pick_order,
});

const byPickOrder = (a: ShareScoredMovie, b: ShareScoredMovie): number =>
  (a.pickNumber ?? Number.MAX_SAFE_INTEGER) - (b.pickNumber ?? Number.MAX_SAFE_INTEGER);

/** Public final-scores link (the page renders voting UI for `?public=true` when voting is open). */
export const buildPublicScoresUrl = (draftId: string): string =>
  `${window.location.origin}/final-scores/${draftId}?public=true`;

const quote = (s: string) => `“${s}”`;

export const buildShareContent = (args: BuildShareContentArgs): ShareContent => {
  const { variant, draftTitle, draftId, picks, teamScores, focusPlayer, votingOpen } = args;
  const url = buildPublicScoresUrl(draftId);
  const shareTitle = `${draftTitle} — Movie Drafter`;

  const scoredMovies = picks.map(toScoredMovie);

  if (variant === 'my-team') {
    const player = focusPlayer || teamScores[0]?.playerName || picks[0]?.player_name || 'Player';
    const focusPlayerScore =
      teamScores.find((t) => t.playerName === player)?.averageScore ?? 0;
    const focusPlayerPicks = scoredMovies
      .filter((m) => m.playerName === player)
      .sort(byPickOrder);

    return {
      imageData: {
        title: draftTitle,
        teamScores,
        totalMovies: picks.length,
        variant,
        focusPlayer: player,
        focusPlayerScore,
        focusPlayerPicks,
      },
      caption: `Check out ${player}'s picks in the ${quote(draftTitle)} movie draft 🎬`,
      url,
      shareTitle,
    };
  }

  if (variant === 'full-list') {
    const allPicks = [...scoredMovies].sort(byPickOrder);
    const caption = votingOpen
      ? `Vote on our ${quote(draftTitle)} movie draft! 🗳️ Cast your vote:`
      : `Here's our full ${quote(draftTitle)} movie draft board 🎬`;

    return {
      imageData: {
        title: draftTitle,
        teamScores,
        totalMovies: picks.length,
        variant,
        allPicks,
        voteUrl: url,
        votingOpen,
      },
      caption,
      url,
      shareTitle,
    };
  }

  // leaderboard (default)
  const bestMovie = scoredMovies.length
    ? scoredMovies.reduce((best, m) => (m.score > best.score ? m : best))
    : undefined;
  const firstPick = scoredMovies.find((m) => m.pickNumber === 1);
  const winner = teamScores[0]?.playerName;
  const caption = winner
    ? `${winner} took the crown in the ${quote(draftTitle)} movie draft 🏆 See the final scores:`
    : `Final scores are in for the ${quote(draftTitle)} movie draft 🏆`;

  return {
    imageData: {
      title: draftTitle,
      teamScores,
      totalMovies: picks.length,
      variant: 'leaderboard',
      bestMovie,
      firstPick,
    },
    caption,
    url,
    shareTitle,
  };
};

export interface BuildCarouselArgs {
  draftTitle: string;
  draftId: string;
  picks: SharePick[];
  teamScores: ShareTeamScore[];
  votingOpen?: boolean;
  /** Lead the carousel with the leaderboard slide (default true). */
  leadWithLeaderboard?: boolean;
}

/**
 * A full-roster carousel: an ordered set of slides — optionally the leaderboard first, then one
 * `my-team` slide per player (finish order). Each slide is a complete ShareContent the renderer
 * can turn into its own image. This is how large rosters stay legible instead of cramming.
 */
export const buildRosterCarousel = (args: BuildCarouselArgs): ShareContent[] => {
  const { draftTitle, draftId, picks, teamScores, votingOpen, leadWithLeaderboard = true } = args;
  const ordered = [...teamScores].sort((a, b) => b.averageScore - a.averageScore);

  const slides: ShareContent[] = [];
  if (leadWithLeaderboard) {
    slides.push(buildShareContent({ variant: 'leaderboard', draftTitle, draftId, picks, teamScores, votingOpen }));
  }
  for (const team of ordered) {
    slides.push(
      buildShareContent({
        variant: 'my-team',
        draftTitle,
        draftId,
        picks,
        teamScores,
        focusPlayer: team.playerName,
        votingOpen,
      })
    );
  }
  return slides;
};
