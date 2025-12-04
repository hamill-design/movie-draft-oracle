
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from '@/components/ui/sidebar';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useActorSpecCategoriesAdmin, ActorSpecCategory } from '@/hooks/useActorSpecCategoriesAdmin';
import { ActorSpecCategoryForm } from '@/components/admin/ActorSpecCategoryForm';
import { ActorSpecCategoryList } from '@/components/admin/ActorSpecCategoryList';
import { useSpecDraftsAdmin, SpecDraft, SpecDraftWithMovies } from '@/hooks/useSpecDraftsAdmin';
import { SpecDraftForm } from '@/components/admin/SpecDraftForm';
import { SpecDraftList } from '@/components/admin/SpecDraftList';
import { SpecDraftMovieManager } from '@/components/admin/SpecDraftMovieManager';
import { SpecDraftCategoriesManager } from '@/components/admin/SpecDraftCategoriesManager';
import { ArrowLeft, Plus, Loader2, Users, Film } from 'lucide-react';
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
  const [activeSection, setActiveSection] = useState<'actor-categories' | 'spec-drafts'>('actor-categories');
  const [actorCategorySection, setActorCategorySection] = useState<'list' | 'form'>('list');
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
    createCustomCategory,
    updateCustomCategory,
    deleteCustomCategory,
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
      setEditingCategory(null);
      setActorCategorySection('list');
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
      setActorCategorySection('list');
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleEdit = (category: ActorSpecCategory) => {
    setEditingCategory(category);
    setActorCategorySection('form');
  };

  const handleCancel = () => {
    setEditingCategory(null);
    setActorCategorySection('list');
  };

  // Spec Draft handlers
  const handleSpecDraftCreate = async (data: { name: string; description?: string; photoUrl?: string; photoFile?: File | null }) => {
    try {
      // Create the draft first
      const newDraft = await createSpecDraft(data.name, data.description);
      
      // If there's a photo file, upload it after creation
      if (data.photoFile && newDraft) {
        const { uploadSpecDraftPhoto } = await import('@/utils/specDraftPhotoUpload');
        try {
          const photoUrl = await uploadSpecDraftPhoto(newDraft.id, data.photoFile);
          // Update the draft with the photo URL
          await updateSpecDraft(newDraft.id, {
            photo_url: photoUrl,
          });
        } catch (error) {
          console.error('Error uploading photo:', error);
          toast({
            title: 'Photo Upload Error',
            description: 'Draft created but photo upload failed. You can add a photo later.',
            variant: 'destructive',
          });
        }
      }
      
      setSpecDraftSection('list');
      setEditingSpecDraft(null);
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleSpecDraftUpdate = async (data: { name: string; description?: string; photoUrl?: string }) => {
    if (!editingSpecDraft) return;

    try {
      await updateSpecDraft(editingSpecDraft.id, {
        name: data.name,
        description: data.description,
        photo_url: data.photoUrl || null,
      });
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
    <SidebarProvider 
      className="min-h-screen"
      style={{background: 'linear-gradient(118deg, #FCFFFF -8.18%, #F0F1FF 53.14%, #FCFFFF 113.29%)'}}
    >
      <Sidebar 
        collapsible="icon" 
        className="border-r border-greyscale-blue-200 bg-ui-primary [&_[data-sidebar=sidebar]]:bg-ui-primary [&_[data-sidebar=sidebar]]:text-text-primary"
      >
        <SidebarHeader className="p-4 border-b border-greyscale-blue-200">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/profile')}
              className="bg-ui-primary border-greyscale-blue-200 text-text-primary hover:bg-greyscale-blue-150 h-9 px-3 py-2 rounded-[2px] font-brockmann-medium text-sm leading-5"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Profile
            </Button>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setActiveSection('actor-categories')}
                isActive={activeSection === 'actor-categories'}
                className="font-brockmann-semibold text-base leading-6 tracking-[0.32px] data-[active=true]:bg-transparent data-[active=true]:border-l-2 data-[active=true]:border-brand-primary data-[active=true]:text-brand-primary hover:bg-greyscale-blue-150"
              >
                <Users className="w-4 h-4" />
                <span>Actor Spec Categories</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setActiveSection('spec-drafts')}
                isActive={activeSection === 'spec-drafts'}
                className="font-brockmann-semibold text-base leading-6 tracking-[0.32px] data-[active=true]:bg-transparent data-[active=true]:border-l-2 data-[active=true]:border-brand-primary data-[active=true]:text-brand-primary hover:bg-greyscale-blue-150"
              >
                <Film className="w-4 h-4" />
                <span>Spec Draft Builder</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="flex flex-col">
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto px-6 py-6 max-w-7xl">
            <div className="space-y-6">

              {/* Actor Spec Categories Section */}
              {activeSection === 'actor-categories' && (
                <div className="space-y-6">
                  {actorCategorySection === 'form' ? (
                    <ActorSpecCategoryForm
                      category={editingCategory}
                      onSubmit={editingCategory ? handleUpdate : handleCreate}
                      onCancel={handleCancel}
                      loading={categoriesLoading}
                    />
                  ) : (
                    <ActorSpecCategoryList
                      categories={categories}
                      onEdit={handleEdit}
                      onDelete={deleteCategory}
                      onCreateNew={() => {
                        setEditingCategory(null);
                        setActorCategorySection('form');
                      }}
                      loading={categoriesLoading}
                    />
                  )}
                </div>
              )}

              {/* Spec Draft Builder Section */}
              {activeSection === 'spec-drafts' && (
                <>
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

              {/* Custom Categories Section */}
              <SpecDraftCategoriesManager
                specDraftId={managingMoviesForDraft.id}
                customCategories={managingMoviesForDraft.customCategories || []}
                onCreate={async (categoryName, description) => {
                  try {
                    await createCustomCategory(managingMoviesForDraft.id, categoryName, description);
                    // Wait a bit for the database to update, then refresh
                    await new Promise(resolve => setTimeout(resolve, 300));
                    await handleMovieManagerRefresh();
                  } catch (error) {
                    console.error('Error creating custom category:', error);
                  }
                }}
                onUpdate={async (id, updates) => {
                  try {
                    await updateCustomCategory(id, updates);
                    await new Promise(resolve => setTimeout(resolve, 300));
                    await handleMovieManagerRefresh();
                  } catch (error) {
                    console.error('Error updating custom category:', error);
                  }
                }}
                onDelete={async (id) => {
                  try {
                    await deleteCustomCategory(id);
                    await new Promise(resolve => setTimeout(resolve, 300));
                    await handleMovieManagerRefresh();
                  } catch (error) {
                    console.error('Error deleting custom category:', error);
                  }
                }}
                loading={specDraftsLoading}
              />

              {/* Movies Section */}
              <SpecDraftMovieManager
                specDraft={managingMoviesForDraft}
                onMovieAdded={handleMovieManagerRefresh}
                onMovieRemoved={handleMovieManagerRefresh}
                onCategoriesUpdated={handleMovieManagerRefresh}
                loading={specDraftsLoading}
              />
            </div>
          )}
                </>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Admin;

