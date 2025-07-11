import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMultiplayerDraft } from '@/hooks/useMultiplayerDraft';
import { useToast } from '@/hooks/use-toast';
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

  const [inviteCode, setInviteCode] = useState('');
  const [participantName, setParticipantName] = useState(user?.email || '');

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
            disabled={loading || !inviteCode.trim() || !participantName.trim() || !user}
            className="w-full"
          >
            {loading ? 'Joining...' : 'Join Draft'}
          </Button>
          
          {!user && (
            <p className="text-xs text-muted-foreground text-center">
              <Button 
                variant="link" 
                size="sm" 
                onClick={() => navigate('/auth')}
                className="p-0 h-auto"
              >
                Sign in
              </Button> to join drafts
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
};