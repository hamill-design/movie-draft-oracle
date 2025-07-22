import React from 'react';
import { usePeopleSearch } from '@/hooks/usePeopleSearch';
import { ActorPortrait } from './ActorPortrait';
import { User } from 'lucide-react';
import { getCleanActorName } from '@/lib/utils';

interface DraftActorPortraitProps {
  actorName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const DraftActorPortrait: React.FC<DraftActorPortraitProps> = ({
  actorName,
  size = 'md',
  className
}) => {
  const cleanActorName = getCleanActorName(actorName);
  const { people, loading } = usePeopleSearch(cleanActorName);
  
  console.log('DraftActorPortrait - Actor name:', actorName);
  console.log('DraftActorPortrait - Clean actor name:', cleanActorName);
  console.log('DraftActorPortrait - People found:', people);
  console.log('DraftActorPortrait - Loading:', loading);
  
  // Find the exact match for the actor name
  const actor = people.find(person => 
    person.name.toLowerCase() === cleanActorName.toLowerCase()
  );

  console.log('DraftActorPortrait - Matched actor:', actor);

  if (loading) {
    return (
      <div className={`bg-gray-600 rounded-full flex items-center justify-center ${
        size === 'sm' ? 'h-8 w-8' : size === 'md' ? 'h-12 w-12' : 'h-16 w-16'
      } ${className}`}>
        <User size={size === 'sm' ? 12 : size === 'md' ? 16 : 20} className="text-gray-400" />
      </div>
    );
  }

  return (
    <ActorPortrait
      profilePath={actor?.profile_path || null}
      name={cleanActorName}
      size={size}
      className={className}
    />
  );
};
