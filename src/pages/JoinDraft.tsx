import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMultiplayerDraft } from '@/hooks/useMultiplayerDraft';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Users, Mail, Hash } from 'lucide-react';

export const JoinDraft = () => {
  const { draftId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { joinDraftByCode, loading } = useMultiplayerDraft();

  const [inviteCode, setInviteCode] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [isEmailInvite, setIsEmailInvite] = useState(false);

  const invitedEmail = searchParams.get('email');

  useEffect(() => {
    // Check if this is an email invitation
    if (draftId && invitedEmail) {
      setIsEmailInvite(true);
      setParticipantName(invitedEmail);
    }
    
    // Pre-fill participant name with user email if available
    if (user?.email && !participantName) {
      setParticipantName(user.email);
    }
  }, [draftId, invitedEmail, user?.email, participantName]);

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
      await joinDraftByCode(inviteCode.trim().toUpperCase(), participantName.trim());
    } catch (error) {
      console.error('Failed to join draft:', error);
    }
  };

  const handleJoinByEmailInvite = async () => {
    if (!draftId || !participantName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter your name to join",
        variant: "destructive",
      });
      return;
    }

    try {
      // For email invites, we need to get the invite code from the draft
      // and then use the normal join flow
      const { data: draftData, error } = await supabase
        .from('drafts')
        .select('invite_code')
        .eq('id', draftId)
        .single();

      if (error || !draftData?.invite_code) {
        throw new Error('Invalid or expired invitation');
      }

      await joinDraftByCode(draftData.invite_code, participantName.trim());
    } catch (error) {
      console.error('Failed to join draft via email:', error);
      toast({
        title: "Error",
        description: "Failed to join draft. The invitation may be invalid or expired.",
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Sign In Required</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              You need to sign in to join a draft
            </p>
            <Button onClick={() => navigate('/auth')}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Users className="h-6 w-6" />
            Join Draft
          </CardTitle>
          <p className="text-muted-foreground">
            Join a multiplayer movie draft session
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {isEmailInvite ? (
            // Email invitation flow
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                Email Invitation
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Invited Email</Label>
                <Input
                  id="email"
                  value={invitedEmail || ''}
                  disabled
                  className="bg-muted"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">Your Display Name</Label>
                <Input
                  id="name"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>
              
              <Button 
                onClick={handleJoinByEmailInvite}
                disabled={loading || !participantName.trim()}
                className="w-full"
              >
                {loading ? 'Joining...' : 'Join Draft'}
              </Button>
            </div>
          ) : (
            // Invite code flow
            <form onSubmit={handleJoinByCode} className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Hash className="h-4 w-4" />
                Invite Code
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="code">Invite Code</Label>
                <Input
                  id="code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Enter 8-character code"
                  maxLength={8}
                  className="font-mono tracking-wider text-center"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">Your Display Name</Label>
                <Input
                  id="name"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>
              
              <Button 
                type="submit"
                disabled={loading || !inviteCode.trim() || !participantName.trim()}
                className="w-full"
              >
                {loading ? 'Joining...' : 'Join Draft'}
              </Button>
            </form>
          )}
          
          <Separator />
          
          <div className="text-center">
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="w-full"
            >
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};