import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Person {
  id: number;
  name: string;
  known_for_department: string;
  profile_path: string | null;
  known_for: any[];
}

export const usePeopleSearch = (searchQuery?: string) => {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPeople = async () => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setPeople([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('usePeopleSearch - Searching for people:', searchQuery);
      
      const requestBody = {
        searchQuery: searchQuery.trim(),
        searchType: 'person'
      };
      
      console.log('usePeopleSearch - Request body:', requestBody);
      
      const { data, error } = await supabase.functions.invoke('search-people', {
        body: requestBody
      });

      if (error) {
        console.error('usePeopleSearch - Supabase function error:', error);
        throw error;
      }

      const fetchedPeople = data?.results || [];
      console.log('usePeopleSearch - Received people:', fetchedPeople.length);
      
      setPeople(fetchedPeople);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search people');
      console.error('usePeopleSearch - Error searching people:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery && searchQuery.trim().length >= 2) {
      console.log('usePeopleSearch - Effect triggered, searchQuery:', searchQuery);
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