
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMultiplayerDraft } from '@/hooks/useMultiplayerDraft';
import { useToast } from '@/hooks/use-toast';
import { useProfile } from '@/hooks/useProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Hash, Users } from 'lucide-react';
import { FilmReelIcon } from '@/components/icons';
import { validateInviteCode, validateParticipantName, sanitizeHtml } from '@/utils/inputValidation';
import { HeaderIcon3 } from '@/components/HeaderIcon3';

export const JoinDraftForm = () => {
  const navigate = useNavigate();
  const { user, guestSession } = useAuth();
  const { toast } = useToast();
  const { joinDraftByCode, loading } = useMultiplayerDraft();
  const { getDisplayName, profile, loading: profileLoading } = useProfile();

  const [inviteCode, setInviteCode] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [hasSetInitialName, setHasSetInitialName] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Memoize the display name to prevent unnecessary re-renders
  const displayName = useMemo(() => {
    return profileLoading ? '' : getDisplayName();
  }, [getDisplayName, profileLoading]);

  useEffect(() => {
    // Only set the initial name once when profile loads
    if (!profileLoading && !hasSetInitialName && displayName) {
      setParticipantName(displayName);
      setHasSetInitialName(true);
    }
  }, [displayName, profileLoading, hasSetInitialName]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent multiple simultaneous join attempts
    if (isJoining) return;
    
    // Validate invite code
    const inviteValidation = validateInviteCode(inviteCode);
    if (!inviteValidation.isValid) {
      toast({
        title: "Invalid Invite Code",
        description: inviteValidation.error,
        variant: "destructive",
      });
      return;
    }
    
    // Validate participant name
    const nameValidation = validateParticipantName(participantName);
    if (!nameValidation.isValid) {
      toast({
        title: "Invalid Name",
        description: nameValidation.error,
        variant: "destructive",
      });
      return;
    }

    if (!user && !guestSession) {
      toast({
        title: "Session Required",
        description: "Please refresh the page and try again",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsJoining(true);
      const draftId = await joinDraftByCode(inviteCode.trim().toUpperCase(), participantName.trim());
      
      // Navigate to the draft page
      navigate(`/draft/${draftId}`);
    } catch (error: any) {
      // Error handling is already done in the hook
      console.error('Failed to join draft:', error);
    } finally {
      setIsJoining(false);
    }
  };

  const isFormValid = !!(inviteCode.trim() && participantName.trim());
  const isButtonDisabled = loading || !isFormValid || isJoining;

  return (
    <div className="w-full h-full p-6 bg-greyscale-blue-100 rounded flex flex-col items-start gap-6" style={{boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.25)'}}>
      <div className="self-stretch flex flex-col items-start gap-1">
        <HeaderIcon3 title="Join A Draft" icon={<FilmReelIcon className="w-6 h-6 text-primary" />} />
        <div className="self-stretch flex flex-col items-start">
          <div className="self-stretch flex flex-col justify-center text-muted-foreground text-sm font-normal leading-5 font-brockmann">
            Have an invite code? Join a multiplayer draft session
          </div>
        </div>
      </div>
      <form onSubmit={handleJoin} className="self-stretch flex flex-col items-start gap-6">
        <div className="self-stretch flex flex-col items-start gap-5">
          <div className="self-stretch flex flex-col items-center">
            <div className="self-stretch px-4 py-3 bg-ui-primary overflow-hidden rounded-[2px] border border-muted-foreground focus-within:border-foreground flex items-center gap-3">
              <div className="flex-1 overflow-hidden flex flex-col items-center">
                <input
                  id="invite-code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Enter 8-digit Invite Code"
                  maxLength={8}
                  className="self-stretch text-center flex flex-col justify-center text-foreground placeholder:text-muted-foreground text-lg font-medium leading-7 tracking-wide font-mono bg-transparent border-0 outline-none"
                />
              </div>
            </div>
          </div>
          <div className="self-stretch flex flex-col items-start gap-3">
            <div className="flex flex-col justify-center text-foreground text-sm font-medium leading-5 font-brockmann">
              Your Display Name
            </div>
            <div className="self-stretch flex flex-col items-start">
              <div className="self-stretch px-4 py-3 bg-ui-primary overflow-hidden rounded-[2px] border border-muted-foreground focus-within:border-foreground flex items-center gap-3">
                <div className="flex-1 overflow-hidden flex flex-col items-start">
                  <input
                    id="participant-name"
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    placeholder="Enter Display Name"
                    className="flex flex-col justify-center text-foreground placeholder:text-muted-foreground text-sm font-medium leading-5 font-brockmann bg-transparent border-0 outline-none w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <button
          type="submit"
          disabled={isButtonDisabled}
          className="self-stretch px-6 py-3 bg-brand-primary rounded flex justify-center items-center disabled:opacity-50"
        >
          <div className="text-center flex flex-col justify-center text-primary-foreground text-base font-semibold leading-6 tracking-wide font-brockmann">
            {(loading || isJoining) ? 'Joining...' : 'Join Draft'}
          </div>
        </button>
      </form>
    </div>
  );
};
