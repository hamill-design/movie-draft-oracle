import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Trophy } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useDraftOperations } from '@/hooks/useDraftOperations';
import { supabase } from '@/integrations/supabase/client';
import { VotingSetupWizard } from '@/components/VotingSetupWizard';
import { CastVotePanel, VotingSessionCard } from '@/components/CastVotePanel';
import { PublicVoteShareCard } from '@/components/PublicVoteShareCard';
import { normalizeParticipants } from '@/types/participant';
import {
  getInitialLocalVotingUiState,
  getLocalDraftVotingPersisted,
  resolveHydratedLocalVoting,
  setLocalDraftVotingPersisted
} from '@/utils/localDraftVotingStorage';

interface DraftCompleteProps {
  draftId?: string;
  draftData?: any;
  picks?: any[];
  isEnriching?: boolean;
}

const DURATION_OPTIONS = [
  { label: '5 min', value: 5 },
  { label: '1 hour', value: 60 },
  { label: '24 hours', value: 1440 }
] as const;

function computeParticipantNames(draftData: any, picks: any[] | undefined): string[] {
  if (draftData?.participants?.length) {
    return normalizeParticipants(draftData.participants).map(p => p.name);
  }
  if (picks?.length) {
    const names = new Set<string>();
    picks.forEach((p: any) => {
      const n = p.player_name ?? p.playerName;
      if (n) names.add(String(n));
    });
    return Array.from(names);
  }
  return [];
}

