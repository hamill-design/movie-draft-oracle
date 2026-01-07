import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Film, ChevronDown, ChevronUp } from 'lucide-react';

interface SpecDraft {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  display_order: number | null;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

export const SpecDraftSelector = () => {
  const navigate = useNavigate();
  const [specDrafts, setSpecDrafts] = useState<SpecDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchSpecDrafts = async () => {
      try {
        // Try to fetch with all columns first
        const queryResult = await supabase
          .from('spec_drafts' as any)
          .select('id, name, description, photo_url, display_order, is_hidden, created_at, updated_at')
          .eq('is_hidden', false)
          .order('display_order', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false });
        
        const result = queryResult as { data: SpecDraft[] | null; error: any };
        const { data, error } = result;

        if (error) {
          // If some columns don't exist, try without them
          const isColumnError = 
            error.message?.includes('photo_url') || 
            error.message?.includes('display_order') ||
            error.message?.includes('is_hidden') ||
            error.message?.includes('column') ||
            error.message?.includes('does not exist') ||
            error.code === 'PGRST116' ||
            (typeof error === 'object' && 'status' in error && error.status === 400);

          if (isColumnError) {
            const fallbackQueryResult = await supabase
              .from('spec_drafts' as any)
              .select('id, name, description, created_at, updated_at')
              .order('created_at', { ascending: false });
            
            const fallbackResult = fallbackQueryResult as { data: Omit<SpecDraft, 'photo_url' | 'display_order' | 'is_hidden'>[] | null; error: any };
            const { data: fallbackData, error: fallbackError } = fallbackResult;
            
            if (fallbackError) throw fallbackError;
            // Filter out any drafts that might be hidden (if is_hidden column doesn't exist, show all)
            setSpecDrafts((fallbackData || []).map(draft => ({ 
              ...draft, 
              photo_url: null,
              display_order: null,
              is_hidden: false
            } as SpecDraft)));
          } else {
            throw error;
          }
        } else {
          // Filter out hidden drafts (in case the filter didn't work)
          setSpecDrafts((data || []).filter(draft => !(draft.is_hidden ?? false)));
        }
      } catch (err) {
        console.error('Error fetching spec drafts:', err);
        setSpecDrafts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSpecDrafts();
  }, []);

  const handleBeginSetup = (specDraftId: string) => {
    // Navigate to a new page for setting up the spec draft
    navigate(`/spec-draft/${specDraftId}/setup`);
  };

  const getPosterUrl = (posterPath: string | null) => {
    if (!posterPath) return null;
    if (posterPath.startsWith('http')) return posterPath;
    return `https://image.tmdb.org/t/p/w500${posterPath}`;
  };

  if (loading) {
    return (
      <div className="w-full p-6 bg-greyscale-purp-900 rounded-[8px] flex flex-col gap-6" style={{boxShadow: '0px 0px 6px #3B0394'}}>
        <div className="text-center" style={{ color: 'var(--Text-Primary, #FCFFFF)', fontFamily: 'Brockmann', fontWeight: 400, fontSize: '14px' }}>
          Loading special drafts...
        </div>
      </div>
    );
  }

  if (specDrafts.length === 0) {
    return null; // Don't show the section if there are no spec drafts
  }

  // Determine how many items to show initially (2 per row = 2 items)
  const INITIAL_ITEMS_TO_SHOW = 2;
  const displayedDrafts = isExpanded 
    ? specDrafts 
    : specDrafts.slice(0, INITIAL_ITEMS_TO_SHOW);
  const hasMoreItems = specDrafts.length > INITIAL_ITEMS_TO_SHOW;

  return (
    <div className="w-full p-6 bg-greyscale-purp-900 rounded-[8px] flex flex-col gap-6" style={{boxShadow: '0px 0px 6px #3B0394'}}>
      {/* Header */}
      <div className="flex flex-col gap-2 items-center justify-center">
        <h2
          className="text-2xl text-greyscale-blue-100"
          style={{ 
            fontFamily: 'Brockmann', 
            fontWeight: 700, 
            fontSize: '24px', 
            lineHeight: '32px',
            letterSpacing: '0.96px'
          }}
        >
          Start a Special Draft!
        </h2>
      </div>

      {/* Spec Drafts Grid */}
      <div className="flex flex-wrap gap-4 items-start">
        {displayedDrafts.map((draft) => {
          const posterUrl = getPosterUrl(draft.photo_url);
          
          return (
            <div
              key={draft.id}
              className="bg-greyscale-purp-850 rounded-[6px] p-[18px] flex flex-col md:flex-row gap-4 items-center min-h-[218px] w-full md:basis-[calc(50%-0.5rem)] md:max-w-[calc(50%-0.5rem)]"
              style={{outline: '1px solid #49474B', outlineOffset: '-1px'}}
            >
              {/* Poster/Image */}
              <div className="h-[182px] min-h-[182px] min-w-[182px] w-full md:w-[182px] md:flex-shrink-0 relative rounded-[3px]">
                {posterUrl ? (
                  <img
                    src={posterUrl}
                    alt={draft.name}
                    className="w-full h-full object-cover rounded-[3px]"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-greyscale-purp-800 rounded-[3px] flex items-center justify-center">
                    <Film className="w-12 h-12 text-greyscale-blue-400" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex flex-col gap-6 items-start flex-1 w-full min-w-0">
                {/* Title and Description */}
                <div className="flex flex-col gap-2 items-start w-full">
                  <h3
                    className="text-2xl text-greyscale-blue-100"
                    style={{ 
                      fontFamily: 'Brockmann', 
                      fontWeight: 600, 
                      fontSize: '24px', 
                      lineHeight: '30px',
                      letterSpacing: '0.48px'
                    }}
                  >
                    {draft.name}
                  </h3>
                  {draft.description && (
                    <p
                      className="text-sm text-greyscale-blue-100"
                      style={{ 
                        fontFamily: 'Brockmann', 
                        fontWeight: 400, 
                        fontSize: '14px', 
                        lineHeight: '20px' 
                      }}
                    >
                      {draft.description}
                    </p>
                  )}
                </div>

                {/* Begin Setup Button */}
                <Button
                  onClick={() => handleBeginSetup(draft.id)}
                  className="bg-brand-primary hover:bg-purple-300 text-greyscale-blue-100 h-9 px-4 py-2 rounded-[2px] w-full transition-colors"
                  style={{ 
                    fontFamily: 'Brockmann', 
                    fontWeight: 500, 
                    fontSize: '14px', 
                    lineHeight: '20px' 
                  }}
                >
                  Begin Setup
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* See More / See Less Button */}
      {hasMoreItems && (
        <div className="flex justify-center w-full">
          <Button
            onClick={() => setIsExpanded(!isExpanded)}
            variant="outline"
            className="bg-greyscale-purp-850 border-greyscale-purp-700 text-greyscale-blue-100 hover:bg-greyscale-purp-800 hover:text-greyscale-blue-50 h-10 px-6 rounded-[2px] transition-colors"
            style={{ 
              fontFamily: 'Brockmann', 
              fontWeight: 500, 
              fontSize: '14px', 
              lineHeight: '20px' 
            }}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-2" />
                See Less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-2" />
                See More
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};





