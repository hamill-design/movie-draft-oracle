import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Vote, Check, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDraftOperations } from '@/hooks/useDraftOperations';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DraftPick } from '@/hooks/useDrafts';
import DraftBoard from '@/components/DraftBoard';
import { getCleanActorName } from '@/lib/utils';

interface RosterRow {
  playerName: string;
  picks: DraftPick[];
}

const SITE_ORIGIN = 'https://moviedrafter.com';
const OG_IMAGE = `${SITE_ORIGIN}/og-image.jpg?v=2`;

const VotePage = () => {
  const { draftId } = useParams<{ draftId: string }>();
  const navigate = useNavigate();
  const { user, guestSession, getOrCreateGuestSession } = useAuth();
  const { submitDraftVote } = useDraftOperations();
  const { toast } = useToast();

  const [draft, setDraft] = useState<any>(null);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [participants, setParticipants] = useState<{ id: string; participant_name: string; is_ai?: boolean }[]>([]);
  const [votes, setVotes] = useState<{ voted_participant_id: string | null; voted_player_name: string | null; voter_user_id: string | null; voter_guest_session_id: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVoteParticipantId, setSelectedVoteParticipantId] = useState<string | null>(null);
  const [selectedVotePlayerName, setSelectedVotePlayerName] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const votingMeta = useMemo(
    () =>
      draft?.voting_ends_at != null
        ? {
            voting_ends_at: draft.voting_ends_at as string,
            allow_public_voting: draft.allow_public_voting as boolean,
            is_multiplayer: draft.is_multiplayer as boolean,
          }
        : null,
    [draft?.voting_ends_at, draft?.allow_public_voting, draft?.is_multiplayer]
  );

  const votingEndsAt = votingMeta?.voting_ends_at ? new Date(votingMeta.voting_ends_at).getTime() : null;
  const votingOpen = votingEndsAt != null && now < votingEndsAt;

  const votingTimeRemaining = votingEndsAt != null && now < votingEndsAt ? votingEndsAt - now : 0;
  const formatVotingCountdown = (ms: number) => {
    if (ms <= 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const voteCountsByParticipantId = useMemo(() => {
    const map = new Map<string, number>();
    votes.forEach((v) => {
      if (v.voted_participant_id) map.set(v.voted_participant_id, (map.get(v.voted_participant_id) ?? 0) + 1);
    });
    return map;
  }, [votes]);

  const voteCountsByPlayerName = useMemo(() => {
    const map = new Map<string, number>();
    votes.forEach((v) => {
      if (v.voted_player_name) map.set(v.voted_player_name, (map.get(v.voted_player_name) ?? 0) + 1);
    });
    return map;
  }, [votes]);

  const myVote = useMemo(
    () =>
      votes.find(
        (v) =>
          (user && v.voter_user_id === user.id) ||
          (guestSession && v.voter_guest_session_id === guestSession.id)
      ),
    [votes, user, guestSession]
  );

  // Group picks by player for rosters (no scores)
  const rosters = useMemo((): RosterRow[] => {
    const map = new Map<string, DraftPick[]>();
    picks.forEach((pick) => {
      if (!map.has(pick.player_name)) map.set(pick.player_name, []);
      map.get(pick.player_name)!.push(pick);
    });
    return Array.from(map.entries()).map(([playerName, p]) => ({ playerName, picks: p }));
  }, [picks]);

  // Unique player names for single-player voting
  const playerNames = useMemo(() => rosters.map((r) => r.playerName), [rosters]);

  // Draft board: categories (draft order or from picks)
  const boardCategories = useMemo(() => {
    if (draft?.categories?.length) return draft.categories;
    const ordered: string[] = [];
    const seen = new Set<string>();
    [...picks].sort((a, b) => a.pick_order - b.pick_order).forEach((p) => {
      if (!seen.has(p.category)) {
        seen.add(p.category);
        ordered.push(p.category);
      }
    });
    return ordered;
  }, [draft?.categories, picks]);

  // Draft board: players in display order (participants for multiplayer, else rosters)
  const boardPlayers = useMemo(() => {
    if (draft?.is_multiplayer && participants?.length) {
      return participants.map((p, i) => ({ id: i + 1, name: p.participant_name }));
    }
    return rosters.map((r, i) => ({ id: i + 1, name: r.playerName }));
  }, [draft?.is_multiplayer, participants, rosters]);

  const playerNameToId = useMemo(() => new Map(boardPlayers.map((p) => [p.name, p.id])), [boardPlayers]);

  // Draft board: picks in DraftBoard shape
  const boardPicks = useMemo(
    () =>
      picks.map((p) => ({
        playerId: playerNameToId.get(p.player_name) ?? 1,
        playerName: p.player_name,
        movie: {
          title: p.movie_year ? `${p.movie_title} (${p.movie_year})` : p.movie_title,
        },
        category: p.category,
      })),
    [picks, playerNameToId]
  );

  useEffect(() => {
    if (!draftId) {
      navigate('/');
      return;
    }
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: draftData, error: draftError } = await supabase
          .from('drafts')
          .select('*')
          .eq('id', draftId)
          .eq('is_complete', true)
          .single();

        if (draftError || !draftData) {
          setError('This draft is not open for public voting.');
          setLoading(false);
          return;
        }

        if (!draftData.allow_public_voting) {
          setError('This draft is not open for public voting.');
          setDraft(draftData);
          setLoading(false);
          return;
        }

        setDraft(draftData);

        const { data: picksData, error: picksError } = await supabase
          .from('draft_picks')
          .select('*')
          .eq('draft_id', draftId)
          .order('pick_order');

        if (picksError) throw new Error('Failed to load picks');
        setPicks(picksData ?? []);

        if (draftData.is_multiplayer) {
          const { data: partData, error: partError } = await supabase
            .from('draft_participants')
            .select('id, participant_name, is_ai')
            .eq('draft_id', draftId);
          if (!partError) setParticipants(partData ?? []);
        }
      } catch (e) {
        setError('Failed to load draft.');
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [draftId, navigate]);

  useEffect(() => {
    if (!draftId || !votingMeta?.voting_ends_at) return;
    const loadVotes = async () => {
      try {
        if (guestSession) await supabase.rpc('set_guest_session_context', { session_id: guestSession.id });
        const { data, error } = await supabase
          .from('draft_votes')
          .select('voted_participant_id, voted_player_name, voter_user_id, voter_guest_session_id')
          .eq('draft_id', draftId);
        if (!error) setVotes(data ?? []);
      } catch {
        setVotes([]);
      }
    };
    loadVotes();
  }, [draftId, votingMeta?.voting_ends_at, guestSession]);

  useEffect(() => {
    if (!user && votingMeta?.allow_public_voting && votingMeta?.voting_ends_at && votingOpen) {
      getOrCreateGuestSession();
    }
  }, [user, votingMeta?.allow_public_voting, votingMeta?.voting_ends_at, votingOpen, getOrCreateGuestSession]);

  const handleVote = async (participantId: string | null, playerName: string | null) => {
    if (!draftId) return;
    setSubmittingVote(true);
    try {
      await submitDraftVote(draftId, { participantId: participantId ?? undefined, playerName: playerName ?? undefined });
      if (guestSession) await supabase.rpc('set_guest_session_context', { session_id: guestSession.id });
      const { data, error } = await supabase
        .from('draft_votes')
        .select('voted_participant_id, voted_player_name, voter_user_id, voter_guest_session_id')
        .eq('draft_id', draftId);
      if (!error) setVotes(data ?? []);
      toast({ title: 'Vote recorded' });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'Failed to submit vote', variant: 'destructive' });
    } finally {
      setSubmittingVote(false);
    }
  };

  const voteCanonical = draftId ? `${SITE_ORIGIN}/vote/${draftId}` : `${SITE_ORIGIN}/vote`;

  if (loading) {
    const loadTitle = 'Movie Drafter - Loading vote';
    const loadDesc = 'Loading public voting for a movie draft on Movie Drafter.';
    return (
      <>
        <Helmet>
          <title>{loadTitle}</title>
          <meta name="description" content={loadDesc} />
          <link rel="canonical" href={voteCanonical} />
          <meta property="og:title" content={loadTitle} />
          <meta property="og:description" content={loadDesc} />
          <meta property="og:url" content={voteCanonical} />
          <meta property="og:image" content={OG_IMAGE} />
          <meta name="twitter:title" content={loadTitle} />
          <meta name="twitter:description" content={loadDesc} />
          <meta name="twitter:image" content={OG_IMAGE} />
        </Helmet>
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)' }}>
          <div className="text-greyscale-blue-300 font-brockmann">Loading...</div>
        </div>
      </>
    );
  }

  if (error || !draft) {
    const errTitle = 'Movie Drafter - Vote unavailable';
    const errDesc = error ?? 'This draft is not open for public voting or could not be loaded.';
    return (
      <>
        <Helmet>
          <title>{errTitle}</title>
          <meta name="description" content={errDesc} />
          <link rel="canonical" href={voteCanonical} />
          <meta property="og:title" content={errTitle} />
          <meta property="og:description" content={errDesc} />
          <meta property="og:url" content={voteCanonical} />
          <meta property="og:image" content={OG_IMAGE} />
          <meta name="twitter:title" content={errTitle} />
          <meta name="twitter:description" content={errDesc} />
          <meta name="twitter:image" content={OG_IMAGE} />
        </Helmet>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6" style={{ background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)' }}>
          <p className="text-greyscale-blue-200 font-brockmann text-center">{error ?? 'Draft not found.'}</p>
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to home
          </Button>
        </div>
      </>
    );
  }

  const voteTargetName = votingMeta?.is_multiplayer
    ? (myVote && participants.find((p) => p.id === myVote.voted_participant_id)?.participant_name) ?? myVote?.voted_player_name
    : myVote?.voted_player_name;

  const pageTitle = `Movie Drafter - Vote on ${draft.title ?? 'Movie Draft'}`;
  const pageDescription = `Cast your vote for “${draft.title ?? 'this movie draft'}” on Movie Drafter. Pick who had the best roster after the draft.`;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={voteCanonical} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={voteCanonical} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={OG_IMAGE} />
      </Helmet>
      <div className="min-h-screen text-foreground" style={{ background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)' }}>
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
          {/* Header – same style as draft interface */}
          <div className="mb-6">
            <div className="p-6 rounded-[8px]">
              <div className="flex flex-col justify-center items-center gap-4 text-center">
                <span className="text-purple-300 text-[32px] font-brockmann font-bold leading-9 tracking-[1.28px]">
                  VOTE ON
                </span>
                <div
                  className="font-chaney font-normal text-center break-words"
                  style={{
                    fontSize: '64px',
                    lineHeight: '64px',
                    maxWidth: '100%',
                  }}
                >
                  <span className="text-greyscale-blue-100">
                    {draft.theme === 'spec-draft'
                      ? (draft.option || '').toUpperCase()
                      : draft.theme === 'people'
                        ? getCleanActorName(draft.option ?? '').toUpperCase() + ' '
                        : (draft.option ?? '').toString() + ' '}
                  </span>
                  {draft.theme !== 'spec-draft' && (
                    <span className="text-purple-300">MOVIES</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <p className="text-greyscale-blue-300 text-sm font-brockmann text-center -mt-2">
            Completed rosters – vote for who you think won. Scores are hidden until after voting.
          </p>

          <div className="w-full">
            <DraftBoard
              players={boardPlayers}
              categories={boardCategories}
              picks={boardPicks}
              theme={draft?.theme ?? ''}
              draftOption={getCleanActorName(draft?.option ?? '')}
            />
          </div>

          {votingMeta?.allow_public_voting && votingEndsAt != null && votingOpen && (
            <div className="w-full flex justify-center">
              <div className="text-center text-sm font-brockmann text-[var(--Text-Primary,#FCFFFF)]">
                Voting ends in <span className="font-semibold tabular-nums">{formatVotingCountdown(votingTimeRemaining)}</span>
              </div>
            </div>
          )}

          {votingMeta?.allow_public_voting && (
            <div
              className="w-full max-w-[617px] mx-auto flex flex-wrap justify-center align-content-start rounded-lg"
              style={{
                background: 'var(--Section-Container, #0E0E0F)',
                boxShadow: '0px 0px 6px #3B0394',
                borderRadius: 8,
              }}
            >
              <div className="w-full min-w-0 p-6 flex flex-col justify-start items-center gap-6">
                {!votingOpen ? (
                  <div className="w-full max-w-[617px] text-center text-sm font-brockmann text-[var(--Text-Primary,#FCFFFF)]">Voting closed</div>
                ) : myVote ? (
                  <div className="w-full max-w-[617px] flex flex-col justify-start items-start gap-6">
                    <div className="w-full flex flex-col justify-start items-center">
                      <div className="w-full text-center text-[20px] font-brockmann font-medium leading-[28px] text-[var(--Text-Primary,#FCFFFF)]">
                        You Voted For {voteTargetName ?? 'Unknown'}
                      </div>
                    </div>
                    <div className="w-full flex flex-col justify-start items-start gap-3">
                      {votingMeta.is_multiplayer
                        ? participants.map((p) => {
                            const count = voteCountsByParticipantId.get(p.id) ?? 0;
                            const total = Array.from(voteCountsByParticipantId.values()).reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                            return (
                              <div key={p.id} className="w-full flex flex-col justify-start items-start gap-2">
                                <div className="w-full flex justify-between items-center">
                                  <span className="text-xs font-brockmann font-normal leading-4 text-[var(--Text-Primary,#FCFFFF)]">{p.participant_name}</span>
                                  <span className="text-xs font-brockmann font-semibold leading-4 text-[var(--Text-Primary,#FCFFFF)]">{pct}%</span>
                                </div>
                                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--Greyscale-(Purp)-800, #2C2B2D)' }}>
                                  <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: 'var(--Brand-Primary, #7142FF)' }} />
                                </div>
                              </div>
                            );
                          })
                        : playerNames.map((name) => {
                            const count = voteCountsByPlayerName.get(name) ?? 0;
                            const total = Array.from(voteCountsByPlayerName.values()).reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                            return (
                              <div key={name} className="w-full flex flex-col justify-start items-start gap-2">
                                <div className="w-full flex justify-between items-center">
                                  <span className="text-xs font-brockmann font-normal leading-4 text-[var(--Text-Primary,#FCFFFF)]">{name}</span>
                                  <span className="text-xs font-brockmann font-semibold leading-4 text-[var(--Text-Primary,#FCFFFF)]">{pct}%</span>
                                </div>
                                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--Greyscale-(Purp)-800, #2C2B2D)' }}>
                                  <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: 'var(--Brand-Primary, #7142FF)' }} />
                                </div>
                              </div>
                            );
                          })}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-full max-w-[617px] flex flex-col justify-center items-center gap-2">
                      <div className="w-full text-center text-[20px] font-brockmann font-medium leading-[28px] text-[var(--Text-Primary,#FCFFFF)]">
                        Cast Your Vote For Who Won
                      </div>
                    </div>
                    <div className="w-full max-w-[617px] flex flex-col justify-start items-start gap-4">
                      {votingMeta.is_multiplayer
                        ? participants.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedVoteParticipantId((prev) => (prev === p.id ? null : p.id));
                                setSelectedVotePlayerName(null);
                              }}
                              disabled={submittingVote}
                              className="w-full min-w-[294px] py-3 px-6 rounded text-center text-sm font-brockmann font-medium leading-5 text-[var(--Text-Primary,#FCFFFF)] transition-colors"
                              style={{
                                background: selectedVoteParticipantId === p.id ? 'var(--Brand-Primary, #7142FF)' : 'var(--UI-Primary, #1D1D1F)',
                                outline: '1px solid var(--Item-Stroke, #49474B)',
                                outlineOffset: -1,
                              }}
                            >
                              {p.participant_name}
                            </button>
                          ))
                        : playerNames.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                setSelectedVotePlayerName((prev) => (prev === name ? null : name));
                                setSelectedVoteParticipantId(null);
                              }}
                              disabled={submittingVote}
                              className="w-full min-w-[294px] py-3 px-6 rounded text-center text-sm font-brockmann font-medium leading-5 text-[var(--Text-Primary,#FCFFFF)] transition-colors"
                              style={{
                                background: selectedVotePlayerName === name ? 'var(--Brand-Primary, #7142FF)' : 'var(--UI-Primary, #1D1D1F)',
                                outline: '1px solid var(--Item-Stroke, #49474B)',
                                outlineOffset: -1,
                              }}
                            >
                              {name}
                            </button>
                          ))}
                    </div>
                    {(selectedVoteParticipantId != null || selectedVotePlayerName != null) && (
                      <button
                        type="button"
                        disabled={submittingVote}
                        onClick={async () => {
                          await handleVote(selectedVoteParticipantId, selectedVotePlayerName);
                          setSelectedVoteParticipantId(null);
                          setSelectedVotePlayerName(null);
                        }}
                        className="px-6 py-3 rounded-sm font-brockmann font-semibold text-base leading-6 tracking-[0.32px] text-[var(--Greyscale-(Blue)-800,#2B2D2D)] disabled:opacity-50 transition-opacity"
                        style={{ background: 'var(--Yellow-500, #FFD60A)' }}
                      >
                        Confirm Choice
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default VotePage;
