import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Users, User } from 'lucide-react';
import { CheckboxIcon } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import { useMultiplayerDraft } from '@/hooks/useMultiplayerDraft';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
// Simple checkbox component for category selection with live counter
const CategoryCheckbox = ({ 
  category, 
  isChecked, 
  onToggle,
  movieCount
}: { 
  category: string; 
  isChecked: boolean; 
  onToggle: (checked: boolean) => void;
  movieCount: number;
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getCheckboxStyle = () => {
    const baseStyle: React.CSSProperties = {
      width: '16px',
      height: '16px',
      borderRadius: '4px',
      outline: '1px #907AFF solid',
      outlineOffset: '-1px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    };
    
    if (isChecked) {
      return {
        ...baseStyle,
        background: '#680AFF',
      };
    }
    return baseStyle;
  };

  const getCheckmarkElement = () => {
    if (isChecked || isHovered) {
      const strokeColor = isChecked ? 'white' : '#907AFF';
      return (
        <svg width="9.33" height="6.42" viewBox="0 0 12 8" fill="none">
          <path 
            d="M10.6667 0.791687L4.25 7.20835L1.33333 4.29169" 
            stroke={strokeColor} 
            strokeWidth="1.16667" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    return null;
  };

  const getCountBadgeStyle = () => {
    // Determine status based on count (similar to EnhancedCategoriesForm logic)
    // For now, we'll use green for any count > 0
    const backgroundColor = movieCount > 0 ? '#ADF2CC' : '#F5F5F5';
    const borderColor = movieCount > 0 ? '#13CE66' : '#CCCCCC';
    
    return {
      paddingLeft: '4px',
      paddingRight: '4px',
      paddingTop: '2px',
      paddingBottom: '2px',
      background: backgroundColor,
      borderRadius: '4px',
      outline: `1px ${borderColor} solid`,
      outlineOffset: '-1px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    };
  };

  return (
    <div 
      className="flex items-center gap-2 cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onToggle(!isChecked)}
    >
      <div style={getCheckboxStyle()}>
        {getCheckmarkElement()}
      </div>
      <span 
        className="text-text-primary"
        style={{ 
          fontFamily: 'Brockmann', 
          fontWeight: 500, 
          fontSize: '14px', 
          lineHeight: '20px' 
        }}
      >
        {category}
      </span>
      <div style={getCountBadgeStyle()}>
        <span 
          style={{ 
            fontFamily: 'Brockmann', 
            fontWeight: 400, 
            fontSize: '12px', 
            lineHeight: '16px',
            color: '#2B2D2D'
          }}
        >
          {movieCount.toString().padStart(2, '0')}
        </span>
      </div>
    </div>
  );
};

interface SpecDraft {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
}

interface SpecDraftCategory {
  id: string;
  spec_draft_id: string;
  category_name: string;
  description: string | null;
}


const SpecDraftSetup = () => {
  const { specDraftId } = useParams<{ specDraftId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createMultiplayerDraft, loading: creatingDraft } = useMultiplayerDraft();
  const { user } = useAuth();
  const { getDisplayName, profile, loading: profileLoading } = useProfile();

  const [specDraft, setSpecDraft] = useState<SpecDraft | null>(null);
  const [, setCustomCategories] = useState<SpecDraftCategory[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [draftMode, setDraftMode] = useState<'local' | 'multiplayer'>('local');
  const [participants, setParticipants] = useState<string[]>([]);
  const [newParticipant, setNewParticipant] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Record<string, boolean>>({});

  // Get host name for multiplayer mode
  const hostName = useMemo(() => {
    if (profileLoading) return '';
    return getDisplayName();
  }, [getDisplayName, profileLoading]);

  // Automatically add host when switching to multiplayer mode
  useEffect(() => {
    if (draftMode === 'multiplayer' && hostName) {
      // Add host if not already in participants
      if (!participants.includes(hostName)) {
        setParticipants([hostName, ...participants]);
      }
    } else if (draftMode === 'local') {
      // Remove host when switching back to local mode
      setParticipants(participants.filter(p => p !== hostName));
    }
  }, [draftMode, hostName]);

  // Standard categories
  const standardCategories = [
    'Action/Adventure',
    'Animated',
    'Comedy',
    'Drama/Romance',
    'Sci-Fi/Fantasy',
    'Horror/Thriller',
    "30's",
    "40's",
    "50's",
    "60's",
    "70's",
    "80's",
    "90's",
    "2000's",
    "2010's",
    "2020's",
    'Academy Award Nominee or Winner',
    'Blockbuster (minimum of $50 Mil)',
  ];

  useEffect(() => {
    const fetchSpecDraft = async () => {
      if (!specDraftId) return;

      try {
        setLoading(true);

        // Fetch spec draft
        const draftResult = await (supabase
          .from('spec_drafts' as any)
          .select('id, name, description, photo_url, created_at, updated_at')
          .eq('id', specDraftId)
          .single()) as { data: SpecDraft | null; error: any };
        const { data: draftData, error: draftError } = draftResult;

        if (draftError) throw draftError;
        if (!draftData) {
          toast({
            title: 'Error',
            description: 'Spec draft not found',
            variant: 'destructive',
          });
          navigate('/');
          return;
        }

        setSpecDraft(draftData);

        // Fetch custom categories
        const customCatsResult = await (supabase
          .from('spec_draft_categories' as any)
          .select('*')
          .eq('spec_draft_id', specDraftId)) as { data: SpecDraftCategory[] | null; error: any };
        const { data: customCats, error: customError } = customCatsResult;

        if (customError) {
          console.error('Error fetching custom categories:', customError);
        } else {
          setCustomCategories(customCats || []);
        }

        // Fetch movies to get all unique categories and counts
        const moviesResult = await (supabase
          .from('spec_draft_movies' as any)
          .select('id')
          .eq('spec_draft_id', specDraftId)) as { data: Array<{ id: string }> | null; error: any };
        const { data: moviesData, error: moviesError } = moviesResult;

        if (moviesError) {
          console.error('Error fetching movies:', moviesError);
        } else if (moviesData && moviesData.length > 0) {
          // Fetch categories for all movies
          const movieIds = moviesData.map(m => m.id);
          const categoriesResult = await (supabase
            .from('spec_draft_movie_categories' as any)
            .select('category_name')
            .in('spec_draft_movie_id', movieIds)) as { data: Array<{ category_name: string }> | null; error: any };
          const { data: categoriesData, error: categoriesError } = categoriesResult;

          if (categoriesError) {
            console.error('Error fetching movie categories:', categoriesError);
          } else if (categoriesData) {
            // Count movies per category
            const counts: Record<string, number> = {};
            categoriesData.forEach(cat => {
              counts[cat.category_name] = (counts[cat.category_name] || 0) + 1;
            });
            setCategoryCounts(counts);

            // Get unique categories
            const uniqueCategories = new Set<string>();
            categoriesData.forEach(cat => uniqueCategories.add(cat.category_name));
            
            // Combine standard, custom, and movie categories
            const allCats = [
              ...standardCategories,
              ...(customCats || []).map(c => c.category_name),
              ...Array.from(uniqueCategories),
            ];
            
            // Remove duplicates and sort
            const uniqueAllCats = Array.from(new Set(allCats));
            setAllCategories(uniqueAllCats);

            // Initialize all categories as unselected
            const initialSelection: Record<string, boolean> = {};
            uniqueAllCats.forEach(cat => {
              initialSelection[cat] = false;
            });
            setSelectedCategories(initialSelection);
          }
        } else {
          // No movies, just use standard and custom categories
          const allCats = [
            ...standardCategories,
            ...(customCats || []).map(c => c.category_name),
          ];
          const uniqueAllCats = Array.from(new Set(allCats));
          setAllCategories(uniqueAllCats);

          // Initialize counts as 0 for categories without movies
          const counts: Record<string, number> = {};
          uniqueAllCats.forEach(cat => {
            counts[cat] = 0;
          });
          setCategoryCounts(counts);

          // Initialize all categories as unselected
          const initialSelection: Record<string, boolean> = {};
          uniqueAllCats.forEach(cat => {
            initialSelection[cat] = false;
          });
          setSelectedCategories(initialSelection);
        }
      } catch (err) {
        console.error('Error fetching spec draft:', err);
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Failed to load spec draft',
          variant: 'destructive',
        });
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchSpecDraft();
  }, [specDraftId, navigate, toast]);

  const handleAddParticipant = () => {
    const trimmed = newParticipant.trim();
    if (trimmed && !participants.includes(trimmed)) {
      setParticipants([...participants, trimmed]);
      setNewParticipant('');
    }
  };

  const handleRemoveParticipant = (participant: string) => {
    // Don't allow removing the host in multiplayer mode
    if (draftMode === 'multiplayer' && participant === hostName) {
      toast({
        title: 'Cannot remove host',
        description: 'The host must remain as a participant in multiplayer drafts.',
        variant: 'default',
      });
      return;
    }
    setParticipants(participants.filter(p => p !== participant));
  };

  const handleCategoryToggle = (category: string, checked: boolean) => {
    setSelectedCategories(prev => ({
      ...prev,
      [category]: checked,
    }));
  };

  const handleCreateDraft = async () => {
    if (!specDraft) return;

    const selectedCats = Object.entries(selectedCategories)
      .filter(([_, checked]) => checked)
      .map(([category]) => category);

    if (selectedCats.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one category',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (draftMode === 'multiplayer') {
        // Create multiplayer draft
        // The host is automatically added by the backend, so we only send additional participants
        // Filter out the host from the participants list since they'll be added automatically
        // Allow empty array - others can join later with the invite code
        const additionalParticipants = participants.filter(p => p !== hostName);

        const draftId = await createMultiplayerDraft({
          title: specDraft.name,
          theme: 'spec-draft',
          option: specDraft.id,
          categories: selectedCats,
          participantEmails: additionalParticipants, // Only send additional participants, host is added automatically
        });

        navigate(`/draft/${draftId}`);
      } else {
        // Create local draft - navigate to draft page with state
        navigate('/draft', {
          state: {
            theme: 'spec-draft',
            option: specDraft.id,
            categories: selectedCats,
            participants: participants.length > 0 ? participants : ['Player 1'],
            draftMode: 'local',
          },
        });
      }
    } catch (err) {
      console.error('Error creating draft:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create draft',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(118deg, #FCFFFF -8.18%, #F0F1FF 53.14%, #FCFFFF 113.29%)'}}>
        <div className="text-text-primary text-xl">Loading...</div>
      </div>
    );
  }

  if (!specDraft) {
    return null;
  }

  const selectedCategoriesList = Object.entries(selectedCategories)
    .filter(([_, checked]) => checked)
    .map(([category]) => category);

  return (
    <div className="min-h-screen" style={{background: 'linear-gradient(118deg, #FCFFFF -8.18%, #F0F1FF 53.14%, #FCFFFF 113.29%)'}}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Draft Title - No background container */}
          <div className="w-full flex flex-col gap-4 items-center justify-center py-6">
            <div className="text-greyscale-blue-800 uppercase" style={{ fontFamily: 'Brockmann', fontWeight: 500, fontSize: '32px', lineHeight: '36px', letterSpacing: '1.28px' }}>
              SETTING UP
            </div>
            <div className="text-brand-primary uppercase" style={{ fontFamily: 'CHANEY', fontWeight: 400, fontSize: '64px', lineHeight: '64px' }}>
              {specDraft.name.toUpperCase()}
            </div>
          </div>

          {/* Select Draft Mode */}
          <div className="w-full p-6 bg-greyscale-blue-100 rounded-[8px] flex flex-col gap-6" style={{boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.25)'}}>
            <h3 className="text-2xl text-text-primary text-center" style={{ fontFamily: 'Brockmann', fontWeight: 700, fontSize: '24px', lineHeight: '32px', letterSpacing: '0.96px' }}>
              Select A Mode
            </h3>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => setDraftMode('local')}
                className={`flex-1 min-w-[294px] h-20 px-9 py-2 rounded-[6px] border flex justify-center items-center gap-4 text-lg font-medium transition-colors ${
                  draftMode === 'local'
                    ? 'bg-brand-primary border-brand-primary text-ui-primary'
                    : 'bg-ui-primary border-greyscale-blue-200 text-text-primary hover:bg-purple-100 hover:border-purple-200'
                }`}
                style={{ fontFamily: 'Brockmann', fontWeight: 500, fontSize: '18px', lineHeight: '26px' }}
              >
                <User className="w-6 h-6" />
                <span>Local Draft</span>
              </button>
              <button
                onClick={() => setDraftMode('multiplayer')}
                className={`flex-1 min-w-[294px] h-20 px-9 py-2 rounded-[6px] border flex justify-center items-center gap-4 text-lg font-medium transition-colors ${
                  draftMode === 'multiplayer'
                    ? 'bg-brand-primary border-brand-primary text-ui-primary'
                    : 'bg-ui-primary border-greyscale-blue-200 text-text-primary hover:bg-purple-100 hover:border-purple-200'
                }`}
                style={{ fontFamily: 'Brockmann', fontWeight: 500, fontSize: '18px', lineHeight: '26px' }}
              >
                <Users className="w-6 h-6" />
                <span>Online Multiplayer</span>
              </button>
            </div>
          </div>

          {/* Add Players */}
          <div className="w-full p-6 bg-greyscale-blue-100 rounded-[8px] flex flex-col gap-6" style={{boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.25)'}}>
            <div className="flex gap-2 items-center">
              <Users className="w-6 h-6 text-brand-primary" />
              <h3 className="text-xl text-text-primary" style={{ fontFamily: 'Brockmann', fontWeight: 500, fontSize: '20px', lineHeight: '28px' }}>
                Add Players
              </h3>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Enter player name, email, or ID"
                value={newParticipant}
                onChange={(e) => setNewParticipant(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddParticipant();
                  }
                }}
                className="flex-1"
                style={{ fontFamily: 'Brockmann', fontWeight: 500, fontSize: '14px' }}
              />
              <Button
                onClick={handleAddParticipant}
                className="bg-brand-primary text-ui-primary px-4 h-12 rounded-[2px]"
                style={{ fontFamily: 'Brockmann', fontWeight: 500, fontSize: '14px', lineHeight: '20px' }}
              >
                Add
              </Button>
            </div>

            {draftMode === 'multiplayer' && (
              <div className="bg-teal-100 border border-teal-700 rounded-[4px] p-4 flex gap-2 items-center">
                <div className="text-teal-700" style={{ fontFamily: 'Brockmann', fontWeight: 400, fontSize: '14px', lineHeight: '20px' }}>
                  <span style={{ fontFamily: 'Brockmann', fontWeight: 700 }}>Multiplayer Mode:</span> Share this link with your friends to invite them to your draft.
                </div>
              </div>
            )}

            {(participants.length > 0 || (draftMode === 'multiplayer' && hostName)) && (
              <div className="flex flex-col gap-3">
                <div className="text-greyscale-blue-600" style={{ fontFamily: 'Brockmann', fontWeight: 400, fontSize: '16px', lineHeight: '24px' }}>
                  Participants ({draftMode === 'multiplayer' 
                    ? (hostName ? participants.length : participants.length)
                    : participants.length}):
                </div>
                <div className="flex flex-wrap gap-2">
                  {draftMode === 'multiplayer' && hostName && (
                    <div
                      className="bg-purple-150 flex gap-2 items-center pl-4 pr-4 py-2 rounded-[4px] border-2 border-brand-primary"
                      title="Host (cannot be removed)"
                    >
                      <span className="text-text-primary" style={{ fontFamily: 'Brockmann', fontWeight: 500, fontSize: '14px', lineHeight: '20px' }}>
                        {hostName} (Host)
                      </span>
                    </div>
                  )}
                  {participants.filter(p => draftMode !== 'multiplayer' || p !== hostName).map((participant) => (
                    <div
                      key={participant}
                      className="bg-purple-150 flex gap-2 items-center pl-4 pr-2.5 py-2 rounded-[4px]"
                    >
                      <span className="text-text-primary" style={{ fontFamily: 'Brockmann', fontWeight: 500, fontSize: '14px', lineHeight: '20px' }}>
                        {participant}
                      </span>
                      <button
                        onClick={() => handleRemoveParticipant(participant)}
                        className="p-1 rounded-[6px] hover:bg-purple-200 transition-colors"
                      >
                        <X className="w-4 h-4 text-text-primary" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Select Categories */}
          <div className="w-full p-6 bg-greyscale-blue-100 rounded-[8px] flex flex-col gap-6" style={{boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.25)'}}>
            <div className="flex gap-2 items-center">
              <CheckboxIcon className="w-6 h-6 text-brand-primary" />
              <h3 className="text-xl text-text-primary" style={{ fontFamily: 'Brockmann', fontWeight: 500, fontSize: '20px', lineHeight: '28px' }}>
                Choose Categories
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {allCategories.map((category) => {
                const isChecked = selectedCategories[category] || false;
                const movieCount = categoryCounts[category] || 0;
                return (
                  <CategoryCheckbox
                    key={category}
                    category={category}
                    isChecked={isChecked}
                    onToggle={(checked) => handleCategoryToggle(category, checked)}
                    movieCount={movieCount}
                  />
                );
              })}
            </div>
          </div>

          {/* Create Draft Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleCreateDraft}
              disabled={creatingDraft || selectedCategoriesList.length === 0}
              className="bg-yellow-500 hover:bg-yellow-300 text-greyscale-blue-800 px-6 py-3 rounded-[2px] h-12"
              style={{ fontFamily: 'Brockmann', fontWeight: 600, fontSize: '16px', lineHeight: '24px' }}
            >
              {creatingDraft ? 'Creating...' : 'Create Draft'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpecDraftSetup;

