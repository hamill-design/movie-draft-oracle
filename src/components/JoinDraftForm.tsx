
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
  const { user } = useAuth();
  const { toast } = useToast();
  const { joinDraftByCode, loading } = useMultiplayerDraft();
  const { getDisplayName, profile, loading: profileLoading } = useProfile();

  const [inviteCode, setInviteCode] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [hasSetInitialName, setHasSetInitialName] = useState(false);

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
    
    if (!inviteCode.trim() || !participantName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both invite code and your name",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to join a draft",
        variant: "destructive",
      });
      navigate('/auth');
      return;
    }

    try {
      await joinDraftByCode(inviteCode.trim().toUpperCase(), participantName.trim());
    } catch (error) {
      console.error('Failed to join draft:', error);
    }
  };

  const isFormValid = inviteCode.trim() && participantName.trim();
  const isButtonDisabled = loading || !isFormValid;

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
            {loading ? 'Joining...' : 'Join Draft'}
          </Button>
          
          {!user && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <p className="text-sm text-amber-800 text-center">
                You need to{' '}
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={() => navigate('/auth')}
                  className="p-0 h-auto text-amber-600 hover:text-amber-800"
                >
                  sign in
                </Button>{' '}
                to join drafts
              </p>
            </div>
          )}

          {/* Debug info for development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Debug: Code: "{inviteCode}", Name: "{participantName}", User: {user ? 'Yes' : 'No'}</div>
              <div>Form valid: {isFormValid ? 'Yes' : 'No'}, Button disabled: {isButtonDisabled ? 'Yes' : 'No'}</div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
};
