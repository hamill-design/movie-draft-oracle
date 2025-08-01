# Frameworks and Implementation Guide

## Frontend Framework: React 18

### Core Architecture
```typescript
// Component Structure
src/
├── components/
│   ├── atoms/           # Basic building blocks
│   ├── molecules/       # Simple component combinations
│   ├── organisms/       # Complex component assemblies
│   └── templates/       # Page layout templates
├── pages/              # Route components
├── hooks/              # Custom React hooks
├── contexts/           # React context providers
├── utils/              # Utility functions
└── integrations/       # External service integrations
```

### React Patterns and Best Practices

#### Component Design
```typescript
// Functional components with TypeScript
interface ComponentProps {
  title: string;
  optional?: boolean;
}

export const MyComponent: React.FC<ComponentProps> = ({ 
  title, 
  optional = false 
}) => {
  // Component logic
  return <div>{title}</div>;
};
```

#### State Management
```typescript
// Local state with useState
const [state, setState] = useState<StateType>(initialValue);

// Side effects with useEffect
useEffect(() => {
  // Effect logic
  return () => {
    // Cleanup
  };
}, [dependencies]);

// Context for shared state
const AppContext = createContext<AppContextType | undefined>(undefined);
```

#### Custom Hooks Pattern
```typescript
// Custom hooks for reusable logic
export const useCustomHook = (param: string) => {
  const [data, setData] = useState<DataType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hook logic
  
  return { data, loading, error };
};
```

## Styling Framework: Tailwind CSS

### Design System Implementation
```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        // Semantic color tokens
        'brand-primary': 'hsl(var(--brand-primary))',
        'purple-200': 'hsl(var(--purple-200))',
      },
      fontFamily: {
        'brockmann-medium': ['brockmann-medium', 'serif'],
      },
    },
  },
} satisfies Config;
```

### Component Styling Patterns
```typescript
// Using Class Variance Authority (CVA)
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center", // base styles
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        outline: "border border-input bg-background",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

## UI Component Library: Radix UI + Shadcn/ui

### Component Implementation Pattern
```typescript
// Base component using Radix primitives
import * as RadixPrimitive from "@radix-ui/react-primitive";

const Component = React.forwardRef<
  React.ElementRef<typeof RadixPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadixPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadixPrimitive.Root
    ref={ref}
    className={cn("base-styles", className)}
    {...props}
  />
));
```

### Accessible Component Features
- **Keyboard Navigation**: Built-in keyboard support
- **Screen Reader Support**: Proper ARIA attributes
- **Focus Management**: Automatic focus handling
- **Customizable**: Style with Tailwind while maintaining accessibility

## Backend Framework: Supabase

### Database Schema Design
```sql
-- Example table with RLS
CREATE TABLE public.drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;

-- Create policy for user access
CREATE POLICY "Users can view their own drafts" 
ON public.drafts 
FOR SELECT 
USING (auth.uid() = user_id);
```

### Real-time Subscriptions
```typescript
// Subscribe to real-time changes
const subscription = supabase
  .channel('draft-updates')
  .on('postgres_changes', 
    { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'drafts' 
    }, 
    (payload) => {
      // Handle real-time update
      console.log('Draft updated:', payload.new);
    }
  )
  .subscribe();
```

### Edge Functions
```typescript
// Deno edge function example
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const { name } = await req.json();
  
  // Function logic
  
  return new Response(
    JSON.stringify({ message: `Hello ${name}!` }),
    { headers: { "Content-Type": "application/json" } },
  );
});
```

## State Management: React Query

### Data Fetching Patterns
```typescript
// Query hook
export const useDrafts = () => {
  return useQuery({
    queryKey: ['drafts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drafts')
        .select('*');
      
      if (error) throw error;
      return data;
    },
  });
};

// Mutation hook
export const useCreateDraft = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (draft: DraftInput) => {
      const { data, error } = await supabase
        .from('drafts')
        .insert(draft)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });
};
```

### Caching Strategy
```typescript
// Query client configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000,   // 10 minutes
      retry: (failureCount, error) => {
        if (error.status === 404) return false;
        return failureCount < 3;
      },
    },
  },
});
```

## Form Management: React Hook Form + Zod

### Form Implementation Pattern
```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Schema definition
const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type FormData = z.infer<typeof formSchema>;

// Form component
export const MyForm = () => {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: FormData) => {
    // Handle form submission
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  );
};
```

## Routing: React Router

### Route Configuration
```typescript
// Main router setup
const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "drafts/:id",
        element: <DraftDetail />,
      },
      {
        path: "profile",
        element: <Profile />,
      },
    ],
  },
]);

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/auth" replace />;
  
  return <>{children}</>;
};
```

## Build Tool: Vite

### Configuration
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
        },
      },
    },
  },
});
```

## Development Workflow

### Code Organization Principles
1. **Separation of Concerns**: UI, business logic, and data access layers
2. **Reusability**: Shared components and utilities
3. **Type Safety**: Full TypeScript coverage
4. **Testing**: Unit tests for critical functions
5. **Performance**: Code splitting and lazy loading

### Development Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives",
    "type-check": "tsc --noEmit"
  }
}
```

### Git Workflow
1. **Feature Branches**: Create branches for new features
2. **Conventional Commits**: Standardized commit messages
3. **Pull Requests**: Code review process
4. **Automated Testing**: CI/CD pipeline validation
5. **Semantic Versioning**: Consistent release numbering