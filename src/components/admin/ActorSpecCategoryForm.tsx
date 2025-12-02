import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { usePeopleSearch } from '@/hooks/usePeopleSearch';
import { MovieSearchSelector } from './MovieSearchSelector';
import { ActorSpecCategory } from '@/hooks/useActorSpecCategoriesAdmin';
import { useToast } from '@/hooks/use-toast';

interface ActorSpecCategoryFormProps {
  category?: ActorSpecCategory | null;
  onSubmit: (data: {
    actorName: string;
    actorTmdbId: number | null;
    categoryName: string;
    movieTmdbIds: number[];
    description?: string;
  }) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
}

export const ActorSpecCategoryForm: React.FC<ActorSpecCategoryFormProps> = ({
  category,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [actorName, setActorName] = useState(category?.actor_name || '');
  const [actorTmdbId, setActorTmdbId] = useState<number | null>(category?.actor_tmdb_id || null);
  const [categoryName, setCategoryName] = useState(category?.category_name || '');
  const [movieIds, setMovieIds] = useState<number[]>(
    category?.movie_tmdb_ids || []
  );
  const [description, setDescription] = useState(category?.description || '');
  const [showActorSuggestions, setShowActorSuggestions] = useState(false);
  const [actorSearchQuery, setActorSearchQuery] = useState('');
  const actorInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { people, loading: peopleLoading } = usePeopleSearch(actorSearchQuery);

  // Update actor search when actor name changes
  useEffect(() => {
    if (actorName.length >= 2) {
      setActorSearchQuery(actorName);
    } else {
      setActorSearchQuery('');
    }
  }, [actorName]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        actorInputRef.current &&
        !actorInputRef.current.contains(event.target as Node)
      ) {
        setShowActorSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleActorSelect = (person: { id: number; name: string }) => {
    setActorName(person.name);
    setActorTmdbId(person.id);
    setShowActorSuggestions(false);
    setActorSearchQuery('');
  };

  const handleMoviesChange = (newMovieIds: number[]) => {
    setMovieIds(newMovieIds);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (!actorName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Actor name is required',
        variant: 'destructive',
      });
      return;
    }
    if (!categoryName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Category name is required',
        variant: 'destructive',
      });
      return;
    }

    if (movieIds.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'At least one movie is required',
        variant: 'destructive',
      });
      return;
    }

    await onSubmit({
      actorName: actorName.trim(),
      actorTmdbId,
      categoryName: categoryName.trim(),
      movieTmdbIds: movieIds,
      description: description.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {category ? 'Edit Actor Spec Category' : 'Create New Actor Spec Category'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Actor Name with Autocomplete */}
            <div className="space-y-2">
              <Label htmlFor="actor-name">Actor Name *</Label>
              <div className="relative">
                <Input
                  ref={actorInputRef}
                  id="actor-name"
                  value={actorName}
                  onChange={(e) => {
                    setActorName(e.target.value);
                    setShowActorSuggestions(true);
                  }}
                  onFocus={() => {
                    if (actorName.length >= 2) {
                      setShowActorSuggestions(true);
                    }
                  }}
                  placeholder="Start typing actor name..."
                  required
                />
                {showActorSuggestions && people.length > 0 && actorName.length >= 2 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-10 w-full mt-1 bg-ui-primary border border-greyscale-blue-300 rounded-md shadow-lg max-h-60 overflow-auto"
                  >
                    {peopleLoading && (
                      <div className="p-2 text-sm text-greyscale-blue-500">Searching...</div>
                    )}
                    {!peopleLoading && people.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => handleActorSelect(person)}
                        className="w-full text-left px-4 py-2 hover:bg-greyscale-blue-150 flex items-center gap-2"
                      >
                        <span className="font-medium text-text-primary">{person.name}</span>
                        {person.known_for_department && (
                          <span className="text-xs text-greyscale-blue-500">
                            ({person.known_for_department})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {actorTmdbId && (
                <p className="text-xs text-greyscale-blue-500">TMDB ID: {actorTmdbId}</p>
              )}
            </div>

            {/* Category Name */}
            <div className="space-y-2">
              <Label htmlFor="category-name">Category Name *</Label>
              <Input
                id="category-name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g., Mission Impossible"
                required
              />
            </div>

            {/* Movie Search and Selection */}
            <MovieSearchSelector
              selectedMovieIds={movieIds}
              onMoviesChange={handleMoviesChange}
              initialMovies={category?.movie_tmdb_ids?.map(id => ({
                id,
                title: `Movie ID: ${id}`, // Placeholder - will be replaced when searched
                year: 0,
              })) || []}
            />

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Movies from the Mission Impossible franchise"
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : category ? 'Update Category' : 'Create Category'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

