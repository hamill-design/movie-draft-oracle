
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import AppHeader from "./components/AppHeader";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import Home from "./pages/Home";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import FinalScores from "./pages/FinalScores";
import VotePage from "./pages/VotePage";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Contact from "./pages/Contact";
import About from "./pages/About";
import NotFound from "./pages/NotFound";
import { JoinDraft } from "./pages/JoinDraft";
import LearnMore from "./pages/LearnMore";
import SpecDraftSetup from "./pages/SpecDraftSetup";
import ThemeDraftSetup from "./pages/ThemeDraftSetup";
import ThemeHubPage from "./pages/ThemeHubPage";
import ThemeLandingPage from "./pages/ThemeLandingPage";
import HowToDraftPage from "./pages/HowToDraftPage";
import FAQ from "./pages/FAQ";
import DraftByFilmography from "./pages/DraftByFilmography";
import DraftByYear from "./pages/DraftByYear";
import LeagueCreate from "./pages/LeagueCreate";
import LeaguePage from "./pages/LeaguePage";
import LeagueSettings from "./pages/LeagueSettings";
import LeagueJoin from "./pages/LeagueJoin";
import LeagueDraftLobbyPage from "./pages/LeagueDraftLobbyPage";
import News from "./pages/News";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import DraftSetup from "./pages/DraftSetup";

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
            <div className="flex flex-col min-h-screen">
            <AppHeader />
              <main className="flex-1">
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
              <Route path="/league/create" element={<LeagueCreate />} />
              <Route path="/league/join" element={<LeagueJoin />} />
              <Route path="/league/:leagueId/settings" element={<LeagueSettings />} />
              {/* Legacy redirect — old lobby URLs now point to /draft/:id or the league page */}
              <Route path="/league/:leagueId/lobby/:entryId" element={<LeagueDraftLobbyPage />} />
              <Route path="/league/:leagueId" element={<LeaguePage />} />
              <Route path="/news" element={<News />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
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
