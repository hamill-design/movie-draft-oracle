# Implementation Guide - Movie Draft App

## Project Structure
```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Shadcn/ui base components  
│   └── *.tsx           # Feature components
├── hooks/              # Custom React hooks
├── pages/              # Route components
├── contexts/           # React context providers
├── utils/              # Utility functions
└── integrations/       # External service integrations
```

## Code Patterns

### Component Structure
```tsx
interface ComponentProps {
  data: DataType;
  onAction: (id: string) => void;
  variant?: 'primary' | 'secondary';
}

export const Component: React.FC<ComponentProps> = ({
  data,
  onAction,
  variant = 'primary'
}) => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  
  const handleClick = useCallback((id: string) => {
    onAction(id);
  }, [onAction]);
  
  return (
    <div className={cn('base-styles', variants[variant])}>
      {/* Component JSX */}
    </div>
  );
};
```

### Custom Hooks
```tsx
export const useMovies = (category: string) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    // Fetch movies logic
  }, [category]);
  
  return { movies, loading };
};
```

### Supabase Integration
- Use Row Level Security for data access
- Implement real-time subscriptions for live updates
- Handle both authenticated users and guest sessions
- Use maybeSingle() instead of single() to avoid errors

## Performance
- Component memoization with React.memo
- Lazy loading for routes
- Efficient database queries
- Real-time subscription optimization