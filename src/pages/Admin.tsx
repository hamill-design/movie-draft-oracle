
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SidebarProvider,
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
import { Loader2, ArrowLeft } from 'lucide-react';
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
        const draftId = typeof newDraft === 'object' && newDraft !== null && 'id' in newDraft 
          ? (newDraft as SpecDraft).id 
          : null;
        
        if (draftId) {
        const { uploadSpecDraftPhoto } = await import('@/utils/specDraftPhotoUpload');
        try {
            const photoUrl = await uploadSpecDraftPhoto(draftId, data.photoFile);
          // Update the draft with the photo URL
            await updateSpecDraft(draftId, {
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
      }
      
      // Refresh the spec drafts list to ensure it has the latest data
      await fetchSpecDrafts();
      setSpecDraftSection('list');
      setEditingSpecDraft(null);
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleSpecDraftUpdate = async (data: { name: string; description?: string; photoUrl?: string }) => {
    if (!editingSpecDraft) return;

    console.log('💾 Updating spec draft:', {
      id: editingSpecDraft.id,
      photoUrl: data.photoUrl,
    });

    try {
      const result = await updateSpecDraft(editingSpecDraft.id, {
        name: data.name,
        description: data.description,
        photo_url: data.photoUrl || null,
      });
      console.log('✅ Update result:', result);
      
      // Refresh the spec drafts list to ensure it has the latest data
      await fetchSpecDrafts();
      setSpecDraftSection('list');
      setEditingSpecDraft(null);
    } catch (error) {
      console.error('❌ Error updating spec draft:', error);
      // Error already handled in hook
    }
  };

  const handleSpecDraftEdit = async (specDraft: SpecDraft) => {
    // Refetch the spec draft to ensure we have the latest data, including photo_url
    try {
      const freshDraft = await fetchSpecDraftWithMovies(specDraft.id);
      if (freshDraft) {
        // Extract just the spec draft part (without movies)
        const { movies, ...draftData } = freshDraft;
        setEditingSpecDraft(draftData);
      } else {
        // Fallback to the draft from the list if refetch fails
        setEditingSpecDraft(specDraft);
      }
    } catch (error) {
      console.error('Error fetching spec draft for edit:', error);
      // Fallback to the draft from the list if refetch fails
    setEditingSpecDraft(specDraft);
    }
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
      <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" style={{color: 'var(--Text-Primary, #FCFFFF)'}} />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Will redirect
  }

  return (
    <SidebarProvider 
      className="flex flex-col min-h-full"
      style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}
    >
      <SidebarInset className="flex flex-col bg-transparent flex-1">
        <div className="flex-1">
          <div className="container mx-auto px-6 py-6 max-w-7xl">
            <div className="flex gap-6">
              {/* Sidebar Navigation - Inside Container - Matching Figma */}
              <div className="flex flex-col justify-start items-start gap-6">
                {/* Menu Items Container - width 206px, gap 4px */}
                <div className="w-[206px] flex flex-col justify-start items-start gap-1">
                  {/* Actor Spec Categories */}
                  <button
                    onClick={() => setActiveSection('actor-categories')}
                    className={`self-stretch px-3 py-1.5 flex justify-start items-center border-l-2 ${
                      activeSection === 'actor-categories'
                        ? 'border-purple-300'
                        : 'border-transparent'
                    }`}
                    style={{
                      fontFamily: 'Brockmann',
                      fontWeight: 600
                    }}
                  >
                    <span className={`text-left whitespace-nowrap ${
                      activeSection === 'actor-categories'
                        ? 'text-purple-300'
                        : 'text-greyscale-blue-100'
                    } text-base leading-6 tracking-[0.32px]`}
                    >
                      Actor Spec Categories
                    </span>
                  </button>

                  {/* Spec Draft Builder */}
                  <button
                    onClick={() => setActiveSection('spec-drafts')}
                    className={`self-stretch px-3 py-1.5 flex justify-start items-center border-l-2 ${
                      activeSection === 'spec-drafts'
                        ? 'border-purple-300'
                        : 'border-transparent'
                    }`}
                    style={{
                      fontFamily: 'Brockmann',
                      fontWeight: 600
                    }}
                  >
                    <span className={`text-left whitespace-nowrap ${
                      activeSection === 'spec-drafts'
                        ? 'text-purple-300'
                        : 'text-greyscale-blue-100'
                    } text-base leading-6 tracking-[0.32px]`}
                    >
                      Spec Draft Builder
                    </span>
                  </button>
      </div>
              </div>

              {/* Main Content - Inside Container */}
              <div className="flex-1 space-y-6">
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
              <SpecDraftList
                specDrafts={specDrafts}
                onEdit={handleSpecDraftEdit}
                onDelete={handleSpecDraftDelete}
                onManageMovies={handleManageMovies}
                                  onCreateNew={() => {
                                    setEditingSpecDraft(null);
                                    setSpecDraftSection('form');
                                  }}
                loading={specDraftsLoading}
              />
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
                                  {/* Admin Draft Header */}
                                  <div className="flex gap-6 items-start">
                                    <button
                  onClick={() => {
                    setManagingMoviesForDraft(null);
                    setSpecDraftSection('list');
                  }}
                                      className="p-3 rounded-[2px] hover:bg-greyscale-blue-200 transition-colors shrink-0"
                                      title="Back to List"
                                    >
                                      <ArrowLeft className="w-6 h-6 text-text-primary" />
                                    </button>
                                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                                      <h2
                                        className="text-[48px] text-greyscale-blue-100 uppercase"
                                        style={{ 
                                          fontFamily: 'CHANEY', 
                                          fontWeight: 400, 
                                          lineHeight: '50px',
                                          letterSpacing: '0.64px'
                                        }}
                                      >
                                        {managingMoviesForDraft.name.toUpperCase()}
                                      </h2>
                                      {managingMoviesForDraft.description && (
                                        <p
                                          className="text-xl text-gray-600"
                                          style={{ 
                                            fontFamily: 'Brockmann', 
                                            fontWeight: 500, 
                                            lineHeight: '28px'
                                          }}
                                        >
                                          {managingMoviesForDraft.description}
                                        </p>
                                      )}
                                    </div>
              </div>

              {/* Custom Categories Section */}
              <SpecDraftCategoriesManager
                specDraftId={managingMoviesForDraft.id}
                customCategories={managingMoviesForDraft.customCategories || []}
                onCreate={async (categoryName, description) => {
                  try {
                    await createCustomCategory(managingMoviesForDraft.id, categoryName, description);
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
    </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Admin;

