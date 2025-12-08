import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { usePeopleSearch } from '@/hooks/usePeopleSearch';
import { MovieSearchSelector } from './MovieSearchSelector';
import { User } from 'lucide-react';
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
  const [movieIds, setMovieIds] = useState<number[]>(
    category?.movie_tmdb_ids || []
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

  const handleMoviesChange = (newMovieIds: number[]) => {
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

    if (movieIds.length === 0) {
      alert('At least one movie is required');
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
    <div className="bg-greyscale-blue-100 rounded-[8px] shadow-[0px_0px_3px_0px_rgba(0,0,0,0.25)] p-6 space-y-6">
      {/* Header */}
      <div className="flex gap-2 items-center">
        <User className="w-6 h-6 text-brand-primary" />
        <h2 
          className="text-xl text-text-primary"
          style={{ fontFamily: 'Brockmann', fontWeight: 500, lineHeight: '28px' }}
        >
            {category ? 'Edit Actor Spec Category' : 'Create New Actor Spec Category'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
            {/* Actor Name with Autocomplete */}
            <div className="space-y-2">
          <Label 
            htmlFor="actor-name"
            className="text-sm text-greyscale-blue-800"
            style={{ fontFamily: 'Brockmann', fontWeight: 500, lineHeight: '20px' }}
          >
            Actor Name
          </Label>
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
              placeholder="Search Actor"
              className="h-12 px-4 py-3 border-greyscale-blue-400 rounded-[2px] text-sm"
              style={{ fontFamily: 'Brockmann', fontWeight: 500 }}
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
            <p 
              className="text-xs text-gray-500"
              style={{ fontFamily: 'Brockmann', fontWeight: 400, lineHeight: '16px' }}
            >
              TMDB ID: {actorTmdbId}
            </p>
              )}
            </div>

            {/* Category Name */}
            <div className="space-y-2">
          <Label 
            htmlFor="category-name"
            className="text-sm text-greyscale-blue-800"
            style={{ fontFamily: 'Brockmann', fontWeight: 500, lineHeight: '20px' }}
          >
            Category
          </Label>
              <Input
                id="category-name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
            placeholder="Name the Category"
            className="h-12 px-4 py-3 border-greyscale-blue-400 rounded-[2px] text-sm"
            style={{ fontFamily: 'Brockmann', fontWeight: 500 }}
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
          <Label 
            htmlFor="description"
            className="text-sm text-greyscale-blue-800"
            style={{ fontFamily: 'Brockmann', fontWeight: 500, lineHeight: '20px' }}
          >
            Description Optional
          </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Movies from the Mission Impossible franchise"
            className="px-4 py-3 border-greyscale-blue-400 rounded-[2px] text-sm min-h-[48px]"
            style={{ fontFamily: 'Brockmann', fontWeight: 500 }}
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              {onCancel && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel} 
              disabled={loading}
              className="h-12 px-6 py-3 border-greyscale-blue-200 rounded-[2px] bg-ui-primary"
              style={{ fontFamily: 'Brockmann', fontWeight: 600, fontSize: '16px', lineHeight: '24px', letterSpacing: '0.32px' }}
            >
                  Cancel
                </Button>
              )}
          <Button 
            type="submit" 
            disabled={loading}
            className="h-12 px-6 py-3 bg-brand-primary text-ui-primary hover:bg-brand-primary/90 rounded-[2px]"
            style={{ fontFamily: 'Brockmann', fontWeight: 600, fontSize: '16px', lineHeight: '24px', letterSpacing: '0.32px' }}
          >
                {loading ? 'Saving...' : category ? 'Update Category' : 'Create Category'}
              </Button>
            </div>
          </form>
    </div>
  );
};

