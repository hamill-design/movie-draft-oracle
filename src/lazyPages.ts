import { lazy, type ComponentType } from 'react';
import { matchPath } from 'react-router-dom';

type PageModule = { default: ComponentType<any> };
type Loader = () => Promise<PageModule>;

/**
 * A new deploy renames the hashed chunk files, so a tab opened before the deploy can fail to
 * fetch one. Reload once (guarded by sessionStorage) to pick up the new build instead of
 * leaving the user on an error screen.
 */
function withReloadOnChunkError(loader: Loader): Loader {
  return () =>
    loader().catch((err) => {
      try {
        const key = 'chunk-reload-at';
        const last = Number(sessionStorage.getItem(key) || 0);
        if (Date.now() - last > 10_000) {
          sessionStorage.setItem(key, String(Date.now()));
          window.location.reload();
          return new Promise<PageModule>(() => {});
        }
      } catch {
        /* storage unavailable: fall through to the error */
      }
      throw err;
    });
}

// One entry per code-split page: the route pattern(s) it serves plus its loader.
// Calling the loader early (preload) warms the chunk so navigating there is instant.
const loaders = {
  Index: () => import('./pages/Index'),
  DraftSetup: () => import('./pages/DraftSetup'),
  Auth: () => import('./pages/Auth'),
  ResetPassword: () => import('./pages/ResetPassword'),
  Profile: () => import('./pages/Profile'),
  Admin: () => import('./pages/Admin'),
  FinalScores: () => import('./pages/FinalScores'),
  VotePage: () => import('./pages/VotePage'),
  JoinDraft: () => import('./pages/JoinDraft').then((m) => ({ default: m.JoinDraft })),
  LearnMore: () => import('./pages/LearnMore'),
  HowToDraftPage: () => import('./pages/HowToDraftPage'),
  FAQ: () => import('./pages/FAQ'),
  DraftByFilmography: () => import('./pages/DraftByFilmography'),
  DraftByYear: () => import('./pages/DraftByYear'),
  ThemeHubPage: () => import('./pages/ThemeHubPage'),
  ThemeLandingPage: () => import('./pages/ThemeLandingPage'),
  ThemeDraftSetup: () => import('./pages/ThemeDraftSetup'),
  SpecDraftSetup: () => import('./pages/SpecDraftSetup'),
  PrivacyPolicy: () => import('./pages/PrivacyPolicy'),
  TermsOfService: () => import('./pages/TermsOfService'),
  Contact: () => import('./pages/Contact'),
  About: () => import('./pages/About'),
  LeagueHub: () => import('./pages/LeagueHub'),
  LeagueCreate: () => import('./pages/LeagueCreate'),
  LeagueJoin: () => import('./pages/LeagueJoin'),
  LeagueSettings: () => import('./pages/LeagueSettings'),
  LeagueDraftLobbyPage: () => import('./pages/LeagueDraftLobbyPage'),
  LeaguePage: () => import('./pages/LeaguePage'),
  News: () => import('./pages/News'),
  Blog: () => import('./pages/Blog'),
  BlogPost: () => import('./pages/BlogPost'),
} satisfies Record<string, Loader>;

type PageName = keyof typeof loaders;

const wrapped = Object.fromEntries(
  Object.entries(loaders).map(([name, loader]) => [name, withReloadOnChunkError(loader)])
) as Record<PageName, Loader>;

export const pages = Object.fromEntries(
  (Object.keys(wrapped) as PageName[]).map((name) => [name, lazy(wrapped[name])])
) as Record<PageName, ReturnType<typeof lazy>>;

/** Route pattern -> page, mirroring the <Route> table in App.tsx (first match wins). */
const routePages: Array<[string, PageName]> = [
  ['/auth', 'Auth'],
  ['/reset-password', 'ResetPassword'],
  ['/draft', 'DraftSetup'],
  ['/draft/people/:name/setup', 'ThemeDraftSetup'],
  ['/draft/year/:year/setup', 'ThemeDraftSetup'],
  ['/draft/:draftId', 'Index'],
  ['/profile', 'Profile'],
  ['/admin', 'Admin'],
  ['/final-scores/:draftId', 'FinalScores'],
  ['/vote/:draftId', 'VotePage'],
  ['/join-draft/:draftId', 'JoinDraft'],
  ['/join-draft', 'JoinDraft'],
  ['/learn-more', 'LearnMore'],
  ['/how-to-draft', 'HowToDraftPage'],
  ['/faq', 'FAQ'],
  ['/draft-by-filmography', 'DraftByFilmography'],
  ['/draft-by-year', 'DraftByYear'],
  ['/special-draft', 'ThemeHubPage'],
  ['/special-draft/:slug', 'ThemeLandingPage'],
  ['/privacy-policy', 'PrivacyPolicy'],
  ['/terms-of-service', 'TermsOfService'],
  ['/contact', 'Contact'],
  ['/about', 'About'],
  ['/spec-draft/:specDraftSlug/setup', 'SpecDraftSetup'],
  ['/league', 'LeagueHub'],
  ['/league/create', 'LeagueCreate'],
  ['/league/join', 'LeagueJoin'],
  ['/league/:leagueId/settings', 'LeagueSettings'],
  ['/league/:leagueId/lobby/:entryId', 'LeagueDraftLobbyPage'],
  ['/league/:leagueId', 'LeaguePage'],
  ['/news', 'News'],
  ['/blog', 'Blog'],
  ['/blog/:slug', 'BlogPost'],
];

/**
 * Start loading the page chunk for `pathname` and resolve when it's ready. Awaited before the
 * first render so a hard load of a prerendered URL keeps showing its static HTML until the page
 * code is in, rather than flashing a loading state.
 */
export function preloadRoute(pathname: string): Promise<unknown> {
  const hit = routePages.find(([pattern]) => matchPath({ path: pattern, end: true }, pathname));
  return hit ? wrapped[hit[1]]().catch(() => undefined) : Promise.resolve();
}

/** After first paint, quietly fetch the pages a visitor is most likely to open next. */
export function prefetchLikelyPages(): void {
  const run = () => {
    (['Index', 'DraftSetup', 'ThemeLandingPage', 'HowToDraftPage', 'LeagueHub', 'Auth'] as PageName[]).forEach(
      (name) => void wrapped[name]().catch(() => undefined)
    );
  };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
    .requestIdleCallback;
  if (ric) ric(run, { timeout: 5000 });
  else setTimeout(run, 3000);
}
