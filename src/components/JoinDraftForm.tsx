
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
    
    // Add debugging logs
    console.log('🔍 JOIN DEBUG - Button clicked, form data:', {
      inviteCode: inviteCode.trim(),
      participantName: participantName.trim(),
      isJoining,
      loading,
      user: !!user,
      guestSession: !!guestSession
    });
    
    // Prevent multiple simultaneous join attempts
    if (isJoining) {
      console.log('🔍 JOIN DEBUG - Already joining, preventing duplicate request');
      return;
    }
    
    if (!inviteCode.trim() || !participantName.trim()) {
      console.log('🔍 JOIN DEBUG - Validation failed');
      toast({
        title: "Missing Information",
        description: "Please enter both invite code and your name",
        variant: "destructive",
      });
      return;
    }

    if (!user && !guestSession) {
      console.log('🔍 JOIN DEBUG - No user or guest session');
      toast({
        title: "Session Required",
        description: "Please refresh the page and try again",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('🔍 JOIN DEBUG - Starting join process...');
      setIsJoining(true);
      await joinDraftByCode(inviteCode.trim().toUpperCase(), participantName.trim());
      console.log('🔍 JOIN DEBUG - Join completed successfully');
    } catch (error: any) {
      console.error('🔍 JOIN DEBUG - Join failed:', error);
      
      // Provide more specific error messages
      if (error.message?.includes('duplicate key')) {
        toast({
          title: "Already Joined",
          description: "You're already a participant in this draft",
          variant: "default",
        });
      } else if (error.message?.includes('Draft not found')) {
        toast({
          title: "Invalid Code",
          description: "No draft found with this invite code",
          variant: "destructive",
        });
      }
    } finally {
      console.log('🔍 JOIN DEBUG - Cleaning up join state');
      setIsJoining(false);
    }
  };

  const isFormValid = inviteCode.trim() && participantName.trim();
  const isButtonDisabled = loading || !isFormValid || isJoining;

  // Add debugging for button state
  console.log('🔍 JOIN DEBUG - Button state:', {
    loading,
    isFormValid,
    isJoining,
    isButtonDisabled,
    inviteCode: inviteCode.length,
    participantName: participantName.length
  });

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
            onClick={(e) => {
              console.log('🔍 JOIN DEBUG - Button onClick triggered');
              // Don't prevent default here since we want the form submission to work
            }}
          >
            {(loading || isJoining) ? 'Joining...' : 'Join Draft'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
