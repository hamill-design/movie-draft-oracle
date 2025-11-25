import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SpecDraft {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
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
      // Explicitly select columns to handle cases where photo_url column might not exist yet
      const { data, error: fetchError } = await supabase
        .from('spec_drafts')
        .select('id, name, description, photo_url, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (fetchError) {
        // If photo_url doesn't exist or there's a 400 error, try without it
        if (
          fetchError.message?.includes('photo_url') || 
          fetchError.message?.includes('column') ||
          fetchError.code === 'PGRST116' ||
          fetchError.status === 400 ||
          fetchError.statusCode === 400
        ) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('spec_drafts')
            .select('id, name, description, created_at, updated_at')
            .order('created_at', { ascending: false });
          
          if (fallbackError) throw fallbackError;
          
          // Map to include photo_url as null
          setSpecDrafts((fallbackData || []).map(draft => ({ ...draft, photo_url: null })));
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
      const { data: initialDraftData, error: draftError } = await supabase
        .from('spec_drafts')
        .select('id, name, description, photo_url, created_at, updated_at')
        .eq('id', specDraftId)
        .single();
      
      // If photo_url column doesn't exist or there's a 400 error, try without it
      if (draftError && (
        draftError.message?.includes('photo_url') || 
        draftError.message?.includes('column') ||
        draftError.code === 'PGRST116' ||
        draftError.status === 400 ||
        draftError.statusCode === 400
      )) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('spec_drafts')
          .select('id, name, description, created_at, updated_at')
          .eq('id', specDraftId)
          .single();
        
        if (fallbackError) throw fallbackError;
        if (!fallbackData) return null;
        
        // Add photo_url as null
        draftData = { ...fallbackData, photo_url: null };
      } else {
        if (draftError) throw draftError;
        if (!initialDraftData) return null;
        draftData = initialDraftData;
      }

      // Fetch movies
      const { data: moviesData, error: moviesError } = await supabase
        .from('spec_draft_movies')
        .select('*')
        .eq('spec_draft_id', specDraftId)
        .order('movie_title', { ascending: true });

      if (moviesError) throw moviesError;

      // Fetch custom categories for this spec draft
      // Explicitly set a high limit to ensure we get all categories (Supabase default is 1000, but being explicit)
      const { data: customCategoriesData, error: customCategoriesError } = await supabase
        .from('spec_draft_categories')
        .select('*')
        .eq('spec_draft_id', specDraftId)
        .order('category_name', { ascending: true })
        .limit(1000); // Explicit limit to ensure we get all categories

      if (customCategoriesError) {
        console.error('Error fetching custom categories:', customCategoriesError);
      } else {
        console.log(`✅ Fetched ${customCategoriesData?.length || 0} custom categories for spec draft ${specDraftId}`);
        if (customCategoriesData && customCategoriesData.length > 0) {
          console.log('Custom categories:', customCategoriesData.map(c => c.category_name));
        }
      }

      // Fetch categories for each movie
      const moviesWithCategories = await Promise.all(
        (moviesData || []).map(async (movie) => {
          const { data: categoriesData, error: categoriesError } = await supabase
            .from('spec_draft_movie_categories')
            .select('*')
            .eq('spec_draft_movie_id', movie.id)
            .order('category_name', { ascending: true });

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

      const { data, error: createError } = await supabase
        .from('spec_drafts')
        .insert({
          name: name.trim(),
          description: description?.trim() || null,
          photo_url: photoUrl || null,
        })
        .select('id, name, description, photo_url, created_at, updated_at')
        .single();

      if (createError) throw createError;

      setSpecDrafts(prev => [data, ...prev]);

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
      
      const { data: updateResult, error: updateErr } = await supabase
        .from('spec_drafts')
        .update(updateData)
        .eq('id', id)
        .select('id, name, description, photo_url, created_at, updated_at')
        .single();
      
      data = updateResult;
      updateError = updateErr;
      
      // If photo_url column doesn't exist, try without it
      if (updateError && (
        updateError.message?.includes('photo_url') || 
        updateError.message?.includes('column') ||
        updateError.code === 'PGRST116' ||
        updateError.status === 400 ||
        updateError.statusCode === 400
      ) && updates.photo_url !== undefined) {
        // Remove photo_url from update and try again
        const { photo_url, ...updateWithoutPhoto } = updateData;
        const { data: fallbackResult, error: fallbackError } = await supabase
          .from('spec_drafts')
          .update(updateWithoutPhoto)
          .eq('id', id)
          .select('id, name, description, created_at, updated_at')
          .single();
        
        if (fallbackError) throw fallbackError;
        data = { ...fallbackResult, photo_url: null };
        updateError = null;
      }
      
      if (updateError) throw updateError;

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

      const { error: deleteError } = await supabase
        .from('spec_drafts')
        .delete()
        .eq('id', id);

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

      const { data, error: insertError } = await supabase
        .from('spec_draft_movies')
        .insert({
          spec_draft_id: specDraftId,
          ...movie,
        })
        .select()
        .single();

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

      const { error: deleteError } = await supabase
        .from('spec_draft_movies')
        .delete()
        .eq('id', specDraftMovieId);

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
      const { error: deleteError } = await supabase
        .from('spec_draft_movie_categories')
        .delete()
        .eq('spec_draft_movie_id', specDraftMovieId);

      if (deleteError) throw deleteError;

      // Insert new categories
      if (categoryNames.length > 0) {
        const categoriesToInsert = categoryNames.map(categoryName => ({
          spec_draft_movie_id: specDraftMovieId,
          category_name: categoryName,
          is_automated: isAutomated,
        }));

        const { error: insertError } = await supabase
          .from('spec_draft_movie_categories')
          .insert(categoriesToInsert);

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

      const { data, error: createError } = await supabase
        .from('spec_draft_categories')
        .insert({
          spec_draft_id: specDraftId,
          category_name: categoryName.trim(),
          description: description?.trim() || null,
        })
        .select()
        .single();

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

      const { data, error: updateError } = await supabase
        .from('spec_draft_categories')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

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

      const { error: deleteError } = await supabase
        .from('spec_draft_categories')
        .delete()
        .eq('id', id);

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

  return {
    specDrafts,
    loading,
    error,
    fetchSpecDrafts,
    fetchSpecDraftWithMovies,
    createSpecDraft,
    updateSpecDraft,
    deleteSpecDraft,
    addMovieToSpecDraft,
    removeMovieFromSpecDraft,
    updateMovieCategories,
    createCustomCategory,
    updateCustomCategory,
    deleteCustomCategory,
  };
};

