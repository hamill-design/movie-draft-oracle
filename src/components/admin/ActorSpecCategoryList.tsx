import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Edit2, Trash2, Search } from 'lucide-react';
import { ActorSpecCategory } from '@/hooks/useActorSpecCategoriesAdmin';

interface ActorSpecCategoryListProps {
  categories: ActorSpecCategory[];
  onEdit: (category: ActorSpecCategory) => void;
  onDelete: (id: string) => Promise<void>;
  loading?: boolean;
}

export const ActorSpecCategoryList: React.FC<ActorSpecCategoryListProps> = ({
  categories,
  onEdit,
  onDelete,
  loading = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<ActorSpecCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredCategories = categories.filter(cat => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      cat.actor_name.toLowerCase().includes(query) ||
      cat.category_name.toLowerCase().includes(query) ||
      (cat.description?.toLowerCase().includes(query) ?? false)
    );
  });

  // Group categories by actor
  const groupedByActor = filteredCategories.reduce((acc, category) => {
    const actorKey = `${category.actor_name}_${category.actor_tmdb_id || 'no-id'}`;
    if (!acc[actorKey]) {
      acc[actorKey] = {
        actor_name: category.actor_name,
        actor_tmdb_id: category.actor_tmdb_id,
        categories: [],
      };
    }
    acc[actorKey].categories.push(category);
    return acc;
  }, {} as Record<string, { actor_name: string; actor_tmdb_id: number | null; categories: ActorSpecCategory[] }>);

  const groupedArray = Object.values(groupedByActor).sort((a, b) =>
    a.actor_name.localeCompare(b.actor_name)
  );

  const handleDeleteClick = (category: ActorSpecCategory) => {
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;
    
    setDeleting(true);
    try {
      await onDelete(categoryToDelete.id);
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
    } catch (error) {
      console.error('Failed to delete category:', error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading && categories.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Loading categories...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Actor Spec Categories ({categories.length})</CardTitle>
            <div className="flex items-center gap-2 w-64">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {groupedArray.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery ? 'No categories match your search' : 'No categories found'}
            </div>
          ) : (
            <div className="space-y-6">
              {groupedArray.map((group) => (
                <div key={`${group.actor_name}_${group.actor_tmdb_id || 'no-id'}`} className="space-y-2">
                  {/* Actor Header */}
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {group.actor_name}
                    </h3>
                    {group.actor_tmdb_id && (
                      <span className="text-sm text-gray-500">
                        (ID: {group.actor_tmdb_id})
                      </span>
                    )}
                    <span className="text-sm text-gray-400">
                      {group.categories.length} {group.categories.length === 1 ? 'category' : 'categories'}
                    </span>
                  </div>

                  {/* Categories Table */}
                  <div className="overflow-x-auto">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[25%]">Category Name</TableHead>
                          <TableHead className="w-[15%]">Movie Count</TableHead>
                          <TableHead className="w-[45%]">Description</TableHead>
                          <TableHead className="w-[15%] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.categories.map((category) => (
                          <TableRow key={category.id}>
                            <TableCell className="font-medium w-[25%]">
                              {category.category_name}
                            </TableCell>
                            <TableCell className="w-[15%]">
                              <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-sm">
                                {category.movie_tmdb_ids?.length || 0} movies
                              </span>
                            </TableCell>
                            <TableCell className="w-[45%]">
                              <div className="truncate" title={category.description || undefined}>
                                {category.description || '-'}
                              </div>
                            </TableCell>
                            <TableCell className="w-[15%] text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => onEdit(category)}
                                  disabled={loading}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleDeleteClick(category)}
                                  disabled={loading}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the category &quot;{categoryToDelete?.category_name}&quot; for {categoryToDelete?.actor_name}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

