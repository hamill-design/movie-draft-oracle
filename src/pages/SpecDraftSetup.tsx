import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Users, User, Mail, Trash2 } from 'lucide-react';
import { CheckboxIcon, MultiPersonIcon } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import { useMultiplayerDraft } from '@/hooks/useMultiplayerDraft';
import { useProfile } from '@/hooks/useProfile';
// Simple checkbox component for category selection with live counter
const CategoryCheckbox = ({ 
  category, 
  isChecked, 
  onToggle,
  movieCount,
  playerCount = 2
}: { 
  category: string; 
  isChecked: boolean; 
  onToggle: (checked: boolean) => void;
  movieCount: number;
  playerCount?: number;
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Determine if category is disabled (insufficient movies)
  const isDisabled = movieCount < playerCount;

  const getCheckboxStyle = () => {
    const baseStyle: React.CSSProperties = {
      width: '16px',
      height: '16px',
      borderRadius: '4px',
      outline: '1px var(--Purple-300, #907AFF) solid',
      outlineOffset: '-1px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    };
    
    if (isDisabled) {
      return {
        ...baseStyle,
        backgroundColor: '#F5F5F5',
        outline: '1px #CCCCCC solid',
        opacity: 0.5
      };
    }
    
    if (isChecked) {
      return {
        ...baseStyle,
        background: 'var(--Brand-Primary, #7142FF)',
      };
    }
    return baseStyle;
  };

  const getCheckmarkElement = () => {
    if (isDisabled) return null;
    
    if (isChecked || isHovered) {
      const strokeColor = isChecked ? 'var(--Text-Primary, #FCFFFF)' : 'var(--Purple-300, #907AFF)';
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

  const getCountBadgeInfo = () => {
    // Determine status based on count compared to player count
    // Eligible (green): >= 2x player count
    // Limited (yellow): >= 1x player count but < 2x
    // Ineligible (red): < player count
    if (movieCount >= playerCount * 2) {
      // Eligible - Green
      return {
        backgroundColor: 'var(--Utility-Colors-Positive-Green-400, #41DA86)',
        borderColor: 'var(--Utility-Colors-Positive-Green-200, #ADF2CC)',
        textColor: 'var(--Utility-Colors-Positive-Green-900, #002912)'
      };
    } else if (movieCount >= playerCount) {
      // Limited - Yellow
      return {
        backgroundColor: 'var(--Yellow-400, #FFDF42)',
        borderColor: 'var(--Yellow-200, #FFF2B2)',
        textColor: 'var(--Yellow-900, #292200)'
      };
    } else {
      // Ineligible - Red
      return {
        backgroundColor: 'var(--Utility-Colors-Error-Red-400, #FF6C6C)',
        borderColor: 'var(--Utility-Colors-Error-Red-200, #FFC0C0)',
        textColor: 'var(--UI-Primary, #1D1D1F)'
      };
    }
  };

  const badgeInfo = getCountBadgeInfo();

  return (
    <div 
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        gap: '8px',
        display: 'inline-flex',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        width: '100%'
      }}
      onMouseEnter={() => !isDisabled && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => !isDisabled && onToggle(!isChecked)}
    >
      <div style={getCheckboxStyle()}>
        {getCheckmarkElement()}
      </div>
      <div style={{
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        display: 'inline-flex'
      }}>
        <div style={{
          justifyContent: 'center',
          display: 'flex',
          flexDirection: 'column',
          color: 'var(--Text-Primary, #FCFFFF)',
          fontSize: '14px',
          fontFamily: 'Brockmann',
          fontWeight: '500',
          lineHeight: '20px',
          wordWrap: 'break-word'
        }}>
          {category}
        </div>
      </div>
      <div style={{
        paddingLeft: '4px',
        paddingRight: '4px',
        paddingTop: '2px',
        paddingBottom: '2px',
        background: badgeInfo.backgroundColor,
        borderRadius: '4px',
        outline: `1px ${badgeInfo.borderColor} solid`,
        outlineOffset: '-1px',
        justifyContent: 'flex-start',
        alignItems: 'center',
        display: 'flex'
      }}>
        <div style={{
          textAlign: 'center',
          justifyContent: 'center',
          display: 'flex',
          flexDirection: 'column',
          color: badgeInfo.textColor,
          fontSize: '12px',
          fontFamily: 'Brockmann',
          fontWeight: '400',
          lineHeight: '16px',
          wordWrap: 'break-word'
        }}>
          {movieCount.toString().padStart(2, '0')}
        </div>
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
  const { getDisplayName, loading: profileLoading } = useProfile();

  const [specDraft, setSpecDraft] = useState<SpecDraft | null>(null);
  const [, setCustomCategories] = useState<SpecDraftCategory[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [draftMode, setDraftMode] = useState<'local' | 'multiplayer'>('local');
  const [participants, setParticipants] = useState<string[]>([]);
  const [newParticipant, setNewParticipant] = useState('');
  const [hoveredMode, setHoveredMode] = useState<'local' | 'multiplayer' | null>(null);
  const [isAddButtonHovered, setIsAddButtonHovered] = useState(false);
  const [hoveredRemoveButton, setHoveredRemoveButton] = useState<string | null>(null);
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
    // Prevent selecting ineligible categories
    if (checked) {
      const movieCount = categoryCounts[category] || 0;
      const playerCount = Math.max(participants.length, draftMode === 'multiplayer' ? 2 : 2);
      
      // If category is ineligible (movieCount < playerCount), don't allow selection
      if (movieCount < playerCount) {
        console.log(`❌ Blocked selection of "${category}" - insufficient movies (${movieCount} < ${playerCount})`);
        return;
      }
    }
    
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

    // For local drafts, require at least 2 participants
    if (draftMode === 'local') {
      if (participants.length < 2) {
        toast({
          title: 'Not Enough Participants',
          description: 'Please add at least 2 participants to create a local draft.',
          variant: 'destructive',
        });
        return;
      }
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
      <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
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
    <div className="min-h-screen" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
      <style>{`
        input::placeholder {
          color: var(--Text-Light-grey, #BDC3C2) !important;
        }
      `}</style>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Draft Title - No background container */}
          <div className="w-full flex flex-col gap-4 items-center justify-center py-6">
            <div className="uppercase" style={{ fontFamily: 'Brockmann', fontWeight: 500, fontSize: '32px', lineHeight: '36px', letterSpacing: '1.28px', color: 'var(--Text-Primary, #FCFFFF)' }}>
              SETTING UP
            </div>
            <div className="text-brand-primary uppercase" style={{ fontFamily: 'CHANEY', fontWeight: 400, fontSize: '64px', lineHeight: '64px' }}>
              {specDraft.name.toUpperCase()}
            </div>
          </div>

          {/* Select Draft Mode */}
          <div style={{
            width: '100%',
            padding: '24px',
            background: 'var(--Section-Container, #0E0E0F)',
            boxShadow: '0px 0px 6px #3B0394',
            borderRadius: '8px',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: '24px',
            display: 'flex'
          }}>
            <div style={{
              alignSelf: 'stretch',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              display: 'flex'
            }}>
              <div style={{
                justifyContent: 'center',
                display: 'flex',
                flexDirection: 'column',
                color: 'var(--Text-Primary, #FCFFFF)',
                fontSize: '24px',
                fontFamily: 'Brockmann',
                fontWeight: '700',
                lineHeight: '32px',
                letterSpacing: '0.96px',
                wordWrap: 'break-word'
              }}>
                Select A Mode
              </div>
            </div>
            <div style={{
              alignSelf: 'stretch',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              gap: '16px',
              display: 'inline-flex',
              flexWrap: 'wrap',
              alignContent: 'flex-start'
            }}>
              <button
                onClick={() => setDraftMode('local')}
                onMouseEnter={() => draftMode !== 'local' && setHoveredMode('local')}
                onMouseLeave={() => setHoveredMode(null)}
                style={{
                  flex: '1 1 0',
                  height: '80px',
                  minWidth: '294px',
                  paddingLeft: '36px',
                  paddingRight: '36px',
                  paddingTop: '9px',
                  paddingBottom: '9px',
                  background: draftMode === 'local' 
                    ? 'var(--Brand-Primary, #7142FF)' 
                    : hoveredMode === 'local' 
                      ? 'var(--UI-Primary-Hover, #2C2B2D)' 
                      : 'var(--UI-Primary, #1D1D1F)',
                  borderRadius: '6px',
                  outline: draftMode === 'local' ? 'none' : '1px var(--Item-Stroke, #49474B) solid',
                  outlineOffset: '-1px',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '16px',
                  display: 'flex',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
              >
                <User className="w-6 h-6" style={{ color: 'var(--Text-Primary, #FCFFFF)' }} />
                <div style={{
                  textAlign: 'center',
                  justifyContent: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  color: 'var(--Text-Primary, #FCFFFF)',
                  fontSize: '18px',
                  fontFamily: 'Brockmann',
                  fontWeight: '500',
                  lineHeight: '26px',
                  wordWrap: 'break-word'
                }}>
                  Local Draft
                </div>
              </button>
              <button
                onClick={() => setDraftMode('multiplayer')}
                onMouseEnter={() => draftMode !== 'multiplayer' && setHoveredMode('multiplayer')}
                onMouseLeave={() => setHoveredMode(null)}
                style={{
                  flex: '1 1 0',
                  height: '80px',
                  minWidth: '294px',
                  paddingLeft: '46px',
                  paddingRight: '46px',
                  paddingTop: '8px',
                  paddingBottom: '8px',
                  background: draftMode === 'multiplayer' 
                    ? 'var(--Brand-Primary, #7142FF)' 
                    : hoveredMode === 'multiplayer' 
                      ? 'var(--UI-Primary-Hover, #2C2B2D)' 
                      : 'var(--UI-Primary, #1D1D1F)',
                  borderRadius: '6px',
                  outline: draftMode === 'multiplayer' ? 'none' : '1px var(--Item-Stroke, #49474B) solid',
                  outlineOffset: '-1px',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '16px',
                  display: 'flex',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
              >
                <Users className="w-6 h-6" style={{ color: 'var(--Text-Primary, #FCFFFF)' }} />
                <div style={{
                  textAlign: 'center',
                  justifyContent: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  color: 'var(--Text-Primary, #FCFFFF)',
                  fontSize: '18px',
                  fontFamily: 'Brockmann',
                  fontWeight: '500',
                  lineHeight: '26px',
                  wordWrap: 'break-word'
                }}>
                  Online Multiplayer
                </div>
              </button>
            </div>
          </div>

          {/* Add Players */}
          <div style={{
            width: '100%',
            background: 'var(--Section-Container, #0E0E0F)',
            boxShadow: '0px 0px 6px #3B0394',
            borderRadius: '8px',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            display: 'inline-flex'
          }}>
            <div style={{
              width: '896px',
              padding: '24px',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              gap: '24px',
              display: 'flex'
            }}>
              <div style={{
                alignSelf: 'stretch',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                gap: '16px',
                display: 'flex'
              }}>
                <div style={{
                  alignSelf: 'stretch',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: '8px',
                  display: 'inline-flex'
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    padding: '2px',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '10px',
                    display: 'inline-flex',
                    color: 'var(--Text-Purple, #907AFF)'
                  }}>
                    <MultiPersonIcon />
                  </div>
                  <div style={{
                    flex: '1 1 0',
                    justifyContent: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '20px',
                    fontFamily: 'Brockmann',
                    fontWeight: '500',
                    lineHeight: '28px',
                    wordWrap: 'break-word'
                  }}>
                    Add Players
                  </div>
                </div>
                <div style={{
                  alignSelf: 'stretch',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  gap: '8px',
                  display: 'inline-flex'
                }}>
                  <div style={{
                    flex: '1 1 0',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    display: 'inline-flex'
                  }}>
                    <div style={{
                      alignSelf: 'stretch',
                      paddingLeft: '16px',
                      paddingRight: '16px',
                      paddingTop: '12px',
                      paddingBottom: '12px',
                      background: 'var(--UI-Primary, #1D1D1F)',
                      overflow: 'hidden',
                      borderRadius: '2px',
                      outline: '1px var(--Text-Light-grey, #BDC3C2) solid',
                      outlineOffset: '-1px',
                      justifyContent: 'flex-start',
                      alignItems: 'center',
                      gap: '12px',
                      display: 'inline-flex'
                    }}>
                      <div style={{
                        flex: '1 1 0',
                        overflow: 'hidden',
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        alignItems: 'flex-start',
                        display: 'inline-flex'
                      }}>
                        <input
                          type="text"
                          placeholder={draftMode === 'multiplayer' ? 'Enter email address to invite' : 'Enter player name'}
                          value={newParticipant}
                          onChange={(e) => setNewParticipant(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddParticipant();
                            }
                          }}
                          style={{
                            width: '100%',
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            color: 'var(--Text-Primary, #FCFFFF)',
                            fontSize: '14px',
                            fontFamily: 'Brockmann',
                            fontWeight: '500',
                            lineHeight: '20px'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleAddParticipant}
                    onMouseEnter={() => setIsAddButtonHovered(true)}
                    onMouseLeave={() => setIsAddButtonHovered(false)}
                    style={{
                      alignSelf: 'stretch',
                      paddingLeft: '16px',
                      paddingRight: '16px',
                      paddingTop: '8px',
                      paddingBottom: '8px',
                      background: isAddButtonHovered ? 'var(--Purple-300, #907AFF)' : 'var(--Brand-Primary, #7142FF)',
                      borderRadius: '2px',
                      justifyContent: 'center',
                      alignItems: 'center',
                      display: 'flex',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background 0.2s ease'
                    }}
                  >
                    <div style={{
                      textAlign: 'center',
                      justifyContent: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      color: 'var(--Text-Primary, #FCFFFF)',
                      fontSize: '14px',
                      fontFamily: 'Brockmann',
                      fontWeight: '500',
                      lineHeight: '20px',
                      wordWrap: 'break-word'
                    }}>
                      Add
                    </div>
                  </button>
                </div>
              </div>

              {draftMode === 'multiplayer' && (
                <div style={{
                  alignSelf: 'stretch',
                  padding: '16px',
                  background: 'var(--Teal-900, #00291E)',
                  borderRadius: '4px',
                  outline: '1px var(--Teal-200, #B2FFEA) solid',
                  outlineOffset: '-1px',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: '8px',
                  display: 'inline-flex'
                }}>
                  <div style={{
                    width: '24px',
                    paddingLeft: '2px',
                    paddingRight: '2px',
                    paddingTop: '4px',
                    paddingBottom: '4px',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '10px',
                    display: 'inline-flex',
                    color: 'var(--Teal-200, #B2FFEA)'
                  }}>
                    <Mail size={16} />
                  </div>
                  <div style={{
                    flex: '1 1 0',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    display: 'flex'
                  }}>
                    <div style={{
                      flex: '1 1 0',
                      justifyContent: 'center',
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <span style={{
                        color: 'var(--Teal-200, #B2FFEA)',
                        fontSize: '14px',
                        fontFamily: 'Brockmann',
                        fontWeight: '700',
                        lineHeight: '20px',
                        wordWrap: 'break-word'
                      }}>Multiplayer Mode: </span>
                      <span style={{
                        color: 'var(--Teal-200, #B2FFEA)',
                        fontSize: '14px',
                        fontFamily: 'Brockmann',
                        fontWeight: '500',
                        lineHeight: '20px',
                        wordWrap: 'break-word'
                      }}> Enter email addresses of friends you want to invite. They'll receive an email invitation to join.</span>
                    </div>
                  </div>
                </div>
              )}

              {(participants.length > 0 || (draftMode === 'multiplayer' && hostName)) && (
                <div style={{
                  alignSelf: 'stretch',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  gap: '12px',
                  display: 'flex'
                }}>
                  <div style={{
                    alignSelf: 'stretch',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    display: 'flex'
                  }}>
                    <div style={{
                      alignSelf: 'stretch',
                      justifyContent: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      color: 'var(--Text-Primary, #FCFFFF)',
                      fontSize: '16px',
                      fontFamily: 'Brockmann',
                      fontWeight: '400',
                      lineHeight: '24px',
                      wordWrap: 'break-word'
                    }}>
                      Participants ({(() => {
                        if (draftMode === 'multiplayer') {
                          const displayedParticipants = participants.filter(p => p !== hostName);
                          return hostName ? displayedParticipants.length + 1 : displayedParticipants.length;
                        }
                        return participants.length;
                      })()}):
                    </div>
                  </div>
                  <div style={{
                    alignSelf: 'stretch',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    gap: '8px',
                    display: 'inline-flex',
                    flexWrap: 'wrap',
                    alignContent: 'flex-start'
                  }}>
                    {draftMode === 'multiplayer' && hostName && (
                      <div
                        style={{
                          paddingTop: '8px',
                          paddingBottom: '8px',
                          paddingLeft: '16px',
                          paddingRight: '16px',
                          background: 'var(--Brand-Primary, #7142FF)',
                          borderRadius: '4px',
                          justifyContent: 'flex-start',
                          alignItems: 'center',
                          gap: '8px',
                          display: 'flex',
                          height: '36px'
                        }}
                        title="Host (cannot be removed)"
                      >
                        <div style={{
                          justifyContent: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          color: 'var(--Text-Primary, #FCFFFF)',
                          fontSize: '14px',
                          fontFamily: 'Brockmann',
                          fontWeight: '500',
                          lineHeight: '20px',
                          wordWrap: 'break-word'
                        }}>
                          {hostName} (Host)
                        </div>
                      </div>
                    )}
                    {participants.filter(p => draftMode !== 'multiplayer' || p !== hostName).map((participant) => (
                      <div
                        key={participant}
                        style={{
                          paddingTop: '8px',
                          paddingBottom: '8px',
                          paddingLeft: '16px',
                          paddingRight: '10px',
                          background: 'var(--Brand-Primary, #7142FF)',
                          borderRadius: '4px',
                          justifyContent: 'flex-start',
                          alignItems: 'center',
                          gap: '8px',
                          display: 'flex',
                          height: '36px'
                        }}
                      >
                        <div style={{
                          justifyContent: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          color: 'var(--Text-Primary, #FCFFFF)',
                          fontSize: '14px',
                          fontFamily: 'Brockmann',
                          fontWeight: '500',
                          lineHeight: '20px',
                          wordWrap: 'break-word'
                        }}>
                          {participant}
                        </div>
                        <button
                          onClick={() => handleRemoveParticipant(participant)}
                          onMouseEnter={() => setHoveredRemoveButton(participant)}
                          onMouseLeave={() => setHoveredRemoveButton(null)}
                          style={{
                            padding: '4px',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            justifyContent: 'center',
                            alignItems: 'center',
                            display: 'flex',
                            border: 'none',
                            background: hoveredRemoveButton === participant ? 'var(--Purple-300, #907AFF)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'background 0.2s ease'
                          }}
                        >
                          <Trash2 size={16} style={{ color: 'var(--Text-Primary, #FCFFFF)' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Select Categories */}
          <div style={{
            width: '100%',
            padding: '24px',
            background: 'var(--Section-Container, #0E0E0F)',
            boxShadow: '0px 0px 6px #3B0394',
            borderRadius: '8px',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: '24px',
            display: 'inline-flex'
          }}>
            <div style={{
              width: '848px',
              justifyContent: 'flex-start',
              alignItems: 'center',
              gap: '8px',
              display: 'inline-flex'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                padding: '2px',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '10px',
                display: 'inline-flex',
                color: 'var(--Text-Purple, #907AFF)'
              }}>
                <CheckboxIcon className="w-6 h-6" />
              </div>
              <div style={{
                flex: '1 1 0',
                justifyContent: 'center',
                display: 'flex',
                flexDirection: 'column',
                color: 'var(--Text-Primary, #FCFFFF)',
                fontSize: '20px',
                fontFamily: 'Brockmann',
                fontWeight: '500',
                lineHeight: '28px',
                wordWrap: 'break-word'
              }}>
                Choose Categories
              </div>
            </div>

            <div style={{
              width: '848px',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '16px',
              alignContent: 'flex-start'
            }}>
              {allCategories.map((category) => {
                const isChecked = selectedCategories[category] || false;
                const movieCount = categoryCounts[category] || 0;
                const playerCount = Math.max(participants.length, draftMode === 'multiplayer' ? 2 : 2);
                return (
                  <CategoryCheckbox
                    key={category}
                    category={category}
                    isChecked={isChecked}
                    onToggle={(checked) => handleCategoryToggle(category, checked)}
                    movieCount={movieCount}
                    playerCount={playerCount}
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

