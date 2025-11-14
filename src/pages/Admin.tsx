import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useActorSpecCategoriesAdmin, ActorSpecCategory } from '@/hooks/useActorSpecCategoriesAdmin';
import { ActorSpecCategoryForm } from '@/components/admin/ActorSpecCategoryForm';
import { ActorSpecCategoryList } from '@/components/admin/ActorSpecCategoryList';
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
  const [activeTab, setActiveTab] = useState('list');

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
    }
  }, [isAdmin, fetchCategories]);

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
    setActiveTab('form');
  };

  const handleCancel = () => {
    setEditingCategory(null);
    setActiveTab('list');
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
        <p className="text-gray-600 mt-2">Manage Actor Spec Categories</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="list">All Categories</TabsTrigger>
          <TabsTrigger value="form">
            {editingCategory ? 'Edit Category' : 'Create New'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => {
              setEditingCategory(null);
              setActiveTab('form');
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
        </TabsContent>

        <TabsContent value="form">
          <ActorSpecCategoryForm
            category={editingCategory}
            onSubmit={editingCategory ? handleUpdate : handleCreate}
            onCancel={handleCancel}
            loading={categoriesLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;

