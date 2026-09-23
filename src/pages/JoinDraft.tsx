import { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMultiplayerDraft } from '@/hooks/useMultiplayerDraft';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Users, Mail, Hash, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const PAGE_BG = 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)';

const darkCardClass =
  'w-full max-w-md rounded-lg border border-[#49474B] bg-greyscale-purp-850 text-greyscale-blue-100 shadow-sm';

function JoinDraftShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: PAGE_BG }}
    >
      <div className={cn(darkCardClass, className)}>{children}</div>
    </div>
  );
}

function JoinDraftLoading({ message }: { message: string }) {
  return (
    <JoinDraftShell className="flex flex-col items-center gap-4 p-8">
      <Loader2 className="h-8 w-8 animate-spin text-purple-300" />
      <p className="m-0 text-sm text-greyscale-blue-300 font-brockmann">{message}</p>
    </JoinDraftShell>
  );
}

export const JoinDraft = () => {
  const { draftId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, guestSession, loading: authLoading, getOrCreateGuestSession } = useAuth();
  const { toast } = useToast();
  const { joinDraftByCode, claimDraftInvite, loading } = useMultiplayerDraft();
  const [isRetryingGuest, setIsRetryingGuest] = useState(false);

  const [inviteCode, setInviteCode] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [claimError, setClaimError] = useState<string | null>(null);
  const [checkingParticipation, setCheckingParticipation] = useState(!!draftId);
  const hasAttemptedAutoJoin = useRef(false);

  const invitedEmail = searchParams.get('email');
  // Email invite links identify the invitee by account, never as a guest.
  const isEmailInvite = !!draftId && !!invitedEmail;

  // ── Safety net: if user is already a participant (e.g. pre-joined via league
  // draft), skip the invite-code flow and go straight to the draft. ──────────
  useEffect(() => {
    if (authLoading) return;

    if (!draftId || !user) {
      setCheckingParticipation(false);
      return;
    }

    let cancelled = false;
    setCheckingParticipation(true);

    (async () => {
      const { data } = await supabase
        .from('draft_participants')
        .select('id')
        .eq('draft_id', draftId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (data) {
        navigate(`/draft/${draftId}`, { replace: true });
      } else {
        setCheckingParticipation(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, draftId, authLoading, navigate]);

  useEffect(() => {
    // Pre-fill participant name with user email if available
    if (user?.email && !participantName) {
      setParticipantName(user.email);
    }
  }, [user?.email, participantName]);

  // Email invitations: attach the signed-in account to the spot it was invited
  // to (never creates a second row) and go straight to the draft.
  useEffect(() => {
    if (authLoading || checkingParticipation) return;
    if (!isEmailInvite || !draftId || !user || hasAttemptedAutoJoin.current) return;

    hasAttemptedAutoJoin.current = true;

    (async () => {
      try {
        const id = await claimDraftInvite(draftId);
        navigate(`/draft/${id}`, { replace: true });
      } catch (error: any) {
        setClaimError(error?.message || 'We could not match this invitation to your account.');
      }
    })();
  }, [authLoading, checkingParticipation, isEmailInvite, draftId, user, claimDraftInvite, navigate]);

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteCode.trim() || !participantName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both invite code and your name",
        variant: "destructive",
      });
      return;
    }

    try {
      const id = await joinDraftByCode(inviteCode.trim().toUpperCase(), participantName.trim());
      if (id) navigate(`/draft/${id}`);
    } catch (error) {
      console.error('Failed to join draft:', error);
    }
  };

  if (authLoading || checkingParticipation) {
    return (
      <JoinDraftLoading
        message={checkingParticipation ? 'Opening draft…' : 'Loading…'}
      />
    );
  }

  if (isEmailInvite) {
    const joinLink = `/join-draft/${draftId}?email=${encodeURIComponent(invitedEmail!)}&auto=true`;
    const authUrl = (mode: 'signup' | 'signin') =>
      `/auth?${mode === 'signup' ? 'mode=signup&' : ''}email=${encodeURIComponent(invitedEmail!)}&returnTo=${encodeURIComponent(joinLink)}`;

    if (!user) {
      return (
        <JoinDraftShell>
          <div className="space-y-1.5 p-6 text-center">
            <h1 className="m-0 flex items-center justify-center gap-2 text-2xl font-semibold font-brockmann leading-none tracking-tight">
              <Mail className="h-6 w-6 text-[#907AFF]" />
              You're invited to a draft
            </h1>
          </div>
          <div className="space-y-4 px-6 pb-6 text-center">
            <p className="m-0 text-sm text-greyscale-blue-300 font-brockmann">
              This invitation was sent to <span className="text-greyscale-blue-100">{invitedEmail}</span>.
              Create a free account (or sign in) with that email to take your spot in the draft.
            </p>
            <div className="flex flex-col gap-2">
              <Button className="bg-brand-primary hover:bg-purple-300" onClick={() => navigate(authUrl('signup'))}>
                Create account
              </Button>
              <Button
                variant="outline"
                className="border-[#666469] bg-greyscale-purp-900 text-greyscale-blue-100 hover:bg-greyscale-purp-800"
                onClick={() => navigate(authUrl('signin'))}
              >
                I already have an account
              </Button>
            </div>
          </div>
        </JoinDraftShell>
      );
    }

    if (claimError) {
      return (
        <JoinDraftShell>
          <div className="space-y-1.5 p-6 text-center">
            <h1 className="m-0 text-2xl font-semibold font-brockmann leading-none tracking-tight">
              Can't join this draft
            </h1>
          </div>
          <div className="space-y-4 px-6 pb-6 text-center">
            <p className="m-0 text-sm text-greyscale-blue-300 font-brockmann">{claimError}</p>
            <div className="flex flex-col gap-2">
              <Button
                className="bg-brand-primary hover:bg-purple-300"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate(authUrl('signin'));
                }}
              >
                Sign in with {invitedEmail}
              </Button>
              <Button
                variant="outline"
                className="border-[#666469] bg-greyscale-purp-900 text-greyscale-blue-100 hover:bg-greyscale-purp-800"
                onClick={() => navigate('/')}
              >
                Back to Home
              </Button>
            </div>
          </div>
        </JoinDraftShell>
      );
    }

    return <JoinDraftLoading message="Joining the draft…" />;
  }

  if (!user && !guestSession) {
    return (
      <JoinDraftShell>
        <div className="space-y-1.5 p-6 text-center">
          <h1 className="text-2xl font-semibold font-brockmann leading-none tracking-tight">
            Sign In or Join as Guest
          </h1>
        </div>
        <div className="space-y-4 px-6 pb-6 text-center">
          <p className="m-0 text-sm text-greyscale-blue-300 font-brockmann">
            Sign in with your account, or join as a guest to continue without an account.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate('/auth')}>
              Sign In
            </Button>
            <Button
              variant="outline"
              className="border-[#666469] bg-greyscale-purp-900 text-greyscale-blue-100 hover:bg-greyscale-purp-800"
              onClick={async () => {
                setIsRetryingGuest(true);
                try {
                  await getOrCreateGuestSession();
                } catch {
                  toast({
                    title: "Could not join as guest",
                    description: "Please try again or sign in.",
                    variant: "destructive",
                  });
                } finally {
                  setIsRetryingGuest(false);
                }
              }}
              disabled={isRetryingGuest}
            >
              {isRetryingGuest ? 'Joining...' : 'Join as guest'}
            </Button>
          </div>
        </div>
      </JoinDraftShell>
    );
  }

  const darkInputClass =
    'border-[#666469] bg-greyscale-purp-900 text-greyscale-blue-100 placeholder:text-greyscale-blue-500';

  return (
    <>
      <Helmet>
        <title>Movie Drafter - Join a movie drafting game</title>
        <meta name="description" content="Join a movie drafting game with an invite code or link—fantasy movie drafts and multiplayer picks on Movie Drafter." />
        <link rel="canonical" href={`https://moviedrafter.com/join-draft${draftId ? `/${draftId}` : ''}`} />
        <meta property="og:title" content="Movie Drafter - Join a movie drafting game" />
        <meta property="og:description" content="Join a movie drafting game with an invite code or link—fantasy movie drafts and multiplayer picks on Movie Drafter." />
        <meta property="og:url" content={`https://moviedrafter.com/join-draft${draftId ? `/${draftId}` : ''}`} />
        {socialShareImageMetaNodes()}
        <meta name="twitter:title" content="Movie Drafter - Join a movie drafting game" />
        <meta name="twitter:description" content="Join a movie drafting game with an invite code or link—fantasy movie drafts and multiplayer picks on Movie Drafter." />
      </Helmet>
      <JoinDraftShell>
        <div className="space-y-1.5 p-6 text-center">
          <h1 className="m-0 flex items-center justify-center gap-2 text-2xl font-semibold font-brockmann leading-none tracking-tight">
            <Users className="h-6 w-6 text-[#907AFF]" />
            Join Draft
          </h1>
          <p className="m-0 text-sm text-greyscale-blue-300 font-brockmann">
            Join a multiplayer movie draft session
          </p>
        </div>

        <div className="space-y-6 px-6 pb-6">
            <form onSubmit={handleJoinByCode} className="space-y-4">
              <h2 className="m-0 flex items-center gap-2 text-sm font-medium text-greyscale-blue-400 font-brockmann">
                <Hash className="h-4 w-4" />
                Invite Code
              </h2>

              <div className="space-y-2">
                <Label htmlFor="code" className="text-greyscale-blue-300">Invite Code</Label>
                <Input
                  id="code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Enter 8-character code"
                  maxLength={8}
                  className={cn(darkInputClass, 'text-center font-mono tracking-wider')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name-code" className="text-greyscale-blue-300">Your Display Name</Label>
                <Input
                  id="name-code"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Enter your name"
                  className={darkInputClass}
                />
              </div>

              <Button
                type="submit"
                disabled={loading || !inviteCode.trim() || !participantName.trim()}
                className="w-full bg-brand-primary hover:bg-purple-300"
              >
                {loading ? 'Joining...' : 'Join Draft'}
              </Button>
            </form>

          <Separator className="bg-white/10" />

          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="w-full border-[#666469] bg-greyscale-purp-900 text-greyscale-blue-100 hover:bg-greyscale-purp-800"
            >
              Back to Home
            </Button>
          </div>
        </div>
      </JoinDraftShell>
    </>
  );
};