const DraftComplete = ({ draftId: propDraftId, draftData: propDraftData, picks: propPicks, isEnriching }: DraftCompleteProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, guestSession } = useAuth();
  const { enableVoting, submitDraftVote, getDraftWithPicks } = useDraftOperations();

  const draftId = propDraftId || (location.state as any)?.existingDraftId;
  const draftData = propDraftData || (location.state as any)?.draftData;
  const picks = propPicks || (location.state as any)?.picks;

  const isLocal = !!draftData;

  const rosterDep = useMemo(() => {
    if (draftData?.participants?.length) {
      return normalizeParticipants(draftData.participants)
        .map(p => p.name)
        .slice()
        .sort()
        .join('\0');
    }
    if (picks?.length) {
      return [
        ...new Set(
          (picks as any[]).map((p: any) => p.player_name ?? p.playerName).filter(Boolean)
        )
      ]
        .sort()
        .join('\0');
    }
    return '';
  }, [draftData?.participants, picks]);

  const participantNames = useMemo(() => computeParticipantNames(draftData, picks), [rosterDep]);

  const [draft, setDraft] = useState<{
    voting_ends_at: string | null;
    allow_public_voting?: boolean;
    invite_code?: string | null;
  } | null>(null);
  const [addVoting, setAddVoting] = useState<boolean | null>(() =>
    getInitialLocalVotingUiState(draftId, isLocal, computeParticipantNames(draftData, picks)).addVoting
  );
  const [votingPublic, setVotingPublic] = useState(false);
  const [votingDuration, setVotingDuration] = useState<number>(60);
  const [votes, setVotes] = useState<{ voted_participant_id: string | null; voted_player_name: string | null; voter_user_id: string | null; voter_guest_session_id: string | null }[]>([]);
  const [loadingVotes, setLoadingVotes] = useState(false);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [submittingSetup, setSubmittingSetup] = useState(false);
  const [selectedPlayerForVote, setSelectedPlayerForVote] = useState<string | null>(null);
  const [localVoteStep, setLocalVoteStep] = useState(() =>
    getInitialLocalVotingUiState(draftId, isLocal, computeParticipantNames(draftData, picks)).localVoteStep
  );
  const [localVotes, setLocalVotes] = useState<Record<string, string>>(() =>
    getInitialLocalVotingUiState(draftId, isLocal, computeParticipantNames(draftData, picks)).localVotes
  );
  const [localStepPick, setLocalStepPick] = useState<string | null>(null);
  /** After enable succeeds, stepped UI must show even if refetch misses voting_ends_at (guest/RLS/timing). */
  const [localVoteGatheringActive, setLocalVoteGatheringActive] = useState(false);

  const votingEndsAt = draft?.voting_ends_at ? new Date(draft.voting_ends_at).getTime() : null;
  const votingOpen = votingEndsAt != null && Date.now() < votingEndsAt;
  const votingConfigured = votingEndsAt != null;

  /** Re-hydrate from sessionStorage when draft or roster identity changes, or when roster loads — only if storage exists (avoids clobbering in-session choices). */
  useEffect(() => {
    if (!isLocal || !draftId) return;
    const names = computeParticipantNames(draftData, picks);
    if (names.length === 0) return;
    const stored = getLocalDraftVotingPersisted(draftId);
    if (!stored) return;
    const resolved = resolveHydratedLocalVoting(draftId, names, stored);
    if (!resolved) return;
    setAddVoting(resolved.addVoting);
    setLocalVotes(resolved.localVotes);
    setLocalVoteStep(resolved.localVoteStep);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- rosterDep is the stable roster signature; draftData/picks refs change often
  }, [draftId, rosterDep, isLocal]);

  useEffect(() => {
    setLocalStepPick(null);
  }, [localVoteStep]);

  useEffect(() => {
    if (votingConfigured) setLocalVoteGatheringActive(false);
  }, [votingConfigured]);

  useEffect(() => {
    if (addVoting === false) setLocalVoteGatheringActive(false);
  }, [addVoting]);

  const fetchDraft = useCallback(async () => {
    if (!draftId) return;
    try {
      if (guestSession) {
        await supabase.rpc('set_guest_session_context', { session_id: guestSession.id });
      }
      const { draft: d } = await getDraftWithPicks(draftId);
      if (d) {
        const row = d as any;
        setDraft({
          voting_ends_at: row.voting_ends_at ?? null,
          allow_public_voting: row.allow_public_voting,
          invite_code: row.invite_code ?? null
        });
      }
    } catch {
      setDraft(null);
    }
  }, [draftId, getDraftWithPicks, guestSession]);

  const fetchVotes = useCallback(async () => {
    if (!draftId) return;
    setLoadingVotes(true);
    try {
      if (guestSession) {
        await supabase.rpc('set_guest_session_context', { session_id: guestSession.id });
      }
      const { data, error } = await supabase
        .from('draft_votes')
        .select('voted_participant_id, voted_player_name, voter_user_id, voter_guest_session_id')
        .eq('draft_id', draftId);
      if (!error) setVotes(data ?? []);
    } finally {
      setLoadingVotes(false);
    }
  }, [draftId, guestSession]);

  useEffect(() => {
    if (draftId) {
      fetchDraft();
    }
  }, [draftId, fetchDraft]);

  useEffect(() => {
    if (draftId && votingConfigured) {
      fetchVotes();
    }
  }, [draftId, votingConfigured, fetchVotes]);

  const myVote = votes.find(
    v => (user && v.voter_user_id === user.id) || (guestSession && v.voter_guest_session_id === guestSession.id)
  );
  const voteCounts = participantNames.map(name => ({
    name,
    count: votes.filter(v => v.voted_player_name === name).length
  }));

  const handleSetupSubmit = async () => {
    if (!draftId || addVoting !== true) return;
    setSubmittingSetup(true);
    try {
      await enableVoting(draftId, votingPublic, votingDuration);
      setLocalVoteGatheringActive(true);
      if (isLocal && draftId) setLocalDraftVotingPersisted(draftId, { enabledWizard: true });
      await fetchDraft();
      toast({ title: 'Voting enabled', description: votingPublic ? 'Share the link so others can vote.' : 'Only participants can vote.' });
    } catch (e: any) {
      setLocalVoteGatheringActive(false);
      toast({ title: 'Error', description: e?.message ?? 'Failed to enable voting', variant: 'destructive' });
    } finally {
      setSubmittingSetup(false);
    }
  };

  const handleVote = async (playerName: string) => {
    if (!draftId) return;
    setSubmittingVote(true);
    try {
      await submitDraftVote(draftId, { playerName });
      await fetchVotes();
      toast({ title: 'Vote recorded', description: `You voted for ${playerName}` });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'Failed to submit vote', variant: 'destructive' });
    } finally {
      setSubmittingVote(false);
    }
  };

  const handleViewScores = async () => {
    if (!draftId) {
      toast({ title: 'Error', description: 'Unable to view scores: Draft ID is missing.', variant: 'destructive' });
      return;
    }
    if (isEnriching) {
      toast({ title: 'Calculating scores', description: 'Please wait while we calculate movie scores...' });
      return;
    }
    const finalDraftData = draftData || { id: draftId, is_complete: true };
    const finalPicks = picks || [];
    const state: { draftData: any; picks: any[]; localVotes?: Record<string, string> } = { draftData: finalDraftData, picks: finalPicks };
    if (Object.keys(localVotes).length > 0) {
      state.localVotes = localVotes;
      if (draftId) setLocalDraftVotingPersisted(draftId, { votes: { ...localVotes } });
    }
    navigate(`/final-scores/${draftId}`, { state });
  };

  /** Use server end time when available; fall back on post-enable flag so stepped UI isn't blank. */
  const effectiveVotingStarted = votingConfigured || localVoteGatheringActive;

  /** Keep wizard visible until voting has begun (tracked locally or confirmed from draft row). */
  const showSetupForm =
    (draftId || draftData) &&
    !effectiveVotingStarted &&
    (addVoting === null || addVoting === true);
  /** Persisted "Yes" or open server window; avoids blank UI after StrictMode remount / refresh (addVoting was only in memory). */
  const localBallotCollectionActive =
    addVoting === true || (isLocal && effectiveVotingStarted && addVoting !== false);

  const localSteppedVoting =
    isLocal &&
    effectiveVotingStarted &&
    localBallotCollectionActive &&
    participantNames.length > 0;
  const localVotingInProgress = localSteppedVoting && localVoteStep < participantNames.length;
  const localVotingComplete = localSteppedVoting && localVoteStep >= participantNames.length;
  const showVotingUI = !isLocal && draftId && votingConfigured && votingOpen && participantNames.length > 0;
  const showVotingClosed = draftId && votingConfigured && !votingOpen;

  const shareVoteUrl =
    draftId && typeof window !== 'undefined' ? `${window.location.origin}/vote/${draftId}` : '';
  const voteSharePillText =
    (draft?.invite_code && String(draft.invite_code)) ||
    (draftId ? draftId.replace(/-/g, '').slice(0, 8).toUpperCase() : null);

  return (
    <div className="p-6 rounded-lg">
      <div className="w-full flex flex-col items-stretch gap-4">
        <div className="text-center">
          <div className="text-[#FCFFFF] text-xl font-brockmann font-medium">Draft Complete!</div>
          <div className="text-[#BDC3C2] text-sm font-brockmann mt-1">All players have made their selections.</div>
        </div>

        {showSetupForm && (
          <VotingSetupWizard
            variant="full"
            addVoting={addVoting}
            votingPublic={votingPublic}
            votingDuration={votingDuration}
            durationOptions={DURATION_OPTIONS}
            submittingSetup={submittingSetup}
            sharePillText={voteSharePillText}
            shareCopyValue={shareVoteUrl}
            toastCopySuccess={() =>
              toast({ title: 'Link copied', description: 'Share link copied to clipboard.' })
            }
            onEnableYes={() => {
              setAddVoting(true);
              if (draftId) setLocalDraftVotingPersisted(draftId, { enabledWizard: true });
            }}
            onEnableNo={() => {
              setAddVoting(false);
              if (draftId) setLocalDraftVotingPersisted(draftId, { skipped: true });
            }}
            onGatherPublicYes={() => setVotingPublic(true)}
            onGatherPublicNo={() => setVotingPublic(false)}
            onDurationChange={setVotingDuration}
            onBeginVoting={handleSetupSubmit}
          />
        )}

        {localVotingInProgress && (
          <CastVotePanel
            voteAsPlayerName={participantNames[localVoteStep]}
            options={participantNames
              .filter(name => name !== participantNames[localVoteStep])
              .map(name => ({ key: name, label: name }))}
            selectedKey={localStepPick}
            onOptionClick={key => setLocalStepPick(prev => (prev === key ? null : key))}
            onConfirm={() => {
              if (!localStepPick) return;
              const currentVoter = participantNames[localVoteStep];
              setLocalVotes(prev => {
                const next = { ...prev, [currentVoter]: localStepPick };
                if (draftId) setLocalDraftVotingPersisted(draftId, { votes: next });
                return next;
              });
              setLocalVoteStep(prev => prev + 1);
            }}
            footer={
              <div className="w-full max-w-[617px] text-center text-xs font-brockmann text-[var(--Text-Primary,#FCFFFF)] opacity-80">
                Step {localVoteStep + 1} of {participantNames.length}
              </div>
            }
          />
        )}

        {localVotingComplete && (
          <div className="text-greyscale-blue-200 text-sm font-brockmann text-center py-2">All votes recorded.</div>
        )}

        {showVotingUI && (
          <>
            {myVote ? (
              <VotingSessionCard>
                <div className="w-full max-w-[617px] flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 justify-center flex-wrap">
                    <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                    <span className="text-center font-brockmann font-medium text-xl leading-[28px] text-[var(--Text-Primary,#FCFFFF)]">
                      You voted for{' '}
                      <span className="font-semibold">{myVote.voted_player_name}</span>
                    </span>
                  </div>
                  {!loadingVotes && voteCounts.some(v => v.count > 0) && (
                    <div className="text-[var(--Text-Primary,#FCFFFF)] text-xs font-brockmann opacity-80 text-center w-full">
                      {voteCounts.filter(v => v.count > 0).map(v => `${v.name}: ${v.count}`).join(' · ')}
                    </div>
                  )}
                </div>
              </VotingSessionCard>
            ) : (
              <CastVotePanel
                title="Cast Your Vote For Who Won"
                options={participantNames.map(name => ({ key: name, label: name }))}
                selectedKey={selectedPlayerForVote}
                onOptionClick={key =>
                  setSelectedPlayerForVote(prev => (prev === key ? null : key))
                }
                submitting={submittingVote}
                onConfirm={async () => {
                  if (!selectedPlayerForVote) return;
                  await handleVote(selectedPlayerForVote);
                  setSelectedPlayerForVote(null);
                }}
                footer={
                  !loadingVotes && voteCounts.some(v => v.count > 0) ? (
                    <div className="w-full max-w-[617px] text-center text-xs font-brockmann text-[var(--Text-Primary,#FCFFFF)] opacity-80">
                      {voteCounts.filter(v => v.count > 0).map(v => `${v.name}: ${v.count}`).join(' · ')}
                    </div>
                  ) : undefined
                }
              />
            )}
          </>
        )}

        {showVotingClosed && (
          <div className="text-greyscale-blue-300 text-sm font-brockmann text-center py-2">Voting closed</div>
        )}

        {draftId && !draft && !draftData && (
          <div className="text-greyscale-blue-300 text-sm">Loading...</div>
        )}

        {addVoting === false && ((draftId && draft && !votingConfigured) || (isLocal && draftData)) && (
          <div className="text-greyscale-blue-300 text-sm text-center">Skipping voting. You can view scores below.</div>
        )}

        {votingConfigured && draft?.allow_public_voting && draftId && (
          <PublicVoteShareCard
            voteUrl={shareVoteUrl}
            onCopy={() => {
              void navigator.clipboard.writeText(shareVoteUrl).then(() =>
                toast({ title: 'Link copied', description: 'Share link copied to clipboard.' })
              );
            }}
          />
        )}

        <div className="flex justify-center pt-2">
          <Button
            onClick={handleViewScores}
            disabled={isEnriching || localVotingInProgress}
            className="px-3 py-2 bg-purple-500 hover:bg-purple-400 rounded-[2px] flex justify-center items-center gap-2 disabled:opacity-50"
          >
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-brockmann font-medium">
              {isEnriching ? 'Calculating Scores...' : localVotingInProgress ? 'Complete voting above' : 'View Final Scores'}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DraftComplete;
