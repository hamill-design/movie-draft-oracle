
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Calendar, Users, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDrafts } from '@/hooks/useDrafts';

interface LocationState {
  draftId: string;
}

const DraftResults = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { getDraftWithPicks } = useDrafts();
  const [draft, setDraft] = useState<any>(null);
  const [picks, setPicks] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const state = location.state as LocationState;
  const draftId = state?.draftId;

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!draftId) {
      navigate('/profile');
      return;
    }

    const fetchDraftData = async () => {
      try {
        const { draft: draftData, picks: picksData } = await getDraftWithPicks(draftId);
        setDraft(draftData);
        setPicks(picksData || []);
      } catch (error) {
        console.error('Error fetching draft data:', error);
        navigate('/profile');
      } finally {
        setLoadingData(false);
      }
    };

    fetchDraftData();
  }, [draftId, getDraftWithPicks, navigate]);

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user || !draft) {
    return null;
  }

  // Group picks by player
  const picksByPlayer = picks.reduce((acc, pick) => {
    if (!acc[pick.player_name]) {
      acc[pick.player_name] = [];
    }
    acc[pick.player_name].push(pick);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/profile')}
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <ArrowLeft size={16} className="mr-2" />
              Back to Profile
            </Button>
            <h1 className="text-3xl font-bold text-white">Draft Results</h1>
          </div>
        </div>

        {/* Draft Info */}
        <Card className="bg-gray-800 border-gray-600 mb-8">
          <CardHeader>
            <CardTitle className="text-white text-2xl">{draft.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 text-gray-300">
              <div className="flex items-center gap-2">
                <Calendar size={16} />
                {new Date(draft.created_at).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-2">
                <Users size={16} />
                {draft.participants.length} players
              </div>
              <div className="flex items-center gap-2">
                <Trophy size={16} />
                {draft.categories.length} categories
              </div>
            </div>
            <div className="mt-4">
              <span className="text-yellow-400 font-medium">
                {draft.theme === 'year' ? 'Year' : 'Person'}: {draft.option}
              </span>
              {draft.is_complete && (
                <span className="ml-4 bg-green-600 text-white px-2 py-1 rounded text-xs">
                  Complete
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Draft Results */}
        <div className="grid gap-6">
          {Object.entries(picksByPlayer).map(([playerName, playerPicks]) => (
            <Card key={playerName} className="bg-gray-800 border-gray-600">
              <CardHeader>
                <CardTitle className="text-white text-xl">{playerName}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {playerPicks
                    .sort((a, b) => a.pick_order - b.pick_order)
                    .map((pick) => (
                      <div
                        key={pick.id}
                        className="bg-gray-700 border border-gray-600 rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-white font-semibold text-lg">
                              {pick.movie_title}
                            </h3>
                            {pick.movie_year && (
                              <p className="text-gray-400">({pick.movie_year})</p>
                            )}
                            {pick.movie_genre && (
                              <p className="text-gray-400">{pick.movie_genre}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="bg-yellow-400 text-black px-2 py-1 rounded text-sm font-medium">
                              {pick.category}
                            </span>
                            <p className="text-gray-400 text-sm mt-1">
                              Pick #{pick.pick_order}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {picks.length === 0 && (
          <Card className="bg-gray-800 border-gray-600">
            <CardContent className="pt-6">
              <p className="text-gray-400 text-center py-8">
                No picks found for this draft.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DraftResults;
