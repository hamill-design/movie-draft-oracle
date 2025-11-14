import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Info } from 'lucide-react';

export const TMDBHelper = () => {
  return (
    <Card className="bg-blue-50 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Info className="w-5 h-5" />
          Finding TMDB Movie IDs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-blue-800">
          <p className="mb-2 font-medium">How to find TMDB Movie IDs:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Go to <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
              The Movie Database <ExternalLink className="w-3 h-3" />
            </a></li>
            <li>Search for the movie you want to add</li>
            <li>The ID is in the URL: <code className="bg-blue-100 px-1 rounded">https://www.themoviedb.org/movie/954</code> → ID is <strong>954</strong></li>
            <li>For franchises, search each movie individually and collect all IDs</li>
          </ol>
        </div>
        <div className="pt-2 border-t border-blue-200">
          <p className="text-xs text-blue-700">
            <strong>Tip:</strong> You can add multiple movie IDs by separating them with commas or adding them one at a time.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

