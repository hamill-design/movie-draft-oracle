# Frameworks and Implementation Guide

## Architecture Overview

The Movie Draft Game follows a modern full-stack architecture with clear separation of concerns and scalable patterns.

### Frontend Architecture

#### Component Structure
```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui base components
│   ├── ads/            # Advertisement components
│   └── [feature]/      # Feature-specific components
├── hooks/              # Custom React hooks
├── pages/              # Route components
├── lib/                # Utility functions
├── integrations/       # External service integrations
└── utils/              # Helper functions
```

#### State Management Strategy
- **Local State**: React useState for component-specific state
- **Server State**: TanStack Query for API data
- **Global State**: React Context for authentication and themes
- **Form State**: React Hook Form for complex forms

### Backend Architecture

#### Supabase Integration
```
Database Layer (PostgreSQL)
├── Tables with RLS policies
├── Database functions
├── Triggers for automation
└── Real-time subscriptions

API Layer (Supabase)
├── Auto-generated REST API
├── Real-time WebSocket API
├── Authentication endpoints
└── Edge Functions
```

#### Data Flow Patterns
1. **User Action** → Component
2. **Component** → Custom Hook
3. **Hook** → Supabase Client
4. **Supabase** → Database/API
5. **Response** → Hook → Component → UI Update

## Implementation Patterns

### Custom Hooks Pattern

#### Data Fetching Hooks
```typescript
// Pattern for API data fetching
export const useMovies = (theme: string, option: string) => {
  return useQuery({
    queryKey: ['movies', theme, option],
    queryFn: () => fetchMovies(theme, option),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!theme && !!option
  });
};
```

#### Business Logic Hooks
```typescript
// Pattern for complex business logic
export const useDraftGame = (draftId?: string) => {
  const [draft, setDraft] = useState(null);
  const [participants, setParticipants] = useState([]);
  
  const createDraft = useCallback(async (data) => {
    // Implementation
  }, []);
  
  return {
    draft,
    participants,
    createDraft,
    loading
  };
};
```

### Component Patterns

#### Compound Components
```typescript
// Draft interface with sub-components
export const DraftInterface = ({ children }) => {
  return <div className="draft-interface">{children}</div>;
};

DraftInterface.Header = DraftHeader;
DraftInterface.Board = DraftBoard;
DraftInterface.MovieSearch = MovieSearch;
```

#### Render Props Pattern
```typescript
// Flexible component composition
export const DraftProvider = ({ children }) => {
  const draftState = useDraftGame();
  
  return (
    <DraftContext.Provider value={draftState}>
      {typeof children === 'function' ? children(draftState) : children}
    </DraftContext.Provider>
  );
};
```

### Error Handling Patterns

#### Component Error Boundaries
```typescript
export class DraftErrorBoundary extends Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Draft error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

#### Async Error Handling
```typescript
const handleAsyncOperation = async () => {
  try {
    setLoading(true);
    const result = await riskyOperation();
    setData(result);
  } catch (error) {
    console.error('Operation failed:', error);
    toast.error('Operation failed. Please try again.');
  } finally {
    setLoading(false);
  }
};
```

## Database Patterns

### Row Level Security (RLS)
```sql
-- Pattern for user-specific data access
CREATE POLICY "Users can view their own drafts" 
ON public.drafts 
FOR SELECT 
USING (auth.uid() = user_id OR guest_session_id = current_guest_session());
```

### Database Functions
```sql
-- Pattern for complex business logic
CREATE OR REPLACE FUNCTION public.create_multiplayer_draft(
  p_title text,
  p_theme text,
  p_categories text[]
) RETURNS uuid AS $$
DECLARE
  v_draft_id uuid;
BEGIN
  -- Validation
  IF p_title IS NULL THEN
    RAISE EXCEPTION 'Title is required';
  END IF;
  
  -- Business logic
  INSERT INTO public.drafts (title, theme, categories)
  VALUES (p_title, p_theme, p_categories)
  RETURNING id INTO v_draft_id;
  
  RETURN v_draft_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Real-time Implementation

### Supabase Subscriptions
```typescript
useEffect(() => {
  const channel = supabase
    .channel(`draft-${draftId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'draft_picks'
    }, (payload) => {
      // Handle new pick
      setPicks(prev => [...prev, payload.new]);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [draftId]);
```

### Optimistic Updates
```typescript
const makePick = async (movieId, category) => {
  // Optimistic update
  const optimisticPick = {
    id: 'temp-' + Date.now(),
    movie_id: movieId,
    category,
    player_id: currentUser.id
  };
  setPicks(prev => [...prev, optimisticPick]);
  
  try {
    const result = await supabase.rpc('make_pick', {
      p_draft_id: draftId,
      p_movie_id: movieId,
      p_category: category
    });
    
    // Replace optimistic update with real data
    setPicks(prev => prev.map(pick => 
      pick.id === optimisticPick.id ? result : pick
    ));
  } catch (error) {
    // Rollback optimistic update
    setPicks(prev => prev.filter(pick => pick.id !== optimisticPick.id));
    throw error;
  }
};
```

## Performance Optimization

### React Optimization
```typescript
// Memoization patterns
const ExpensiveComponent = React.memo(({ data, onAction }) => {
  const processedData = useMemo(() => {
    return expensiveProcessing(data);
  }, [data]);
  
  const handleAction = useCallback((id) => {
    onAction(id);
  }, [onAction]);
  
  return <div>{/* Component content */}</div>;
});
```

### Database Optimization
```sql
-- Indexing strategy
CREATE INDEX idx_drafts_user_id ON public.drafts(user_id);
CREATE INDEX idx_draft_picks_draft_id ON public.draft_picks(draft_id);
CREATE INDEX idx_draft_participants_draft_id ON public.draft_participants(draft_id);
```

## Testing Patterns

### Component Testing
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const renderWithProviders = (component) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

test('draft creation flow', async () => {
  renderWithProviders(<DraftCreation />);
  
  fireEvent.change(screen.getByLabelText('Draft Title'), {
    target: { value: 'Test Draft' }
  });
  
  fireEvent.click(screen.getByText('Create Draft'));
  
  await screen.findByText('Draft created successfully');
});
```

### Integration Testing
```typescript
// Test database functions
test('join_draft_by_invite_code function', async () => {
  const { data, error } = await supabase.rpc('join_draft_by_invite_code', {
    invite_code_param: 'TEST1234',
    participant_name_param: 'Test User'
  });
  
  expect(error).toBeNull();
  expect(data).toBeDefined();
});
```

## Deployment Patterns

### Environment Configuration
```typescript
// Environment-specific configuration
const config = {
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY
  },
  apis: {
    tmdb: process.env.TMDB_API_KEY,
    omdb: process.env.OMDB_API_KEY
  }
};
```

### CI/CD Pipeline
1. **Code Push** → GitHub
2. **Build Trigger** → Vercel/Lovable
3. **Type Check** → TypeScript validation
4. **Build** → Vite compilation
5. **Deploy** → Production environment
6. **Database Migration** → Supabase updates