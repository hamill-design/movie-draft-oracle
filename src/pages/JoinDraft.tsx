import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
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
  const { user, guestSession, loading: authLoading, getOrCreateGuestSession } = useAuth();
  const { toast } = useToast();
  const { joinDraftByCode, loading } = useMultiplayerDraft();
  const [isRetryingGuest, setIsRetryingGuest] = useState(false);

  const [inviteCode, setInviteCode] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [isEmailInvite, setIsEmailInvite] = useState(false);
  const [isAutoJoining, setIsAutoJoining] = useState(false);

  const invitedEmail = searchParams.get('email');
  const autoJoin = searchParams.get('auto') === 'true';

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

  // Auto-join effect for email invitations (works for both authenticated and guest)
  useEffect(() => {
    if (autoJoin && draftId && (user || guestSession) && invitedEmail && !isAutoJoining) {
      handleAutoJoin();
    }
  }, [autoJoin, draftId, user, guestSession, invitedEmail, isAutoJoining]);

  const handleAutoJoin = async () => {
    if (!draftId || !invitedEmail || (!user && !guestSession)) return;
    
    setIsAutoJoining(true);
    
    try {
      const { data: inviteCode, error } = await supabase.rpc('get_invite_code_for_draft', { p_draft_id: draftId });
      if (error || !inviteCode) {
        throw new Error('Invalid or expired invitation');
      }

      const id = await joinDraftByCode(inviteCode, invitedEmail);
      if (id) navigate(`/draft/${id}`);
    } catch (error) {
      console.error('Auto-join failed:', error);
      toast({
        title: "Auto-join Failed",
        description: "Unable to automatically join the draft. Please try manually.",
        variant: "destructive",
      });
      setIsAutoJoining(false);
    }
  };

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
      const id = await joinDraftByCode(inviteCode.trim().toUpperCase(), participantName.trim());
      if (id) navigate(`/draft/${id}`);
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
      const { data: inviteCode, error } = await supabase.rpc('get_invite_code_for_draft', { p_draft_id: draftId });
      if (error || !inviteCode) {
        throw new Error('Invalid or expired invitation');
      }

      const id = await joinDraftByCode(inviteCode, participantName.trim());
      if (id) navigate(`/draft/${id}`);
    } catch (error) {
      console.error('Failed to join draft via email:', error);
      toast({
        title: "Error",
        description: "Failed to join draft. The invitation may be invalid or expired.",
        variant: "destructive",
      });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user && !guestSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Sign In or Join as Guest</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Sign in with your account, or join as a guest to continue without an account.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => navigate('/auth')}>
                Sign In
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  setIsRetryingGuest(true);
                  try {
                    await getOrCreateGuestSession();
                  } catch {
                    toast({
                      title: "Could not join as guest",
                      description: "Please try again or sign in.",
                      variant: "destructive",
                    });
                  } finally {
                    setIsRetryingGuest(false);
                  }
                }}
                disabled={isRetryingGuest}
              >
                {isRetryingGuest ? 'Joining...' : 'Join as guest'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show auto-joining state
  if (isAutoJoining) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Users className="h-6 w-6" />
              Joining Draft
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
            <p className="text-muted-foreground">
              Automatically joining the draft...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Movie Drafter - Join Draft</title>
        <meta name="description" content="Join an existing movie draft by entering an invite code or following an invitation link. Compete with friends and see who picks the best movies." />
        <meta property="og:title" content="Movie Drafter - Join Draft" />
        <meta property="og:description" content="Join an existing movie draft by entering an invite code or following an invitation link. Compete with friends and see who picks the best movies." />
        <meta property="og:url" content={`https://moviedrafter.com/join-draft${draftId ? `/${draftId}` : ''}`} />
        <meta property="og:image" content="https://moviedrafter.com/og-image.jpg?v=2" />
        <meta name="twitter:title" content="Movie Drafter - Join Draft" />
        <meta name="twitter:description" content="Join an existing movie draft by entering an invite code or following an invitation link. Compete with friends and see who picks the best movies." />
        <meta name="twitter:image" content="https://moviedrafter.com/og-image.jpg?v=2" />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
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
          {isEmailInvite && !autoJoin ? (
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
    </>
  );
};