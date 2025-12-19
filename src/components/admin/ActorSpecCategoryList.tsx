import React, { useState } from 'react';
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
  onCreateNew?: () => void;
  loading?: boolean;
}

export const ActorSpecCategoryList: React.FC<ActorSpecCategoryListProps> = ({
  categories,
  onEdit,
  onDelete,
  onCreateNew,
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
      <div className="bg-greyscale-blue-100 rounded-[8px] shadow-[0px_0px_3px_0px_rgba(0,0,0,0.25)] p-6">
        <div className="text-center text-greyscale-blue-600 font-brockmann-regular text-sm leading-5">
          Loading categories...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-greyscale-blue-100 rounded-[8px] shadow-[0px_0px_3px_0px_rgba(0,0,0,0.25)] p-6 space-y-6">
        {/* Search and Create Button Section */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex-1 min-w-0 sm:min-w-[294px]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-greyscale-blue-400 pointer-events-none" />
                <Input
                placeholder="Search for actors, directors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 border-greyscale-blue-400 text-sm font-brockmann-medium leading-5 placeholder:text-greyscale-blue-400"
                />
            </div>
          </div>
          {onCreateNew && (
            <Button
              onClick={onCreateNew}
              className="bg-brand-primary text-ui-primary hover:bg-brand-primary/90 h-12 px-6 py-3 rounded-[2px] font-brockmann-semibold text-base leading-6 tracking-[0.32px] whitespace-nowrap"
            >
              Create New Category
            </Button>
          )}
        </div>

        {/* Categories List */}
          {groupedArray.length === 0 ? (
          <div className="text-center py-8 text-greyscale-blue-600 font-brockmann-regular text-sm leading-5">
              {searchQuery ? 'No categories match your search' : 'No categories found'}
            </div>
          ) : (
            <div className="space-y-6">
            {groupedArray.map((group, groupIndex) => (
              <div key={`${group.actor_name}_${group.actor_tmdb_id || 'no-id'}`} className="space-y-0">
                {/* Actor Header with Purple Background */}
                <div className="bg-purple-100 px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 
                      className="text-base text-text-primary leading-6 tracking-[0.32px]"
                      style={{ fontFamily: 'Brockmann', fontWeight: 600 }}
                    >
                      {group.actor_name}
                    </h3>
                    {group.actor_tmdb_id && (
                      <span 
                        className="text-sm text-greyscale-blue-600 leading-5"
                        style={{ fontFamily: 'Brockmann', fontWeight: 400 }}
                      >
                        (ID: {group.actor_tmdb_id})
                      </span>
                    )}
                  </div>
                  <div 
                    className="text-sm text-greyscale-blue-600 leading-5"
                    style={{ fontFamily: 'Brockmann', fontWeight: 400 }}
                  >
                      {group.categories.length} {group.categories.length === 1 ? 'category' : 'categories'}
                  </div>
                  </div>

                  {/* Categories Table */}
                  <div className="overflow-x-auto">
                    <Table className="w-full">
                      <TableHeader>
                      <TableRow className="border-b border-greyscale-blue-300 hover:bg-transparent">
                        <TableHead 
                          className="px-4 py-3 text-sm text-greyscale-blue-600 leading-5"
                          style={{ fontFamily: 'Brockmann', fontWeight: 400 }}
                        >
                          Category Name
                        </TableHead>
                        <TableHead 
                          className="px-4 py-3 text-sm text-greyscale-blue-600 leading-5"
                          style={{ fontFamily: 'Brockmann', fontWeight: 400 }}
                        >
                          Movie Count
                        </TableHead>
                        <TableHead 
                          className="px-4 py-3 text-sm text-greyscale-blue-600 leading-5"
                          style={{ fontFamily: 'Brockmann', fontWeight: 400 }}
                        >
                          Description
                        </TableHead>
                        <TableHead 
                          className="px-4 py-3 text-sm text-greyscale-blue-600 leading-5 text-right"
                          style={{ fontFamily: 'Brockmann', fontWeight: 400 }}
                        >
                          Actions
                        </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                      {group.categories.map((category, index) => (
                        <TableRow
                          key={category.id}
                          className={`${
                            index % 2 === 0 
                              ? 'bg-greyscale-blue-150 hover:bg-greyscale-blue-150' 
                              : 'bg-transparent hover:bg-transparent'
                          } border-0`}
                        >
                          <TableCell 
                            className="px-4 py-3 text-sm text-text-primary leading-5"
                            style={{ fontFamily: 'Brockmann', fontWeight: 500 }}
                          >
                              {category.category_name}
                            </TableCell>
                          <TableCell 
                            className="px-4 py-3 text-sm text-text-primary leading-5"
                            style={{ fontFamily: 'Brockmann', fontWeight: 500 }}
                          >
                            {category.movie_tmdb_ids?.length || 0}
                            </TableCell>
                          <TableCell 
                            className="px-4 py-3 text-sm text-text-primary leading-5"
                            style={{ fontFamily: 'Brockmann', fontWeight: 500 }}
                          >
                                {category.description || '-'}
                            </TableCell>
                          <TableCell className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                variant="ghost"
                                  size="icon"
                                  onClick={() => onEdit(category)}
                                  disabled={loading}
                                className="h-8 w-8 p-2 hover:bg-greyscale-blue-200"
                                >
                                <Edit2 className="w-4 h-4 text-text-primary" />
                                </Button>
                                <Button
                                variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteClick(category)}
                                  disabled={loading}
                                className="h-8 w-8 p-2 hover:bg-greyscale-blue-200"
                                >
                                <Trash2 className="w-4 h-4 text-text-primary" />
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
      </div>

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
              className="bg-error-red-500 hover:bg-error-red-600"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

