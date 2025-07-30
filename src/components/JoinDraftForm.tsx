
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
import { validateInviteCode, validateParticipantName, sanitizeHtml } from '@/utils/inputValidation';

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Join Existing Draft
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Have an invite code? Join a multiplayer draft session
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleJoin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-code" className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Invite Code
            </Label>
            <Input
              id="invite-code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="Enter 8-character code"
              maxLength={8}
              className="font-mono tracking-wider text-center"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="participant-name">Your Display Name</Label>
            <Input
              id="participant-name"
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>
          
          <Button 
            type="submit"
            disabled={isButtonDisabled}
            className="w-full"
          >
            {(loading || isJoining) ? 'Joining...' : 'Join Draft'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
