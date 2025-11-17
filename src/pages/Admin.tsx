import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useActorSpecCategoriesAdmin, ActorSpecCategory } from '@/hooks/useActorSpecCategoriesAdmin';
import { ActorSpecCategoryForm } from '@/components/admin/ActorSpecCategoryForm';
import { ActorSpecCategoryList } from '@/components/admin/ActorSpecCategoryList';
import { useSpecDraftsAdmin, SpecDraft, SpecDraftWithMovies } from '@/hooks/useSpecDraftsAdmin';
import { SpecDraftForm } from '@/components/admin/SpecDraftForm';
import { SpecDraftList } from '@/components/admin/SpecDraftList';
import { SpecDraftMovieManager } from '@/components/admin/SpecDraftMovieManager';
import { ArrowLeft, Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAdminAccess();
  const {
    categories,
    loading: categoriesLoading,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useActorSpecCategoriesAdmin();
  const { toast } = useToast();

  const [editingCategory, setEditingCategory] = useState<ActorSpecCategory | null>(null);
  const [activeTab, setActiveTab] = useState('actor-categories');
  const [specDraftSection, setSpecDraftSection] = useState<'list' | 'form' | 'movies'>('list');
  const [editingSpecDraft, setEditingSpecDraft] = useState<SpecDraft | null>(null);
  const [managingMoviesForDraft, setManagingMoviesForDraft] = useState<SpecDraftWithMovies | null>(null);

  const {
    specDrafts,
    loading: specDraftsLoading,
    fetchSpecDrafts,
    fetchSpecDraftWithMovies,
    createSpecDraft,
    updateSpecDraft,
    deleteSpecDraft,
  } = useSpecDraftsAdmin();

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to access this page.',
        variant: 'destructive',
      });
      navigate('/');
    }
  }, [isAdmin, authLoading, navigate, toast]);

  useEffect(() => {
    if (isAdmin) {
      fetchCategories();
      fetchSpecDrafts();
    }
  }, [isAdmin, fetchCategories, fetchSpecDrafts]);

  const handleCreate = async (data: {
    actorName: string;
    actorTmdbId: number | null;
    categoryName: string;
    movieTmdbIds: number[];
    description?: string;
  }) => {
    try {
      await createCategory(
        data.actorName,
        data.categoryName,
        data.movieTmdbIds,
        data.description,
        data.actorTmdbId
      );
      setActiveTab('list');
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleUpdate = async (data: {
    actorName: string;
    actorTmdbId: number | null;
    categoryName: string;
    movieTmdbIds: number[];
    description?: string;
  }) => {
    if (!editingCategory) return;

    try {
      await updateCategory(editingCategory.id, {
        actor_name: data.actorName,
        actor_tmdb_id: data.actorTmdbId,
        category_name: data.categoryName,
        movie_tmdb_ids: data.movieTmdbIds,
        description: data.description || null,
      });
      setEditingCategory(null);
      setActiveTab('list');
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleEdit = (category: ActorSpecCategory) => {
    setEditingCategory(category);
    setActiveTab('actor-categories');
  };

  const handleCancel = () => {
    setEditingCategory(null);
    setActiveTab('actor-categories');
  };

  // Spec Draft handlers
  const handleSpecDraftCreate = async (data: { name: string; description?: string }) => {
    try {
      await createSpecDraft(data.name, data.description);
      setSpecDraftSection('list');
      setEditingSpecDraft(null);
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleSpecDraftUpdate = async (data: { name: string; description?: string }) => {
    if (!editingSpecDraft) return;

    try {
      await updateSpecDraft(editingSpecDraft.id, data);
      setSpecDraftSection('list');
      setEditingSpecDraft(null);
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleSpecDraftEdit = (specDraft: SpecDraft) => {
    setEditingSpecDraft(specDraft);
    setSpecDraftSection('form');
  };

  const handleSpecDraftCancel = () => {
    setEditingSpecDraft(null);
    setSpecDraftSection('list');
  };

  const handleManageMovies = async (specDraft: SpecDraft) => {
    const draftWithMovies = await fetchSpecDraftWithMovies(specDraft.id);
    if (draftWithMovies) {
      setManagingMoviesForDraft(draftWithMovies);
      setSpecDraftSection('movies');
    }
  };

  const handleSpecDraftDelete = async (id: string) => {
    try {
      await deleteSpecDraft(id);
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleMovieManagerRefresh = async () => {
    if (managingMoviesForDraft) {
      const updated = await fetchSpecDraftWithMovies(managingMoviesForDraft.id);
      if (updated) {
        setManagingMoviesForDraft(updated);
      }
    }
    fetchSpecDrafts();
  };

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Will redirect
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/profile')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Profile
        </Button>
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <p className="text-gray-600 mt-2">Manage Actor Spec Categories and Spec Drafts</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="actor-categories">Actor Spec Categories</TabsTrigger>
          <TabsTrigger value="spec-drafts">Spec Draft Builder</TabsTrigger>
        </TabsList>

        {/* Actor Spec Categories Tab */}
        <TabsContent value="actor-categories" className="space-y-6">
          {!editingCategory ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => {
                  setEditingCategory(null);
                  setActiveTab('actor-categories');
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Category
                </Button>
              </div>
              <ActorSpecCategoryList
                categories={categories}
                onEdit={handleEdit}
                onDelete={deleteCategory}
                loading={categoriesLoading}
              />
            </div>
          ) : (
            <ActorSpecCategoryForm
              category={editingCategory}
              onSubmit={editingCategory ? handleUpdate : handleCreate}
              onCancel={handleCancel}
              loading={categoriesLoading}
            />
          )}
        </TabsContent>

        {/* Spec Draft Builder Tab */}
        <TabsContent value="spec-drafts" className="space-y-6">
          {specDraftSection === 'list' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => {
                  setEditingSpecDraft(null);
                  setSpecDraftSection('form');
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Spec Draft
                </Button>
              </div>
              <SpecDraftList
                specDrafts={specDrafts}
                onEdit={handleSpecDraftEdit}
                onDelete={handleSpecDraftDelete}
                onManageMovies={handleManageMovies}
                loading={specDraftsLoading}
              />
            </div>
          )}

          {specDraftSection === 'form' && (
            <SpecDraftForm
              specDraft={editingSpecDraft}
              onSubmit={editingSpecDraft ? handleSpecDraftUpdate : handleSpecDraftCreate}
              onCancel={handleSpecDraftCancel}
              loading={specDraftsLoading}
            />
          )}

          {specDraftSection === 'movies' && managingMoviesForDraft && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{managingMoviesForDraft.name}</h2>
                  {managingMoviesForDraft.description && (
                    <p className="text-gray-600 mt-1">{managingMoviesForDraft.description}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setManagingMoviesForDraft(null);
                    setSpecDraftSection('list');
                  }}
                >
                  Back to List
                </Button>
              </div>
              <SpecDraftMovieManager
                specDraft={managingMoviesForDraft}
                onMovieAdded={handleMovieManagerRefresh}
                onMovieRemoved={handleMovieManagerRefresh}
                onCategoriesUpdated={handleMovieManagerRefresh}
                loading={specDraftsLoading}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;

