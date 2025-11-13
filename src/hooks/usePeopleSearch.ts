import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Person {
  id: number;
  name: string;
  known_for_department: string;
  profile_path: string | null;
  known_for: any[];
}

// In-memory cache for people search results (persists for session duration)
const peopleCache = new Map<string, Person[]>();

export const usePeopleSearch = (searchQuery?: string) => {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPeople = async () => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setPeople([]);
      return;
    }
    
    const trimmedQuery = searchQuery.trim().toLowerCase();
    
    // Check cache first
    if (peopleCache.has(trimmedQuery)) {
      setPeople(peopleCache.get(trimmedQuery)!);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const requestBody = {
        searchQuery: searchQuery.trim(),
        searchType: 'person'
      };
      
      const { data, error } = await supabase.functions.invoke('search-people', {
        body: requestBody
      });

      if (error) {
        throw error;
      }

      const fetchedPeople = data?.results || [];
      
      // Store in cache
      peopleCache.set(trimmedQuery, fetchedPeople);
      
      setPeople(fetchedPeople);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search people');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery && searchQuery.trim().length >= 2) {
      const trimmedQuery = searchQuery.trim().toLowerCase();
      
      // Check cache immediately
      if (peopleCache.has(trimmedQuery)) {
        setPeople(peopleCache.get(trimmedQuery)!);
        return;
      }
      
      const timeoutId = setTimeout(() => {
        fetchPeople();
      }, 300); // Debounce the search
      
      return () => clearTimeout(timeoutId);
    } else {
      setPeople([]);
    }
  }, [searchQuery]);

  return {
    people,
    loading,
    error,
    refetch: fetchPeople
  };
};