import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, Vote, Copy } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useDraftOperations } from '@/hooks/useDraftOperations';
import { supabase } from '@/integrations/supabase/client';
import { QRCodeSVG } from 'qrcode.react';
import { normalizeParticipants } from '@/types/participant';

interface DraftCompleteProps {
  draftId?: string;
  draftData?: any;
  picks?: any[];
  isEnriching?: boolean;
}

const DURATION_OPTIONS = [
  { label: '5 min', value: 5 },
  { label: '1 hr', value: 60 },
  { label: '24 hr', value: 1440 }
] as const;

const DraftComplete = ({ draftId: propDraftId, draftData: propDraftData, picks: propPicks, isEnriching }: DraftCompleteProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, guestSession } = useAuth();
  const { enableVoting, submitDraftVote, getDraftWithPicks } = useDraftOperations();

  const draftId = propDraftId || (location.state as any)?.existingDraftId;
  const draftData = propDraftData || (location.state as any)?.draftData;
  const picks = propPicks || (location.state as any)?.picks;

  const [draft, setDraft] = useState<{ voting_ends_at: string | null; allow_public_voting?: boolean } | null>(null);
  const [addVoting, setAddVoting] = useState<boolean | null>(null);
  const [votingPublic, setVotingPublic] = useState(false);
  const [votingDuration, setVotingDuration] = useState<number>(60);
  const [votes, setVotes] = useState<{ voted_participant_id: string | null; voted_player_name: string | null; voter_user_id: string | null; voter_guest_session_id: string | null }[]>([]);
  const [loadingVotes, setLoadingVotes] = useState(false);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [submittingSetup, setSubmittingSetup] = useState(false);
  const [localVoteStep, setLocalVoteStep] = useState(0);
  const [localVotes, setLocalVotes] = useState<Record<string, string>>({});

  const votingEndsAt = draft?.voting_ends_at ? new Date(draft.voting_ends_at).getTime() : null;
  const votingOpen = votingEndsAt != null && Date.now() < votingEndsAt;
  const votingConfigured = votingEndsAt != null;

  const participantNames = (() => {
    if (draftData?.participants?.length) {
      return normalizeParticipants(draftData.participants).map(p => p.name);
    }
    if (picks?.length) {
      const names = new Set<string>();
      picks.forEach((p: any) => p.player_name && names.add(p.player_name));
      return Array.from(names);
    }
    return [];
  })();

  const fetchDraft = useCallback(async () => {
    if (!draftId) return;
    try {
      if (guestSession) {
        await supabase.rpc('set_guest_session_context', { session_id: guestSession.id });
      }
      const { draft: d } = await getDraftWithPicks(draftId);
      if (d) setDraft({ voting_ends_at: (d as any).voting_ends_at ?? null, allow_public_voting: (d as any).allow_public_voting });
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
      await fetchDraft();
      toast({ title: 'Voting enabled', description: votingPublic ? 'Share the link so others can vote.' : 'Only participants can vote.' });
    } catch (e: any) {
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
    if (Object.keys(localVotes).length > 0) state.localVotes = localVotes;
    navigate(`/final-scores/${draftId}`, { state });
  };

  const isLocal = !!draftData;
  const showSetupForm = (draftId || draftData) && !votingConfigured && (addVoting === null || (addVoting === true && !isLocal));
  const localSteppedVoting = isLocal && addVoting === true && participantNames.length > 0;
  const localVotingInProgress = localSteppedVoting && localVoteStep < participantNames.length;
  const localVotingComplete = localSteppedVoting && localVoteStep >= participantNames.length;
  const showVotingUI = !isLocal && draftId && votingConfigured && votingOpen && participantNames.length > 0;
  const showVotingClosed = draftId && votingConfigured && !votingOpen;

  return (
    <div className="p-6 rounded-lg">
      <div className="w-full flex flex-col items-stretch gap-4">
        <div className="text-center">
          <div className="text-[#FCFFFF] text-xl font-brockmann font-medium">Draft Complete!</div>
          <div className="text-[#BDC3C2] text-sm font-brockmann mt-1">All players have made their selections.</div>
        </div>

        {showSetupForm && (
          <div
            className="w-full rounded-lg flex flex-wrap justify-center align-content-start"
            style={{
              background: 'var(--Section-Container, #0E0E0F)',
              boxShadow: '0px 0px 6px #3B0394',
              borderRadius: 8,
            }}
          >
            <div className="flex-1 min-w-0 p-6 flex flex-col gap-6 items-center text-center" style={{ minWidth: 295 }}>
              <div className="flex flex-col justify-center items-center gap-2">
                <div className="text-center font-brockmann font-medium text-[20px] leading-[28px] text-[var(--Text-Primary,#FCFFFF)]">Enable Voting?</div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 w-full min-w-0">
                <button
                  type="button"
                  onClick={() => setAddVoting(true)}
                  className="flex-1 min-w-0 py-3 px-6 rounded font-brockmann font-medium text-sm leading-5 text-[var(--Text-Primary,#FCFFFF)] transition-colors"
                  style={{
                    background: addVoting === true ? 'var(--Brand-Primary, #7142FF)' : 'var(--UI-Primary, #1D1D1F)',
                    outline: '1px solid var(--Item-Stroke, #49474B)',
                    outlineOffset: -1,
                  }}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setAddVoting(false)}
                  className="flex-1 min-w-0 py-3 px-6 rounded font-brockmann font-medium text-sm leading-5 text-[var(--Text-Primary,#FCFFFF)] transition-colors"
                  style={{
                    background: addVoting === false ? 'var(--Brand-Primary, #7142FF)' : 'var(--UI-Primary, #1D1D1F)',
                    outline: '1px solid var(--Item-Stroke, #49474B)',
                    outlineOffset: -1,
                  }}
                >
                  No
                </button>
              </div>
              {addVoting === true && !isLocal && (
                <>
                  <div className="flex flex-col justify-center items-center gap-2">
                    <div className="text-center font-brockmann font-medium text-[20px] leading-[28px] text-[var(--Text-Primary,#FCFFFF)]">Gather Public Votes?</div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 w-full min-w-0">
                    <button
                      type="button"
                      onClick={() => setVotingPublic(true)}
                      className="flex-1 min-w-0 py-3 px-6 rounded font-brockmann font-medium text-sm leading-5 text-[var(--Text-Primary,#FCFFFF)] transition-colors"
                      style={{
                        background: votingPublic === true ? 'var(--Brand-Primary, #7142FF)' : 'var(--UI-Primary, #1D1D1F)',
                        outline: '1px solid var(--Item-Stroke, #49474B)',
                        outlineOffset: -1,
                      }}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setVotingPublic(false)}
                      className="flex-1 min-w-0 py-3 px-6 rounded font-brockmann font-medium text-sm leading-5 text-[var(--Text-Primary,#FCFFFF)] transition-colors"
                      style={{
                        background: votingPublic === false ? 'var(--Brand-Primary, #7142FF)' : 'var(--UI-Primary, #1D1D1F)',
                        outline: '1px solid var(--Item-Stroke, #49474B)',
                        outlineOffset: -1,
                      }}
                    >
                      No
                    </button>
                  </div>
                  <div className="flex flex-col justify-center items-center gap-2">
                    <div className="text-center font-brockmann font-medium text-[20px] leading-[28px] text-[var(--Text-Primary,#FCFFFF)]">Set A Time Limit</div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 w-full min-w-0">
                    {DURATION_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setVotingDuration(opt.value)}
                        className="flex-1 min-w-0 py-3 px-6 rounded font-brockmann font-medium text-sm leading-5 text-[var(--Text-Primary,#FCFFFF)] transition-colors"
                        style={{
                          background: votingDuration === opt.value ? 'var(--Brand-Primary, #7142FF)' : 'var(--UI-Primary, #1D1D1F)',
                          outline: '1px solid var(--Item-Stroke, #49474B)',
                          outlineOffset: -1,
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={submittingSetup}
                    onClick={handleSetupSubmit}
                    className="w-fit py-3 px-6 rounded-sm font-brockmann font-semibold text-base leading-6 tracking-[0.32px] text-[var(--Text-Primary,#FCFFFF)] disabled:opacity-50 transition-opacity"
                    style={{ background: 'var(--Brand-Primary, #7142FF)' }}
                  >
                    {submittingSetup ? 'Enabling...' : 'Begin Voting'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {localVotingInProgress && (
          <div className="flex flex-col gap-3 p-4 rounded-lg bg-greyscale-purp-900 border border-greyscale-purp-800">
            <div className="text-greyscale-blue-100 font-brockmann font-semibold flex items-center gap-2">
              <Vote className="w-4 h-4" /> Step {localVoteStep + 1} of {participantNames.length}: As <span className="text-greyscale-blue-50">{participantNames[localVoteStep]}</span>, who do you vote for?
            </div>
            <div className="flex flex-wrap gap-2">
              {participantNames.filter(name => name !== participantNames[localVoteStep]).map(name => (
                <Button
                  key={name}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const currentVoter = participantNames[localVoteStep];
                    setLocalVotes(prev => ({ ...prev, [currentVoter]: name }));
                    setLocalVoteStep(prev => prev + 1);
                  }}
                >
                  {name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {localVotingComplete && (
          <div className="text-greyscale-blue-200 text-sm font-brockmann text-center py-2">All votes recorded.</div>
        )}

        {showVotingUI && (
          <div className="flex flex-col gap-3 p-4 rounded-lg bg-greyscale-purp-900 border border-greyscale-purp-800">
            <div className="text-greyscale-blue-100 font-brockmann font-semibold flex items-center gap-2">
              <Vote className="w-4 h-4" /> Who do you think won?
            </div>
            {myVote ? (
              <div className="p-3 rounded-lg bg-greyscale-purp-800 border border-greyscale-purp-700 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="text-greyscale-blue-200 font-brockmann">
                  You voted for <span className="font-semibold text-greyscale-blue-100">{myVote.voted_player_name}</span>
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {participantNames.map(name => (
                  <Button
                    key={name}
                    variant="outline"
                    size="sm"
                    disabled={submittingVote}
                    onClick={() => handleVote(name)}
                  >
                    {name}
                  </Button>
                ))}
              </div>
            )}
            {!loadingVotes && voteCounts.some(v => v.count > 0) && (
              <div className="text-greyscale-blue-300 text-xs font-brockmann pt-1">
                {voteCounts.filter(v => v.count > 0).map(v => `${v.name}: ${v.count}`).join(' · ')}
              </div>
            )}
          </div>
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
          <div className="flex flex-col items-center gap-2 pt-2">
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <Button
                variant="outline"
                size="sm"
                className="rounded-[2px] flex items-center gap-2 text-greyscale-blue-200 border-greyscale-purp-700"
                onClick={() => {
                  const url = `${window.location.origin}/vote/${draftId}`;
                  navigator.clipboard.writeText(url);
                  toast({ title: 'Link copied', description: 'Share link copied to clipboard.' });
                }}
              >
                <Copy className="w-4 h-4" />
                Copy share link
              </Button>
              <div className="flex items-center gap-2">
                <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : ''}/vote/${draftId}`} size={96} className="rounded border border-greyscale-purp-700 bg-white p-1" />
                <span className="text-greyscale-blue-300 text-xs font-brockmann">QR code</span>
              </div>
            </div>
          </div>
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
