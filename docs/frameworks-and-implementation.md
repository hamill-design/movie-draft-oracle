# Frameworks and Implementation Details

## React Architecture

### Component Patterns

#### Functional Components with Hooks
```typescript
// Standard component pattern
const ComponentName: React.FC<Props> = ({ prop1, prop2 }) => {
  const [state, setState] = useState<Type>(initialValue);
  
  useEffect(() => {
    // Side effects
  }, [dependencies]);
  
  return <div>Component JSX</div>;
};
```

#### Custom Hooks Pattern
```typescript
// Business logic encapsulation
const useFeatureName = (params: Params) => {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  
  const fetchData = useCallback(async () => {
    // Implementation
  }, [dependencies]);
  
  return { data, loading, fetchData };
};
```

## Supabase Integration

### Database Patterns

#### RLS (Row Level Security)
```sql
-- Enable RLS on tables
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own data" ON table_name
  FOR SELECT USING (auth.uid() = user_id);
```

#### Database Functions
```sql
-- Custom PostgreSQL functions for complex operations
CREATE OR REPLACE FUNCTION function_name(params)
RETURNS return_type
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Function logic
  RETURN result;
END;
$$;
```

### Real-time Implementation

#### Supabase Channels
```typescript
const channel = supabase
  .channel('channel-name')
  .on('presence', { event: 'sync' }, (payload) => {
    // Handle presence changes
  })
  .on('broadcast', { event: 'event-name' }, (payload) => {
    // Handle broadcasts
  })
  .subscribe();
```

## TypeScript Implementation

### Type Definitions
```typescript
// Interface for props
interface ComponentProps {
  required: string;
  optional?: number;
  callback: (value: string) => void;
}

// Union types for variants
type Variant = 'primary' | 'secondary' | 'destructive';

// Generic types for reusability
interface ApiResponse<T> {
  data: T;
  error: string | null;
  loading: boolean;
}
```

## Component Library Integration

### Shadcn/UI Components
```typescript
// Component with variants
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
```