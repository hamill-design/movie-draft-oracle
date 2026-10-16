
import { lazy, Suspense } from "react";
import { pages } from "./lazyPages";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider, PendingDraftProcessor } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import AppHeader from "./components/AppHeader";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

const { Index, Auth, ResetPassword, Profile, Admin, FinalScores, VotePage, PrivacyPolicy, TermsOfService, Contact, About, LearnMore, SpecDraftSetup, ThemeDraftSetup, ThemeHubPage, ThemeLandingPage, HowToDraftPage, FAQ, DraftByFilmography, DraftByYear, LeagueHub, LeagueCreate, LeaguePage, LeagueSettings, LeagueJoin, LeagueDraftLobbyPage, News, Blog, BlogPost, DraftSetup, JoinDraft } = pages;

/** DEV-only share-image design sandbox; lazy + gated so it's excluded from production builds. */
const SharePreviewSandbox = import.meta.env.DEV ? lazy(() => import("./pages/SharePreviewSandbox")) : null;

function LegacyThemesSlugRedirect() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/special-draft/${slug}`} replace />;
}

/**
 * Bare `/draft`: a started draft arrives here via `navigate('/draft', { state })`, so when
 * location state is present we render the live board (`Index`); a plain visit (no state) gets
 * the indexable setup landing instead of bouncing to the homepage.
 */
function DraftEntry() {
  const location = useLocation();
  return location.state ? <Index /> : <DraftSetup />;
}

/** Keeps the header/footer in place and holds the page's space while its code chunk loads. */
function RouteFallback() {
  return <div className="min-h-[60vh]" aria-busy="true" />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AuthProvider>
            <BrowserRouter>
            <ScrollToTop />
            <PendingDraftProcessor />
            <div className="flex flex-col min-h-screen">
            <AppHeader />
              <main className="flex-1">
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/draft" element={<DraftEntry />} />
              <Route path="/draft/people/:name/setup" element={<ThemeDraftSetup theme="people" />} />
              <Route path="/draft/year/:year/setup" element={<ThemeDraftSetup theme="year" />} />
              <Route path="/draft/:draftId" element={<Index />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/final-scores/:draftId" element={<FinalScores />} />
              <Route path="/vote/:draftId" element={<VotePage />} />
              <Route path="/join-draft/:draftId" element={<JoinDraft />} />
              <Route path="/join-draft" element={<JoinDraft />} />
              <Route path="/learn-more" element={<LearnMore />} />
              <Route path="/how-to-draft" element={<HowToDraftPage />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/draft-by-filmography" element={<DraftByFilmography />} />
              <Route path="/draft-by-year" element={<DraftByYear />} />
              <Route path="/special-draft" element={<ThemeHubPage />} />
              <Route path="/special-draft/:slug" element={<ThemeLandingPage />} />
              <Route path="/themes" element={<Navigate to="/special-draft" replace />} />
              <Route path="/themes/:slug" element={<LegacyThemesSlugRedirect />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/about" element={<About />} />
              <Route path="/spec-draft/:specDraftSlug/setup" element={<SpecDraftSetup />} />
              <Route path="/league" element={<LeagueHub />} />
              <Route path="/league/create" element={<LeagueCreate />} />
              <Route path="/league/join" element={<LeagueJoin />} />
              <Route path="/league/:leagueId/settings" element={<LeagueSettings />} />
              {/* Legacy redirect — old lobby URLs now point to /draft/:id or the league page */}
              <Route path="/league/:leagueId/lobby/:entryId" element={<LeagueDraftLobbyPage />} />
              <Route path="/league/:leagueId" element={<LeaguePage />} />
              <Route path="/news" element={<News />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              {SharePreviewSandbox && (
                <Route
                  path="/share-preview"
                  element={
                    <Suspense fallback={null}>
                      <SharePreviewSandbox />
                    </Suspense>
                  }
                />
              )}
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
              </main>
            <Footer />
            </div>
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </ErrorBoundary>
);

export default App;
