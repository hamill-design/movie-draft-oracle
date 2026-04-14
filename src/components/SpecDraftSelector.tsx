import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Film, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const CAROUSEL_INTERVAL_MS = 6000;
const POSTER_CROSSFADE_MS = 280;
/** Homepage carousel only surfaces the top five (by display order, then recency). */
const MAX_HOME_SPEC_DRAFTS = 5;

function takeTopSpecDrafts(drafts: SpecDraft[]): SpecDraft[] {
  return drafts.slice(0, MAX_HOME_SPEC_DRAFTS);
}

interface SpecDraft {
  id: string;
  name: string;
  slug?: string | null;
  description: string | null;
  photo_url: string | null;
  display_order: number | null;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

type SpecDraftSelectorProps = {
  className?: string;
};

export const SpecDraftSelector = ({ className }: SpecDraftSelectorProps) => {
  const navigate = useNavigate();
  const [specDrafts, setSpecDrafts] = useState<SpecDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [carouselIndex, setCarouselIndex] = useState(0);
  /** Bumps when user picks a slide so the auto-advance timer restarts */
  const [timerNonce, setTimerNonce] = useState(0);

  /** Dual poster buffers: load into inactive slot, decode, then crossfade (card never fades). */
  const [posterSlotUrl, setPosterSlotUrl] = useState<[string | null, string | null]>([null, null]);
  const [visiblePosterSlot, setVisiblePosterSlot] = useState<0 | 1>(0);
  const posterInitRef = useRef(false);
  /** Avoid duplicate work (e.g. Strict Mode) while still refreshing if the draft at this index changes. */
  const lastPosterKeyRef = useRef<string | null>(null);
  const visiblePosterSlotRef = useRef<0 | 1>(0);
  const img0Ref = useRef<HTMLImageElement | null>(null);
  const img1Ref = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const fetchSpecDrafts = async () => {
      try {
        const queryResult = await supabase
          .from('spec_drafts' as any)
          .select('id, name, slug, description, photo_url, display_order, is_hidden, created_at, updated_at')
          .eq('is_hidden', false)
          .order('display_order', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(MAX_HOME_SPEC_DRAFTS);

        const result = queryResult as { data: SpecDraft[] | null; error: any };
        const { data, error } = result;

        if (error) {
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

            const fallbackResult = fallbackQueryResult as {
              data: Omit<SpecDraft, 'photo_url' | 'display_order' | 'is_hidden'>[] | null;
              error: any;
            };
            const { data: fallbackData, error: fallbackError } = fallbackResult;

            if (fallbackError) throw fallbackError;
            setSpecDrafts(
              takeTopSpecDrafts(
                (fallbackData || []).map(
                  (draft) =>
                    ({
                      ...draft,
                      photo_url: null,
                      display_order: null,
                      is_hidden: false,
                    }) as SpecDraft
                )
              )
            );
          } else {
            throw error;
          }
        } else {
          setSpecDrafts(
            takeTopSpecDrafts((data || []).filter((draft) => !(draft.is_hidden ?? false)))
          );
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

  const n = specDrafts.length;

  useEffect(() => {
    setCarouselIndex((i) => (n === 0 ? 0 : Math.min(i, n - 1)));
  }, [n]);

  useEffect(() => {
    if (n <= 1) return;
    const id = window.setInterval(() => {
      setCarouselIndex((i) => (i + 1) % n);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [n, timerNonce]);

  const goToSlide = useCallback(
    (index: number) => {
      if (n === 0) return;
      setCarouselIndex(((index % n) + n) % n);
      setTimerNonce((x) => x + 1);
    },
    [n]
  );

  const handleBeginSetup = (draft: SpecDraft) => {
    const segment = (draft.slug && String(draft.slug).trim()) || draft.id;
    navigate(`/spec-draft/${segment}/setup`);
  };

  const getPosterUrl = (posterPath: string | null) => {
    if (!posterPath) return null;
    if (posterPath.startsWith('http')) return posterPath;
    return `https://image.tmdb.org/t/p/w500${posterPath}`;
  };

  /** Load next poster into the inactive buffer, decode, then swap visible slot. */
  useEffect(() => {
    if (specDrafts.length === 0) {
      posterInitRef.current = false;
      lastPosterKeyRef.current = null;
      return;
    }

    const draft = specDrafts[carouselIndex];
    const url = getPosterUrl(draft.photo_url);
    const posterKey = `${draft.id}:${carouselIndex}:${url ?? 'none'}`;
    let cancelled = false;

    const run = async () => {
      if (!posterInitRef.current) {
        posterInitRef.current = true;
        setPosterSlotUrl([url, null]);
        visiblePosterSlotRef.current = 0;
        setVisiblePosterSlot(0);
        lastPosterKeyRef.current = posterKey;
        return;
      }

      if (lastPosterKeyRef.current === posterKey) {
        return;
      }
      lastPosterKeyRef.current = posterKey;

      const inactive = (1 - visiblePosterSlotRef.current) as 0 | 1;

      if (!url) {
        setPosterSlotUrl((prev) => {
          const next: [string | null, string | null] = [...prev];
          next[inactive] = null;
          return next;
        });
        if (!cancelled) {
          visiblePosterSlotRef.current = inactive;
          setVisiblePosterSlot(inactive);
        }
        return;
      }

      setPosterSlotUrl((prev) => {
        const next: [string | null, string | null] = [...prev];
        next[inactive] = url;
        return next;
      });

      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));

      const img = inactive === 0 ? img0Ref.current : img1Ref.current;
      if (cancelled || !img) return;

      try {
        if (img.complete && img.naturalWidth > 0) {
          await img.decode();
        } else {
          await new Promise<void>((resolve) => {
            const finish = () => {
              img.decode().then(resolve).catch(resolve);
            };
            img.onload = finish;
            img.onerror = () => resolve();
          });
        }
      } catch {
        /* decode unsupported or failed — still swap */
      }

      if (!cancelled) {
        visiblePosterSlotRef.current = inactive;
        setVisiblePosterSlot(inactive);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [carouselIndex, specDrafts]);

  if (loading) {
    return (
      <div
        className={cn(
          'flex h-full min-h-0 w-full flex-col gap-6 p-6 bg-greyscale-purp-900 rounded-[8px]',
          className
        )}
        style={{ boxShadow: '0px 0px 6px #3B0394' }}
      >
        <div className="text-center font-brockmann text-sm text-greyscale-blue-100">
          Loading special drafts...
        </div>
      </div>
    );
  }

  if (specDrafts.length === 0) {
    return null;
  }

  const draft = specDrafts[carouselIndex];

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full flex-col gap-6 p-6 bg-greyscale-purp-900 rounded-[8px]',
        className
      )}
      style={{ boxShadow: '0px 0px 6px #3B0394' }}
    >
      <div className="flex flex-col items-center justify-center text-center">
        <h2 className="m-0 text-xl font-medium leading-7 font-brockmann text-greyscale-blue-100">
          Start a Special Draft!
        </h2>
      </div>

      {/* 16px between spec draft card and dots / See All row */}
      <div className="flex flex-col gap-4 w-full min-h-0 flex-1">
        <div
          className="flex flex-1 flex-col items-stretch min-h-0"
          role="region"
          aria-roledescription="carousel"
          aria-label="Featured special drafts"
        >
          <div className="flex min-h-0 flex-1 flex-col" aria-live="polite">
            <div
              className="bg-greyscale-purp-850 rounded-[6px] p-4 flex flex-col sm:flex-row gap-4 items-stretch w-full min-w-0 min-h-[192px] flex-1"
              style={{ outline: '1px solid #49474B', outlineOffset: '-1px' }}
            >
              {/* Poster: dual absolute layers — decode inactive layer, then crossfade opacity only on images */}
              <div className="relative flex w-full min-h-[160px] min-w-0 sm:h-full sm:min-h-0 sm:w-[168px] sm:flex-shrink-0 sm:self-stretch overflow-hidden rounded-[3px] bg-greyscale-purp-800">
                {[0, 1].map((slot) => (
                  <div
                    key={slot}
                    className={cn(
                      'absolute inset-0 motion-reduce:transition-none',
                      'transition-opacity ease-out',
                      visiblePosterSlot === slot ? 'opacity-100 z-[1]' : 'opacity-0 z-0 pointer-events-none'
                    )}
                    style={{
                      transitionDuration: `${POSTER_CROSSFADE_MS}ms`,
                    }}
                    aria-hidden={visiblePosterSlot !== slot}
                  >
                    {posterSlotUrl[slot] ? (
                      <img
                        ref={slot === 0 ? img0Ref : img1Ref}
                        src={posterSlotUrl[slot]!}
                        alt=""
                        loading="eager"
                        decoding="async"
                        fetchPriority={visiblePosterSlot === slot ? 'high' : 'low'}
                        className="h-full w-full min-h-[160px] sm:min-h-0 object-cover rounded-[3px]"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex h-full min-h-[160px] w-full items-center justify-center sm:min-h-0">
                        <Film className="w-12 h-12 text-greyscale-blue-400" aria-hidden />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-4 items-start justify-between flex-1 w-full min-w-0 self-stretch">
                <div className="flex flex-col gap-2 items-start w-full">
                  <h3 className="m-0 text-2xl font-semibold leading-[30px] tracking-wide font-brockmann text-greyscale-blue-100">
                    {draft.name}
                  </h3>
                  {draft.description && (
                    <p className="m-0 text-sm font-normal leading-5 font-brockmann text-greyscale-blue-100">
                      {draft.description}
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => handleBeginSetup(draft)}
                  className="w-full bg-brand-primary hover:bg-brand-primary/90 text-greyscale-blue-100 h-9 px-4 py-2 rounded-[2px] self-stretch font-brockmann font-medium text-sm transition-colors"
                >
                  Begin Setup
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-between items-center gap-3 w-full shrink-0">
        <div
          className="flex items-center gap-3 pl-3 flex-wrap"
          role="tablist"
          aria-label="Special draft slides"
        >
          {specDrafts.map((d, i) => (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={i === carouselIndex}
              aria-label={`Show draft ${i + 1}: ${d.name}`}
              onClick={() => goToSlide(i)}
              className={cn(
                'w-3 h-3 rounded-full border border-purple-200 shrink-0 transition-colors',
                i === carouselIndex ? 'bg-purple-600' : 'bg-transparent hover:bg-purple-600/40'
              )}
            />
          ))}
        </div>
        <Link
          to="/special-draft"
          className="inline-flex items-center gap-2 h-9 px-3 rounded-[2px] text-sm font-medium font-brockmann text-purple-200 hover:text-purple-100 transition-colors"
        >
          See All
          <ArrowRight className="w-4 h-4" />
        </Link>
        </div>
      </div>
    </div>
  );
};
