import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { usePeopleSearch } from '@/hooks/usePeopleSearch';
import { TMDBHelper } from './TMDBHelper';
import { X, Plus, Trash2 } from 'lucide-react';
import { ActorSpecCategory } from '@/hooks/useActorSpecCategoriesAdmin';

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
  const [movieIds, setMovieIds] = useState<string[]>(
    category?.movie_tmdb_ids?.map(String) || ['']
  );
  const [description, setDescription] = useState(category?.description || '');
  const [showActorSuggestions, setShowActorSuggestions] = useState(false);
  const [actorSearchQuery, setActorSearchQuery] = useState('');
  const actorInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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

  const handleAddMovieId = () => {
    setMovieIds([...movieIds, '']);
  };

  const handleRemoveMovieId = (index: number) => {
    setMovieIds(movieIds.filter((_, i) => i !== index));
  };

  const handleMovieIdChange = (index: number, value: string) => {
    const newMovieIds = [...movieIds];
    newMovieIds[index] = value;
    setMovieIds(newMovieIds);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (!actorName.trim()) {
      alert('Actor name is required');
      return;
    }
    if (!categoryName.trim()) {
      alert('Category name is required');
      return;
    }

    const validMovieIds = movieIds
      .map(id => id.trim())
      .filter(id => id.length > 0)
      .map(id => parseInt(id, 10))
      .filter(id => !isNaN(id) && id > 0);

    if (validMovieIds.length === 0) {
      alert('At least one valid movie ID is required');
      return;
    }

    await onSubmit({
      actorName: actorName.trim(),
      actorTmdbId,
      categoryName: categoryName.trim(),
      movieTmdbIds: validMovieIds,
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
                    className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
                  >
                    {peopleLoading && (
                      <div className="p-2 text-sm text-gray-500">Searching...</div>
                    )}
                    {!peopleLoading && people.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => handleActorSelect(person)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <span className="font-medium">{person.name}</span>
                        {person.known_for_department && (
                          <span className="text-xs text-gray-500">
                            ({person.known_for_department})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {actorTmdbId && (
                <p className="text-xs text-gray-500">TMDB ID: {actorTmdbId}</p>
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

            {/* Movie IDs */}
            <div className="space-y-2">
              <Label>Movie TMDB IDs *</Label>
              <div className="space-y-2">
                {movieIds.map((id, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="number"
                      value={id}
                      onChange={(e) => handleMovieIdChange(index, e.target.value)}
                      placeholder="Enter TMDB movie ID"
                      min="1"
                    />
                    {movieIds.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleRemoveMovieId(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddMovieId}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Another Movie ID
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Current: {movieIds.filter(id => id.trim()).length} movie ID(s)
              </p>
            </div>

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

      <TMDBHelper />
    </div>
  );
};

