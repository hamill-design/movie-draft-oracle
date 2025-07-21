
import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActorPortraitProps {
  profilePath?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12', 
  lg: 'h-24 w-24'
};

const sizeImagePath = {
  sm: 'w185',
  md: 'w500',
  lg: 'w500'
};

export const ActorPortrait: React.FC<ActorPortraitProps> = ({
  profilePath,
  name,
  size = 'md',
  className
}) => {
  const imageUrl = profilePath 
    ? `${TMDB_IMAGE_BASE_URL}${sizeImagePath[size]}${profilePath}`
    : undefined;

  const initials = name
    ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : '';

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {imageUrl && (
        <AvatarImage 
          src={imageUrl} 
          alt={name || 'Actor portrait'}
          className="object-cover"
        />
      )}
      <AvatarFallback className="bg-muted text-muted-foreground">
        {initials || <User size={size === 'sm' ? 12 : size === 'md' ? 16 : 24} />}
      </AvatarFallback>
    </Avatar>
  );
};
