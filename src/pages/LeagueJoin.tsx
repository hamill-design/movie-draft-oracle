import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Trophy, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLeagueActions } from '@/hooks/useLeagues';
import { MOVIE_DRAFTER_PURPLE_SHELL } from '@/lib/pageGradients';

type State = 'loading' | 'joining' | 'success' | 'error' | 'needs-auth';

const LeagueJoin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { acceptInviteByToken } = useLeagueActions();

  const token = searchParams.get('token');
  const [state, setState] = useState<State>('loading');
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!token) {
      setState('error');
      setErrorMsg('Invalid invite link — no token found.');
      return;
    }

    if (!user) {
      setState('needs-auth');
      return;
    }

    const join = async () => {
      setState('joining');
      const id = await acceptInviteByToken(token);
      if (id) {
        setLeagueId(id);
        setState('success');
      } else {
        setState('error');
        setErrorMsg('This invite link is invalid, has already been used, or has expired.');
      }
    };

    join();
  }, [authLoading, user, token]);

  return (
    <>
      <Helmet>
        <title>Join League — Movie Drafter</title>
      </Helmet>

      <div
        className="min-h-screen flex items-center justify-center p-4 font-brockmann text-greyscale-blue-100"
        style={{ background: MOVIE_DRAFTER_PURPLE_SHELL }}
      >
        <Card className="w-full max-w-md border-border shadow-md">
          <CardContent className="pt-8 pb-8 px-6 text-center space-y-6">
            {state === 'loading' && (
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" aria-hidden />
            )}

            {state === 'joining' && (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" aria-hidden />
                <p className="text-muted-foreground text-sm font-brockmann m-0">Joining league…</p>
              </>
            )}

            {state === 'needs-auth' && (
              <>
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Trophy className="w-7 h-7 text-primary" aria-hidden />
                </div>
                <div className="space-y-2">
                  <h1 className="text-xl font-semibold font-brockmann tracking-tight text-foreground m-0">
                    You&apos;ve been invited to a league
                  </h1>
                  <p className="text-sm text-muted-foreground font-brockmann m-0">
                    Sign in or create an account to accept this invite.
                  </p>
                </div>
                <Button
                  className="w-full font-brockmann"
                  onClick={() =>
                    navigate(`/auth?redirect=${encodeURIComponent(`/league/join?token=${token}`)}`)
                  }
                >
                  Sign in to join
                </Button>
              </>
            )}

            {state === 'success' && (
              <>
                <div className="w-14 h-14 rounded-full bg-positive-green-500/15 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7 text-positive-green-500" aria-hidden />
                </div>
                <div className="space-y-2">
                  <h1 className="text-xl font-semibold font-brockmann tracking-tight text-foreground m-0">
                    You&apos;ve joined the league!
                  </h1>
                  <p className="text-sm text-muted-foreground font-brockmann m-0">
                    You&apos;re now a member. Check the standings and start competing.
                  </p>
                </div>
                <Button className="w-full font-brockmann" onClick={() => navigate(`/league/${leagueId}`)}>
                  Go to league
                </Button>
              </>
            )}

            {state === 'error' && (
              <>
                <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                  <XCircle className="w-7 h-7 text-destructive" aria-hidden />
                </div>
                <div className="space-y-2">
                  <h1 className="text-xl font-semibold font-brockmann tracking-tight text-foreground m-0">
                    Invite not valid
                  </h1>
                  <p className="text-sm text-muted-foreground font-brockmann m-0">{errorMsg}</p>
                </div>
                <Button
                  variant="outline"
                  className="w-full font-brockmann"
                  onClick={() => navigate('/')}
                >
                  Go home
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default LeagueJoin;
