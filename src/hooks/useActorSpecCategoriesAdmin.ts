import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ActorSpecCategory {
  id: string;
  actor_name: string;
  actor_tmdb_id: number | null;
  category_name: string;
  movie_tmdb_ids: number[];
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const useActorSpecCategoriesAdmin = () => {
  const [categories, setCategories] = useState<ActorSpecCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('actor_spec_categories')
        .select('*')
        .order('actor_name', { ascending: true })
        .order('category_name', { ascending: true });

      if (fetchError) throw fetchError;

      setCategories(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch categories';
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

  const createCategory = useCallback(async (
    actorName: string,
    categoryName: string,
    movieTmdbIds: number[],
    description?: string,
    actorTmdbId?: number | null
  ) => {
    setLoading(true);
    setError(null);

    try {
      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('Auth error:', authError);
        throw new Error(`Authentication error: ${authError.message}`);
      }
      if (!user) {
        throw new Error('You must be logged in to create categories');
      }

      console.log('Creating category as user:', user.email, 'ID:', user.id);

      const { data, error: createError } = await supabase
        .from('actor_spec_categories')
        .insert({
          actor_name: actorName,
          actor_tmdb_id: actorTmdbId || null,
          category_name: categoryName,
          movie_tmdb_ids: movieTmdbIds,
          description: description || null,
        })
        .select()
        .single();

      if (createError) {
        console.error('Create error details:', {
          message: createError.message,
          code: createError.code,
          details: createError.details,
          hint: createError.hint,
        });
        throw createError;
      }

      setCategories(prev => [...prev, data].sort((a, b) => 
        a.actor_name.localeCompare(b.actor_name) || 
        a.category_name.localeCompare(b.category_name)
      ));

      toast({
        title: 'Success',
        description: `Category "${categoryName}" for ${actorName} created successfully`,
      });

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create category';
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

  const updateCategory = useCallback(async (
    id: string,
    updates: {
      actor_name?: string;
      actor_tmdb_id?: number | null;
      category_name?: string;
      movie_tmdb_ids?: number[];
      description?: string | null;
    }
  ) => {
    setLoading(true);
    setError(null);

    try {
      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('Auth error:', authError);
        throw new Error(`Authentication error: ${authError.message}`);
      }
      if (!user) {
        throw new Error('You must be logged in to update categories');
      }

      console.log('Updating category as user:', user.email, 'ID:', user.id);

      const { data, error: updateError } = await supabase
        .from('actor_spec_categories')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('Update error details:', {
          message: updateError.message,
          code: updateError.code,
          details: updateError.details,
          hint: updateError.hint,
        });
        throw updateError;
      }

      setCategories(prev => prev.map(cat => 
        cat.id === id ? data : cat
      ).sort((a, b) => 
        a.actor_name.localeCompare(b.actor_name) || 
        a.category_name.localeCompare(b.category_name)
      ));

      toast({
        title: 'Success',
        description: 'Category updated successfully',
      });

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update category';
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

  const deleteCategory = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('Auth error:', authError);
        throw new Error(`Authentication error: ${authError.message}`);
      }
      if (!user) {
        throw new Error('You must be logged in to delete categories');
      }

      console.log('Deleting category as user:', user.email, 'ID:', user.id);

      const { error: deleteError } = await supabase
        .from('actor_spec_categories')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Delete error details:', {
          message: deleteError.message,
          code: deleteError.code,
          details: deleteError.details,
          hint: deleteError.hint,
        });
        throw deleteError;
      }

      setCategories(prev => prev.filter(cat => cat.id !== id));

      toast({
        title: 'Success',
        description: 'Category deleted successfully',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete category';
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
    categories,
    loading,
    error,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  };
};

