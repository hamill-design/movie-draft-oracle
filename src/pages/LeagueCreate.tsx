import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Mail, Tag, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLeagueActions } from '@/hooks/useLeagues';
import { useToast } from '@/hooks/use-toast';
import { MOVIE_DRAFTER_PURPLE_SHELL } from '@/lib/pageGradients';
import { supabase } from '@/integrations/supabase/client';
import leagueTrophyIllustration from '@/assets/illustrations/illus/league-trophy.svg';

const LeagueCreate = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { createLeague } = useLeagueActions();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [emailList, setEmailList] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: MOVIE_DRAFTER_PURPLE_SHELL }}
      >
        <div style={{ color: 'var(--Text-Primary, #FCFFFF)', fontSize: '20px' }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleAddEmail = () => {
    const email = emailInput.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email) || emailList.includes(email)) return;
    setEmailList((prev) => [...prev, email]);
    setEmailInput('');
  };

  const sendInvitesForLeague = async (leagueId: string, leagueName: string, emails: string[]) => {
    if (!emails.length) return;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-league-invitations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          leagueId,
          leagueName,
          adminName: user?.user_metadata?.full_name ?? user?.email ?? 'Your friend',
          emails,
        }),
      },
    );
    const result = await res.json();
    if (result.success) {
      toast({
        title: `${result.summary.sent} invite${result.summary.sent !== 1 ? 's' : ''} sent.`,
      });
    } else {
      throw new Error(result.error ?? 'Invite send failed');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setSubmitting(true);
    const league = await createLeague(trimmed);

    if (!league) {
      setSubmitting(false);
      toast({
        title: 'Something went wrong',
        description: 'Could not create league. Try again.',
        variant: 'destructive',
      });
      return;
    }

    if (emailList.length > 0) {
      try {
        await sendInvitesForLeague(league.id, league.name, emailList);
      } catch (err) {
        toast({
          title: 'League created',
          description: 'Invites could not be sent. Add them from league settings.',
          variant: 'destructive',
        });
      }
    }

    setSubmitting(false);
    navigate(`/league/${league.id}`);
  };

  const inputShell =
    'w-full rounded-[2px] bg-[#1D1D1F] px-4 py-3 text-sm font-brockmann font-medium leading-5 outline outline-1 -outline-offset-1 placeholder:text-[#BDC3C2]';

  return (
    <>
      <Helmet>
        <title>Create a League — Movie Drafter</title>
      </Helmet>

      <div
        className="min-h-screen w-full inline-flex flex-col items-center justify-start px-6 pt-5 pb-12 font-brockmann"
        style={{ background: MOVIE_DRAFTER_PURPLE_SHELL }}
      >
        <div className="flex w-full max-w-[734px] flex-col items-start gap-6">
          <form onSubmit={handleCreate} className="flex w-full flex-col items-start gap-6">
            {/* Hero */}
            <div className="flex w-full flex-col items-center justify-center gap-6 self-stretch py-6">
              <div className="relative flex h-[118px] w-[124px] shrink-0 items-center justify-center">
                <img
                  src={leagueTrophyIllustration}
                  alt=""
                  width={124}
                  height={118}
                  decoding="async"
                  className="h-full w-full object-contain object-center"
                />
              </div>
              <div className="flex w-full flex-col items-start gap-4 self-stretch">
                <h1 className="m-0 w-full text-center font-chaney text-[48px] font-normal leading-[50px] tracking-wide text-greyscale-blue-100">
                  CREATE A LEAGUE
                </h1>
                <p className="m-0 w-full text-center text-xl font-medium leading-7 text-greyscale-blue-100">
                  Take your movie competitions to the next level. Compete with friends across multiple
                  drafts. You&apos;ll be the league admin and can invite members after setup.
                </p>
              </div>
            </div>

            {/* League name card */}
            <div
              className="flex w-full flex-col items-start gap-6 self-stretch rounded-lg p-6"
              style={{
                background: 'var(--Section-Container, #0E0E0F)',
                boxShadow: '0px 0px 6px #3B0394',
              }}
            >
              <div className="inline-flex w-full items-center gap-2 self-stretch">
                <span className="inline-flex size-6 shrink-0 items-center justify-center p-0.5">
                  <Tag className="size-5 text-[#907AFF]" strokeWidth={2} aria-hidden />
                </span>
                <span className="flex-1 text-xl font-medium leading-7 text-greyscale-blue-100">
                  League Name
                </span>
              </div>
              <div className="flex w-full flex-col gap-4 self-stretch">
                <label className="flex w-full flex-col gap-0">
                  <span className="sr-only">League name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={60}
                    autoFocus
                    placeholder="e.g. The Cinephiles, Friday Night Drafts"
                    className={`${inputShell} text-greyscale-blue-100 outline-[#FCFFFF]`}
                  />
                </label>
              </div>
            </div>

            {/* Invite members card */}
            <div
              className="flex w-full flex-col items-start self-stretch rounded-lg"
              style={{
                background: 'var(--Section-Container, #0E0E0F)',
                boxShadow: '0px 0px 6px #3B0394',
              }}
            >
              <div className="flex w-full flex-col gap-6 self-stretch p-6">
                <div className="flex w-full flex-col gap-4 self-stretch">
                  <div className="inline-flex w-full items-center gap-2 self-stretch">
                    <span className="inline-flex size-6 shrink-0 items-center justify-center p-0.5">
                      <Mail className="size-5 text-[#907AFF]" strokeWidth={2} aria-hidden />
                    </span>
                    <span className="flex-1 text-xl font-medium leading-7 text-greyscale-blue-100">
                      Invite Members
                    </span>
                  </div>
                  <div className="inline-flex w-full flex-wrap items-stretch gap-2 self-stretch sm:flex-nowrap">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddEmail();
                        }
                      }}
                      placeholder="Enter email address of players you want to add"
                      className={`min-h-[44px] min-w-0 flex-1 ${inputShell} text-greyscale-blue-100 outline-[#BDC3C2]`}
                    />
                    <button
                      type="button"
                      onClick={handleAddEmail}
                      className="inline-flex shrink-0 items-center justify-center rounded-[2px] bg-[#7142FF] px-3 py-2 text-center text-sm font-medium leading-5 text-greyscale-blue-100 transition-colors hover:bg-[#6338e0]"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="flex w-full flex-col gap-3 self-stretch">
                  <p className="m-0 text-base font-normal leading-6 text-[#646968]">
                    Participants ({emailList.length}):
                  </p>
                  {emailList.length > 0 && (
                    <div className="flex w-full flex-wrap content-start items-start gap-2 self-stretch">
                      {emailList.map((email) => (
                        <span
                          key={email}
                          title={email}
                          className="inline-flex items-center gap-2 rounded bg-[#7142FF] py-2 pl-4 pr-2.5"
                        >
                          <span className="text-sm font-medium leading-5 text-greyscale-blue-100 break-all">
                            {email}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEmailList((prev) => prev.filter((x) => x !== email))}
                            className="inline-flex items-center justify-center rounded-md p-1 text-greyscale-blue-100 hover:bg-white/10"
                            aria-label={`Remove ${email}`}
                          >
                            <X className="size-4" strokeWidth={2} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex w-full flex-col items-center self-stretch">
              <button
                type="submit"
                disabled={!name.trim() || submitting}
                className="inline-flex items-center justify-center rounded-[2px] bg-[#FFD60A] px-6 py-3 text-center text-base font-semibold leading-6 tracking-[0.32px] text-[#2B2D2D] transition-colors hover:bg-[#e6c109] disabled:pointer-events-none disabled:opacity-50"
              >
                {submitting ? 'Creating…' : 'Create League'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default LeagueCreate;
