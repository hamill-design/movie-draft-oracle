import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SpecDraft {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  display_order: number | null;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpecDraftMovie {
  id: string;
  spec_draft_id: string;
  movie_tmdb_id: number;
  movie_title: string;
  movie_year: number | null;
  movie_poster_path: string | null;
  movie_genres: number[] | null;
  oscar_status: string | null;
  revenue: number | null;
  created_at: string;
}

export interface SpecDraftMovieCategory {
  id: string;
  spec_draft_movie_id: string;
  category_name: string;
  is_automated: boolean;
  created_at: string;
}

export interface SpecDraftCategory {
  id: string;
  spec_draft_id: string;
  category_name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpecDraftWithMovies extends SpecDraft {
  movies: (SpecDraftMovie & {
    categories: SpecDraftMovieCategory[];
  })[];
  customCategories?: SpecDraftCategory[];
}

export const useSpecDraftsAdmin = () => {
  const [specDrafts, setSpecDrafts] = useState<SpecDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSpecDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Try to fetch with all columns including display_order and is_hidden
      // First try with display_order in the order clause
      const { data, error: fetchError } = await (supabase
        .from('spec_drafts' as any)
        .select('id, name, description, photo_url, display_order, is_hidden, created_at, updated_at')
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false }) as any);

      if (fetchError) {
        // Check if it's a column error
        const isColumnError = 
          fetchError.message?.includes('column') ||
          fetchError.message?.includes('does not exist') ||
          fetchError.code === 'PGRST116' ||
          (fetchError as any).status === 400 ||
          (fetchError as any).statusCode === 400;
        
        if (isColumnError) {
          console.log('Some columns not found, trying fallback queries');
          
          // Try without display_order and is_hidden in both SELECT and ORDER BY
          // First try with photo_url
          const { data: fallbackData, error: fallbackError } = await (supabase
            .from('spec_drafts' as any)
            .select('id, name, description, photo_url, created_at, updated_at')
            .order('created_at', { ascending: false }) as any);
          
          if (fallbackError) {
            // If photo_url also doesn't exist, try without it
            const { data: minimalData, error: minimalError } = await (supabase
              .from('spec_drafts' as any)
              .select('id, name, description, created_at, updated_at')
              .order('created_at', { ascending: false }) as any);
            
            if (minimalError) throw minimalError;
            
            // Map to include missing columns as defaults
            setSpecDrafts((minimalData || []).map((draft: any) => ({ 
              ...draft, 
              photo_url: null,
              display_order: null,
              is_hidden: false
            })));
            return;
          }
          
          // Map to include missing columns as defaults
          setSpecDrafts((fallbackData || []).map((draft: any) => ({ 
            ...draft, 
            display_order: null,
            is_hidden: false
          })));
          return;
        }
        throw fetchError;
      }

      setSpecDrafts(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch spec drafts';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchSpecDraftWithMovies = useCallback(async (specDraftId: string): Promise<SpecDraftWithMovies | null> => {
    setLoading(true);
    setError(null);

    try {
      // Fetch spec draft - explicitly select columns
      let draftData: any;
      const { data: initialDraftData, error: draftError } = await (supabase
        .from('spec_drafts' as any)
        .select('id, name, description, photo_url, display_order, is_hidden, created_at, updated_at')
        .eq('id', specDraftId)
        .single() as any);
      
      // If column error, try fallback queries
      const isColumnError = draftError && (
        draftError.message?.includes('column') ||
        draftError.message?.includes('does not exist') ||
        draftError.code === 'PGRST116' ||
        (draftError as any).status === 400 ||
        (draftError as any).statusCode === 400
      );
      
      if (isColumnError) {
        console.log('Some columns not found, trying fallback query');
        // Try with photo_url but without display_order and is_hidden
        const { data: fallbackData, error: fallbackError } = await (supabase
          .from('spec_drafts' as any)
          .select('id, name, description, photo_url, created_at, updated_at')
          .eq('id', specDraftId)
          .single() as any);
        
        if (fallbackError) {
          // If photo_url also doesn't exist, try without it
          const { data: minimalData, error: minimalError } = await (supabase
            .from('spec_drafts' as any)
            .select('id, name, description, created_at, updated_at')
            .eq('id', specDraftId)
            .single() as any);
          
          if (minimalError) throw minimalError;
          if (!minimalData) return null;
          
          draftData = { 
            ...minimalData, 
            photo_url: null,
            display_order: null,
            is_hidden: false
          };
        } else {
          if (!fallbackData) return null;
          draftData = { 
            ...fallbackData, 
            display_order: null,
            is_hidden: false
          };
        }
      } else {
        if (draftError) throw draftError;
        if (!initialDraftData) return null;
        draftData = initialDraftData;
      }

      // Fetch movies
      const { data: moviesData, error: moviesError } = await (supabase
        .from('spec_draft_movies' as any)
        .select('*')
        .eq('spec_draft_id', specDraftId)
        .order('movie_title', { ascending: true }) as any);

      if (moviesError) throw moviesError;

      // Fetch custom categories for this spec draft
      // Explicitly set a high limit to ensure we get all categories (Supabase default is 1000, but being explicit)
      const { data: customCategoriesData, error: customCategoriesError } = await (supabase
        .from('spec_draft_categories' as any)
        .select('*')
        .eq('spec_draft_id', specDraftId)
        .order('category_name', { ascending: true })
        .limit(1000) as any); // Explicit limit to ensure we get all categories

      if (customCategoriesError) {
        console.error('Error fetching custom categories:', customCategoriesError);
      } else {
        console.log(`✅ Fetched ${customCategoriesData?.length || 0} custom categories for spec draft ${specDraftId}`);
        if (customCategoriesData && customCategoriesData.length > 0) {
          console.log('Custom categories:', customCategoriesData.map((c: any) => c.category_name));
        }
      }

      // Fetch categories for each movie
      const moviesWithCategories = await Promise.all(
        (moviesData || []).map(async (movie: any) => {
          const { data: categoriesData, error: categoriesError } = await (supabase
            .from('spec_draft_movie_categories' as any)
            .select('*')
            .eq('spec_draft_movie_id', movie.id)
            .order('category_name', { ascending: true }) as any);

          if (categoriesError) {
            console.error(`Error fetching categories for movie ${movie.id}:`, categoriesError);
          }

          return {
            ...movie,
            categories: categoriesData || [],
          };
        })
      );

      return {
        ...draftData,
        movies: moviesWithCategories,
        customCategories: customCategoriesData || [],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch spec draft';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createSpecDraft = useCallback(async (
    name: string,
    description?: string,
    photoUrl?: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        throw new Error(`Authentication error: ${authError.message}`);
      }
      if (!user) {
        throw new Error('You must be logged in to create spec drafts');
      }

      const { data, error: createError } = await (supabase
        .from('spec_drafts' as any)
        .insert({
          name: name.trim(),
          description: description?.trim() || null,
          photo_url: photoUrl || null,
        } as any)
        .select('id, name, description, photo_url, display_order, is_hidden, created_at, updated_at')
        .single() as any);

      if (createError) throw createError;

      // Set display_order for new draft (get max order + 1)
      const maxOrder = specDrafts.length > 0 
        ? Math.max(...specDrafts.map(d => d.display_order || 0))
        : 0;
      
      const draftWithOrder = { ...(data as any), display_order: maxOrder + 1, is_hidden: false };
      
      // Update the draft with display_order
      await (supabase
        .from('spec_drafts' as any)
        .update({ display_order: maxOrder + 1 } as any)
        .eq('id', (data as any).id) as any);

      setSpecDrafts(prev => [draftWithOrder, ...prev]);

      toast({
        title: 'Success',
        description: `Spec draft "${name}" created successfully`,
      });

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create spec draft';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const updateSpecDraft = useCallback(async (
    id: string,
    updates: {
      name?: string;
      description?: string | null;
      photo_url?: string | null;
    }
  ) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        throw new Error(`Authentication error: ${authError.message}`);
      }
      if (!user) {
        throw new Error('You must be logged in to update spec drafts');
      }

      // Build update object, excluding photo_url if column doesn't exist
      const updateData: any = {
        ...updates,
        updated_at: new Date().toISOString(),
      };
      
      // Try to update with photo_url first
      let data: any;
      let updateError: any;
      
      console.log('🔄 Updating spec draft in database:', {
        id,
        updateData,
        photo_url: updates.photo_url,
      });
      
      const { data: updateResult, error: updateErr } = await (supabase
        .from('spec_drafts' as any)
        .update(updateData as any)
        .eq('id', id)
        .select('id, name, description, photo_url, display_order, is_hidden, created_at, updated_at')
        .single() as any);
      
      data = updateResult;
      updateError = updateErr;
      
      console.log('📊 Update response:', {
        data,
        error: updateError,
        photo_url_in_response: data?.photo_url,
      });
      
      // If column error, try fallback
      if (updateError && (
        updateError.message?.includes('column') ||
        updateError.message?.includes('does not exist') ||
        updateError.code === 'PGRST116' ||
        updateError.status === 400 ||
        updateError.statusCode === 400
      )) {
        console.warn('⚠️ Some columns may not exist, trying fallback');
        // Try to update without display_order and is_hidden in select
        const { data: fallbackResult, error: fallbackError } = await (supabase
          .from('spec_drafts' as any)
          .update(updateData as any)
          .eq('id', id)
          .select('id, name, description, photo_url, created_at, updated_at')
          .single() as any);
        
        if (fallbackError) {
          // If photo_url also doesn't exist, try without it
          const { photo_url, ...updateWithoutPhoto } = updateData;
          const { data: minimalResult, error: minimalError } = await (supabase
            .from('spec_drafts' as any)
            .update(updateWithoutPhoto as any)
            .eq('id', id)
            .select('id, name, description, created_at, updated_at')
            .single() as any);
          
          if (minimalError) throw minimalError;
          data = { 
            ...(minimalResult as any), 
            photo_url: null,
            display_order: null,
            is_hidden: false
          };
        } else {
          data = { 
            ...(fallbackResult as any), 
            display_order: null,
            is_hidden: false
          };
        }
        updateError = null;
        console.warn('⚠️ Updated with fallback - some columns may not exist in database');
      }
      
      if (updateError) throw updateError;

      setSpecDrafts(prev => prev.map(draft => 
        draft.id === id ? data : draft
      ));

      toast({
        title: 'Success',
        description: 'Spec draft updated successfully',
      });

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update spec draft';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const deleteSpecDraft = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        throw new Error(`Authentication error: ${authError.message}`);
      }
      if (!user) {
        throw new Error('You must be logged in to delete spec drafts');
      }

      const { error: deleteError } = await (supabase
        .from('spec_drafts' as any)
        .delete()
        .eq('id', id) as any);

      if (deleteError) throw deleteError;

      setSpecDrafts(prev => prev.filter(draft => draft.id !== id));

      toast({
        title: 'Success',
        description: 'Spec draft deleted successfully',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete spec draft';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const addMovieToSpecDraft = useCallback(async (
    specDraftId: string,
    movie: {
      movie_tmdb_id: number;
      movie_title: string;
      movie_year?: number | null;
      movie_poster_path?: string | null;
      movie_genres?: number[] | null;
    }
  ) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        throw new Error(`Authentication error: ${authError.message}`);
      }
      if (!user) {
        throw new Error('You must be logged in to add movies');
      }

      const { data, error: insertError } = await (supabase
        .from('spec_draft_movies' as any)
        .insert({
          spec_draft_id: specDraftId,
          ...movie,
        } as any)
        .select()
        .single() as any);

      if (insertError) throw insertError;

      toast({
        title: 'Success',
        description: `Movie "${movie.movie_title}" added to spec draft`,
      });

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add movie';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const removeMovieFromSpecDraft = useCallback(async (specDraftMovieId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        throw new Error(`Authentication error: ${authError.message}`);
      }
      if (!user) {
        throw new Error('You must be logged in to remove movies');
      }

      const { error: deleteError } = await (supabase
        .from('spec_draft_movies' as any)
        .delete()
        .eq('id', specDraftMovieId) as any);

      if (deleteError) throw deleteError;

      toast({
        title: 'Success',
        description: 'Movie removed from spec draft',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove movie';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const updateMovieCategories = useCallback(async (
    specDraftMovieId: string,
    categoryNames: string[],
    isAutomated: boolean = false
  ) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        throw new Error(`Authentication error: ${authError.message}`);
      }
      if (!user) {
        throw new Error('You must be logged in to update categories');
      }

      // Delete existing categories
      const { error: deleteError } = await (supabase
        .from('spec_draft_movie_categories' as any)
        .delete()
        .eq('spec_draft_movie_id', specDraftMovieId) as any);

      if (deleteError) throw deleteError;

      // Insert new categories
      if (categoryNames.length > 0) {
        const categoriesToInsert = categoryNames.map(categoryName => ({
          spec_draft_movie_id: specDraftMovieId,
          category_name: categoryName,
          is_automated: isAutomated,
        }));

        const { error: insertError } = await (supabase
          .from('spec_draft_movie_categories' as any)
          .insert(categoriesToInsert as any) as any);

        if (insertError) throw insertError;
      }

      toast({
        title: 'Success',
        description: 'Movie categories updated',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update categories';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createCustomCategory = useCallback(async (
    specDraftId: string,
    categoryName: string,
    description?: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        throw new Error(`Authentication error: ${authError.message}`);
      }
      if (!user) {
        throw new Error('You must be logged in to create custom categories');
      }

      const { data, error: createError } = await (supabase
        .from('spec_draft_categories' as any)
        .insert({
          spec_draft_id: specDraftId,
          category_name: categoryName.trim(),
          description: description?.trim() || null,
        } as any)
        .select()
        .single() as any);

      if (createError) throw createError;

      toast({
        title: 'Success',
        description: `Custom category "${categoryName}" created successfully`,
      });

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create custom category';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const updateCustomCategory = useCallback(async (
    id: string,
    updates: {
      category_name?: string;
      description?: string | null;
    }
  ) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        throw new Error(`Authentication error: ${authError.message}`);
      }
      if (!user) {
        throw new Error('You must be logged in to update custom categories');
      }

      const { data, error: updateError } = await (supabase
        .from('spec_draft_categories' as any)
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', id)
        .select()
        .single() as any);

      if (updateError) throw updateError;

      toast({
        title: 'Success',
        description: 'Custom category updated successfully',
      });

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update custom category';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const deleteCustomCategory = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        throw new Error(`Authentication error: ${authError.message}`);
      }
      if (!user) {
        throw new Error('You must be logged in to delete custom categories');
      }

      const { error: deleteError } = await (supabase
        .from('spec_draft_categories' as any)
        .delete()
        .eq('id', id) as any);

      if (deleteError) throw deleteError;

      toast({
        title: 'Success',
        description: 'Custom category deleted successfully',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete custom category';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Add new function for reordering spec drafts
  const reorderSpecDrafts = useCallback(async (reorderedDrafts: SpecDraft[]) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        throw new Error(`Authentication error: ${authError.message}`);
      }
      if (!user) {
        throw new Error('You must be logged in to reorder spec drafts');
      }

      // Try to update display_order for the first draft to check if column exists
      const testUpdate = await (supabase
        .from('spec_drafts' as any)
        .update({ display_order: 1, updated_at: new Date().toISOString() } as any)
        .eq('id', reorderedDrafts[0]?.id || '')
        .select('id')
        .limit(1) as any);

      // Check if display_order column exists
      if (testUpdate.error && (
        testUpdate.error.message?.includes('display_order') ||
        testUpdate.error.message?.includes('column') ||
        testUpdate.error.code === 'PGRST116' ||
        testUpdate.error.status === 400
      )) {
        toast({
          title: 'Migration Required',
          description: 'Please run the migration to add display_order and is_hidden columns. The migration SQL is in supabase/migrations/20251116000000_add_order_and_hidden_to_spec_drafts.sql',
          variant: 'destructive',
        });
        throw new Error('display_order column does not exist. Please run the migration first.');
      }

      // Update display_order for each draft
      const updates = reorderedDrafts.map((draft, index) => ({
        id: draft.id,
        display_order: index + 1,
      }));

      // Batch update all drafts
      const updatePromises = updates.map(({ id, display_order }) =>
        (supabase
          .from('spec_drafts' as any)
          .update({ display_order, updated_at: new Date().toISOString() } as any)
          .eq('id', id) as any)
      );

      const results = await Promise.all(updatePromises);
      
      // Check for errors
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw errors[0].error;
      }

      // Update local state
      setSpecDrafts(reorderedDrafts.map((draft, index) => ({
        ...draft,
        display_order: index + 1,
      })));

      toast({
        title: 'Success',
        description: 'Spec drafts reordered successfully',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reorder spec drafts';
      setError(errorMessage);
      // Don't show duplicate toast if we already showed the migration required one
      if (!errorMessage.includes('display_order column does not exist')) {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Add new function for toggling visibility
  const toggleSpecDraftVisibility = useCallback(async (id: string, isHidden: boolean) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        throw new Error(`Authentication error: ${authError.message}`);
      }
      if (!user) {
        throw new Error('You must be logged in to toggle spec draft visibility');
      }

      const { data, error: updateError } = await (supabase
        .from('spec_drafts' as any)
        .update({ 
          is_hidden: isHidden,
          updated_at: new Date().toISOString() 
        } as any)
        .eq('id', id)
        .select('id, name, description, photo_url, display_order, is_hidden, created_at, updated_at')
        .single() as any);

      if (updateError) {
        // If is_hidden column doesn't exist, show a helpful message
        if (updateError.message?.includes('is_hidden') || 
            updateError.message?.includes('column') ||
            updateError.code === 'PGRST116' ||
            updateError.status === 400) {
          toast({
            title: 'Migration Required',
            description: 'Please run the migration to add display_order and is_hidden columns to spec_drafts table.',
            variant: 'destructive',
          });
          throw new Error('is_hidden column does not exist. Please run the migration first.');
        }
        throw updateError;
      }

      // Update local state
      setSpecDrafts(prev => prev.map(draft => 
        draft.id === id ? data : draft
      ));

      toast({
        title: 'Success',
        description: `Spec draft ${isHidden ? 'hidden' : 'shown'} successfully`,
      });

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle visibility';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    specDrafts,
    loading,
    error,
    fetchSpecDrafts,
    fetchSpecDraftWithMovies,
    createSpecDraft,
    updateSpecDraft,
    deleteSpecDraft,
    reorderSpecDrafts,
    toggleSpecDraftVisibility,
    addMovieToSpecDraft,
    removeMovieFromSpecDraft,
    updateMovieCategories,
    createCustomCategory,
    updateCustomCategory,
    deleteCustomCategory,
  };
};

