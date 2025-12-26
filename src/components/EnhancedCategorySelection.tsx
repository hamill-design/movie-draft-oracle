import { useMemo, useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { getEligibleCategories } from '@/utils/movieCategoryUtils';
import { CheckboxIcon } from '@/components/icons/CheckboxIcon';
import { NAIcon } from '@/components/icons/NAIcon';
import { getCategoryConfig } from '@/config/categoryConfigs';
import { useActorSpecCategories } from '@/hooks/useActorSpecCategories';
import { getCleanActorName } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface Pick {
  playerId: number;
  playerName: string;
  movie: any;
  category: string;
}

interface EnhancedCategorySelectionProps {
  selectedMovie: any;
  categories: string[];
  selectedCategory: string;
  onCategorySelect: (category: string) => void;
  picks: Pick[];
  currentPlayerId: number;
  theme?: string;
  option?: string;
}

const CategoryButton = ({ 
  category, 
  isSelected, 
  isDisabled, 
  isEligible, 
  onClick, 
  tooltip 
}: {
  category: string;
  isSelected: boolean;
  isDisabled: boolean;
  isEligible: boolean;
  onClick: () => void;
  tooltip: string;
}) => {
  const config = getCategoryConfig(category);
  
  const getCategoryDisplayName = (category: string) => {
    if (category === 'Academy Award Nominee or Winner') return 'Academy Award';
    if (category === 'Blockbuster (minimum of $50 Mil)') return 'Blockbuster';
    return category;
  };

  const getButtonStyle = () => {
    if (isSelected) {
      return {
        width: '100%',
        paddingLeft: '24px',
        paddingRight: '24px',
        paddingTop: '12px',
        paddingBottom: '12px',
        background: '#7142FF',
        borderRadius: '4px',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        display: 'flex',
        border: 'none',
        cursor: 'pointer'
      };
    }
    
    if (isDisabled) {
      return {
        width: '100%',
        paddingLeft: '24px',
        paddingRight: '24px',
        paddingTop: '12px',
        paddingBottom: '12px',
        opacity: 0.50,
        background: '#D9E0DF',
        borderRadius: '6px',
        outline: '1px #BDC3C2 solid',
        outlineOffset: '-1px',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px',
        display: 'flex',
        border: 'none',
        cursor: 'not-allowed'
      };
    }
    
    return {
      width: '100%',
      paddingLeft: '24px',
      paddingRight: '24px',
      paddingTop: '12px',
      paddingBottom: '12px',
      background: '#1D1D1F',
      borderRadius: '4px',
      outline: '1px #49474B solid',
      outlineOffset: '-1px',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      display: 'flex',
      border: 'none',
      cursor: 'pointer'
    };
  };

  const getTextStyle = () => {
    if (isSelected) {
      return {
        flex: '1 1 0',
        textAlign: 'center' as const,
        justifyContent: 'center',
        display: 'flex',
        flexDirection: 'column' as const,
        color: '#FCFFFF',
        fontSize: '14px',
        fontFamily: 'Brockmann',
        fontWeight: 500,
        lineHeight: '20px'
      };
    }
    
    if (isDisabled) {
      return {
        textAlign: 'center' as const,
        justifyContent: 'center',
        display: 'flex',
        flexDirection: 'column' as const,
        color: '#2B2D2D',
        fontSize: '14px',
        fontFamily: 'Brockmann',
        fontWeight: 500,
        lineHeight: '20px'
      };
    }
    
    return {
      flex: '1 1 0',
      textAlign: 'center' as const,
      justifyContent: 'center',
      display: 'flex',
      flexDirection: 'column' as const,
      color: '#FCFFFF',
      fontSize: '14px',
      fontFamily: 'Brockmann',
      fontWeight: 500,
      lineHeight: '20px'
    };
  };

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      style={getButtonStyle()}
      title={tooltip}
      onMouseEnter={(e) => {
        if (!isDisabled && !isSelected) {
          e.currentTarget.style.background = '#2C2B2D';
        }
      }}
      onMouseLeave={(e) => {
        if (!isDisabled && !isSelected) {
          e.currentTarget.style.background = '#1D1D1F';
        }
      }}
    >
      {isDisabled ? (
        <>
          <div style={getTextStyle()}>
            {getCategoryDisplayName(category)}
          </div>
          <div 
            style={{ 
              width: '16px', 
              height: '16px', 
              color: '#2B2D2D',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <NAIcon className="w-full h-full" />
          </div>
        </>
      ) : (
        <div style={getTextStyle()}>
          {getCategoryDisplayName(category)}
        </div>
      )}
    </button>
  );
};

const EnhancedCategorySelection = ({
  selectedMovie,
  categories,
  selectedCategory,
  onCategorySelect,
  picks,
  currentPlayerId,
  theme,
  option
}: EnhancedCategorySelectionProps) => {
  if (!selectedMovie) return null;

  const [houseOverrideEnabled, setHouseOverrideEnabled] = useState(false);
  const [specDraftMovieCategories, setSpecDraftMovieCategories] = useState<string[]>([]);
  const [loadingSpecCategories, setLoadingSpecCategories] = useState(false);

  // Get actor name for spec categories lookup
  const actorName = theme === 'people' && option ? getCleanActorName(option) : null;
  const { specCategories } = useActorSpecCategories(actorName);

  // Reset house override when movie changes
  useEffect(() => {
    setHouseOverrideEnabled(false);
  }, [selectedMovie?.id]);

  // Fetch spec draft movie categories when theme is spec-draft
  useEffect(() => {
    const fetchSpecDraftMovieCategories = async () => {
      if (theme === 'spec-draft' && option && selectedMovie?.id) {
        setLoadingSpecCategories(true);
        try {
          // First, find the spec_draft_movie record using the movie's TMDB ID
          const { data: movieRecord, error: movieError } = await (supabase as any)
            .from('spec_draft_movies')
            .select('id')
            .eq('spec_draft_id', option)
            .eq('movie_tmdb_id', selectedMovie.id)
            .single();

          if (movieError || !movieRecord) {
            console.error('Error finding spec draft movie:', movieError);
            setSpecDraftMovieCategories([]);
            return;
          }

          // Fetch categories for this movie
          const { data: categoriesData, error: categoriesError } = await (supabase as any)
            .from('spec_draft_movie_categories')
            .select('category_name')
            .eq('spec_draft_movie_id', movieRecord.id);

          if (categoriesError) {
            console.error('Error fetching spec draft movie categories:', categoriesError);
            setSpecDraftMovieCategories([]);
          } else {
            const categoryNames = (categoriesData || []).map((cat: any) => cat.category_name);
            setSpecDraftMovieCategories(categoryNames);
            console.log('Fetched spec draft movie categories:', categoryNames);
          }
        } catch (err) {
          console.error('Error in fetchSpecDraftMovieCategories:', err);
          setSpecDraftMovieCategories([]);
        } finally {
          setLoadingSpecCategories(false);
        }
      } else {
        setSpecDraftMovieCategories([]);
      }
    };

    fetchSpecDraftMovieCategories();
  }, [theme, option, selectedMovie?.id]);

  // Get eligible categories for the selected movie
  // For spec-draft, use the categories from the database
  // For other themes, use the standard eligibility logic
  const eligibleCategories = useMemo(() => {
    if (theme === 'spec-draft' && specDraftMovieCategories.length > 0) {
      // Filter to only include categories that are in the draft's category list
      return specDraftMovieCategories.filter(cat => categories.includes(cat));
    }
    return getEligibleCategories(selectedMovie, categories, theme, option, specCategories);
  }, [selectedMovie, categories, theme, option, specCategories, specDraftMovieCategories]);

  const getCategoryTooltip = (category: string) => {
    const config = getCategoryConfig(category);
    let tooltip = `${category}\n${config?.description || ''}`;
    
    // Check both hasOscar flag and oscar_status for Academy Award
    if (category === 'Academy Award Nominee or Winner') {
      const hasOscar = selectedMovie.hasOscar === true || 
                       selectedMovie.oscar_status === 'winner' || 
                       selectedMovie.oscar_status === 'nominee';
      if (hasOscar) {
        tooltip += '\nThis movie has Academy Award nominations or wins';
      }
    }
    if (category === 'Blockbuster (minimum of $50 Mil)' && selectedMovie.isBlockbuster) {
      const budget = selectedMovie.budget ? `$${(selectedMovie.budget / 1000000).toFixed(0)}M budget` : '';
      const revenue = selectedMovie.revenue ? `$${(selectedMovie.revenue / 1000000).toFixed(0)}M revenue` : '';
      tooltip += `\nThis movie is eligible: ${budget}${budget && revenue ? ', ' : ''}${revenue}`;
    }
    
    return tooltip;
  };

  const getEligibilityStatus = (category: string) => {
    const isAlreadyPicked = picks.some(p => p.playerId === currentPlayerId && p.category === category);
    const isEligible = eligibleCategories.includes(category);
    
    if (isAlreadyPicked) return { status: 'picked', icon: '', color: '#828786' };
    if (!isEligible) return { status: 'ineligible', icon: '', color: '#FF4444' };
    return { status: 'eligible', icon: '', color: '#06C995' };
  };

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const aEligible = eligibleCategories.includes(a);
      const bEligible = eligibleCategories.includes(b);
      const aPicked = picks.some(p => p.playerId === currentPlayerId && p.category === a);
      const bPicked = picks.some(p => p.playerId === currentPlayerId && p.category === b);
      
      // Sort order: eligible first, then ineligible, then picked
      if (aEligible && !aPicked && (!bEligible || bPicked)) return -1;
      if (bEligible && !bPicked && (!aEligible || aPicked)) return 1;
      
      return 0;
    });
  }, [categories, eligibleCategories, picks, currentPlayerId]);

  const getCategoryDisplayName = (category: string) => {
    if (category === 'Academy Award Nominee or Winner') return 'Academy Award';
    if (category === 'Blockbuster (minimum of $50 Mil)') return 'Blockbuster';
    return category;
  };

  const getBlockbusterText = () => {
    if (!selectedMovie.isBlockbuster) return '';
    const budget = selectedMovie.budget ? `$${(selectedMovie.budget / 1000000).toFixed(0)}M` : '';
    const revenue = selectedMovie.revenue ? `$${(selectedMovie.revenue / 1000000).toFixed(0)}M` : '';
    const parts = [budget, revenue].filter(Boolean);
    return parts.length > 0 ? ` (${parts.join(') (')})` : '';
  };

  return (
    <div 
      style={{
        width: '100%',
        height: '100%',
        padding: '24px',
        background: '#0E0E0F',
        boxShadow: '0px 0px 6px #3B0394',
        borderRadius: '8px',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        gap: '24px',
        display: 'inline-flex'
      }}
    >
      {/* Header Section */}
      <div 
        style={{
          alignSelf: 'stretch',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          gap: '6px',
          display: 'flex'
        }}
      >
        <div 
          className="w-full flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-2"
        >
          <div className="flex items-center gap-2 flex-shrink-0">
            <div 
              style={{
                width: '24px',
                height: '24px',
                padding: '2px',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '10px',
                display: 'inline-flex'
              }}
            >
              <div style={{ width: '20px', height: '20px', color: '#907AFF' }}>
                <CheckboxIcon className="w-full h-full" />
              </div>
            </div>
            <div 
              style={{
                flex: '1 1 0',
                justifyContent: 'center',
                display: 'flex',
                flexDirection: 'column',
                color: '#FCFFFF',
                fontSize: '20px',
                fontFamily: 'Brockmann',
                fontWeight: 500,
                lineHeight: '28px'
              }}
            >
              Select Category for {selectedMovie.title}
            </div>
          </div>
          
          {/* House Override Toggle */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            <span 
              style={{
                color: '#BDC3C2',
                fontSize: '14px',
                fontFamily: 'Brockmann',
                fontWeight: 400
              }}
            >
              House Override
            </span>
            <Switch
              checked={houseOverrideEnabled}
              onCheckedChange={setHouseOverrideEnabled}
              className="data-[state=unchecked]:bg-[#828786]"
            />
          </div>
        </div>
        
        <div 
          style={{
            alignSelf: 'stretch',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            display: 'flex'
          }}
        >
          <div 
            style={{
              alignSelf: 'stretch',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              gap: '4px',
              display: 'flex'
            }}
          >
            <div 
              style={{
                alignSelf: 'stretch',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                display: 'flex'
              }}
            >
              <div 
                style={{
                  alignSelf: 'stretch',
                  justifyContent: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  color: '#828786',
                  fontSize: '12px',
                  fontFamily: 'Brockmann',
                  fontStyle: 'italic',
                  fontWeight: 400,
                  lineHeight: '16px'
                }}
              >
                Based on this movie's properties, you can select from {eligibleCategories.length} eligible categories.
              </div>
            </div>
            {(() => {
              // Check both hasOscar flag and oscar_status for Academy Award
              const hasOscar = selectedMovie?.hasOscar === true || 
                               selectedMovie?.oscar_status === 'winner' || 
                               selectedMovie?.oscar_status === 'nominee';
              if (!hasOscar) return null;
              
              return (
                <div 
                  style={{
                    alignSelf: 'stretch',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    display: 'flex'
                  }}
                >
                  <div 
                    style={{
                      alignSelf: 'stretch',
                      justifyContent: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      color: '#FFE97A',
                      fontSize: '14px',
                      fontFamily: 'Brockmann',
                      fontWeight: 400,
                      lineHeight: '20px'
                    }}
                  >
                    Eligible for Academy Award category (Has Oscar nominations/wins)
                  </div>
                </div>
              );
            })()}
            {selectedMovie.isBlockbuster && (
              <div 
                style={{
                  alignSelf: 'stretch',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  display: 'flex'
                }}
              >
                <div 
                  style={{
                    alignSelf: 'stretch',
                    justifyContent: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    color: '#06C995',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: 400,
                    lineHeight: '20px'
                  }}
                >
                  Eligible for Blockbuster category{getBlockbusterText()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category Buttons Grid */}
      <div 
        style={{
          alignSelf: 'stretch',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(294px, 1fr))',
          gap: '12px'
        }}
      >
        {sortedCategories.map((category) => {
          const isAlreadyPicked = picks.some(p => p.playerId === currentPlayerId && p.category === category);
          const isEligible = eligibleCategories.includes(category);
          const isDisabled = isAlreadyPicked || (!isEligible && !houseOverrideEnabled);
          const isSelected = selectedCategory === category;
          
          return (
            <CategoryButton
              key={category}
              category={category}
              isSelected={isSelected}
              isDisabled={isDisabled}
              isEligible={isEligible}
              onClick={() => onCategorySelect(category)}
              tooltip={getCategoryTooltip(category)}
            />
          );
        })}
      </div>

      {/* Enhanced feedback messages */}
      {eligibleCategories.length === 0 && (
        <div style={{
          width: '100%',
          padding: '16px',
          background: 'var(--Utility-Colors-Error-Red-900, #3D0000)',
          borderRadius: '4px',
          outline: '1px var(--Utility-Colors-Error-Red-200, #FFC0C0) solid',
          outlineOffset: '-1px',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
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
              flexDirection: 'column'
            }}>
              <span style={{
                color: 'var(--Utility-Colors-Error-Red-200, #FFC0C0)',
                fontSize: '14px',
                fontFamily: 'Brockmann',
                fontWeight: '700',
                lineHeight: '20px',
                wordWrap: 'break-word'
              }}>
                No eligible categories found
              </span>
              <span style={{
                color: 'var(--Utility-Colors-Error-Red-200, #FFC0C0)',
                fontSize: '14px',
                fontFamily: 'Brockmann',
                fontWeight: '500',
                lineHeight: '20px',
                wordWrap: 'break-word'
              }}>
                {' '}This movie doesn't match any of the available categories. Please select a different movie that better fits your draft's theme and categories.
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default EnhancedCategorySelection;