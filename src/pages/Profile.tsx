
import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Calendar, Users, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDrafts } from '@/hooks/useDrafts';

const Profile = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { drafts, loading: draftsLoading } = useDrafts();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleViewDraft = async (draft: any) => {
    navigate('/draft', {
      state: {
        theme: draft.theme,
        option: draft.option,
        participants: draft.participants,
        categories: draft.categories,
        existingDraftId: draft.id,
        isMultiplayer: draft.is_multiplayer
      }
    });
  };

  if (loading || draftsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <ArrowLeft size={16} className="mr-2" />
              Back to Home
            </Button>
            <h1 className="text-3xl font-bold text-white">My Profile</h1>
          </div>
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            Sign Out
          </Button>
        </div>

        {/* User Info */}
        <Card className="bg-gray-800 border-gray-600 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-300">
              <strong>Email:</strong> {user.email}
            </p>
            <p className="text-gray-300">
              <strong>Total Drafts:</strong> {drafts.length}
            </p>
          </CardContent>
        </Card>

        {/* Saved Drafts */}
        <Card className="bg-gray-800 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white">Saved Drafts</CardTitle>
          </CardHeader>
          <CardContent>
            {drafts.length === 0 ? (
              <p className="text-gray-400 text-center py-8">
                No saved drafts yet. Start a new draft to see it here!
              </p>
            ) : (
              <div className="grid gap-4">
                {drafts.map((draft) => (
                  <Card key={draft.id} className="bg-gray-700 border-gray-600">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-white font-semibold text-lg mb-2">
                            {draft.title}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-gray-300">
                            <div className="flex items-center gap-1">
                              <Calendar size={14} />
                              {new Date(draft.created_at).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-1">
                              <Users size={14} />
                              {draft.participants.length} players
                            </div>
                            <div className="flex items-center gap-1">
                              <Trophy size={14} />
                              {draft.categories.length} categories
                            </div>
                          </div>
                          <div className="mt-2">
                            <span className="text-yellow-400 font-medium">
                              {draft.theme === 'year' ? 'Year' : 'Person'}: {draft.option}
                            </span>
                            {draft.is_complete && (
                              <span className="ml-4 bg-green-600 text-white px-2 py-1 rounded text-xs">
                                Complete
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => handleViewDraft(draft)}
                          className="bg-yellow-400 text-black hover:bg-yellow-500"
                        >
                          {draft.is_complete ? 'View Draft' : 'Continue Draft'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
