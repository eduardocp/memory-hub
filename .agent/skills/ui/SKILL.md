---
name: UI Development
description: Guidelines, standards, and structure for developing the frontend UI of Memory Hub using React, Tailwind CSS, and other modern web technologies.
---

# UI Development

The web frontend is built with **React 19**, **Vite**, and **Tailwind CSS v4**, designed to provide a premium, responsive, and dark-themed user experience.

## When to use this skill

- Use this when building or modifying React components, pages, or styling in the web frontend.
- This is helpful for understanding the design system, directory structure, and best practices for the frontend.

## Tech Stack

- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4 (configured via CSS variables in `index.css`)
- **State/Data Fetching**: React Query (@tanstack/react-query)
- **Routing**: React Router v7
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React
- **Dates**: Date-fns
- **HTTP Client**: Axios

## Directory Structure (`packages/web/src`)

- `assets/`: Static assets (images, fonts).
- `components/`: Reusable UI components.
- `context/`: React Context providers (Global state).
- `domain/`: Business logic types and interfaces.
- `pages/`: Page components corresponding to routes.
- `services/`: API interaction logic (Axios instances).
- `shared/`: Shared utilities and constants.
- `index.css`: Global styles and Tailwind configuration.

## Design System & Styling

The application uses a **Dark Mode** first approach with specific color tokens defined in `index.css`.

### Color Palette (Tailwind Theme)

Use these semantic names instead of raw hex values:

- `bg-background` (#0e0e11): Main page background.
- `bg-card` (#1c1c1f): Card/Container background.
- `bg-surface` (#28282c): Hover states / secondary surface.
- `border-border` (#333336): Subtle borders.
- `text-primary` (#e3e3e3): Main text.
- `text-secondary` (#9ca3af): Muted text.
- `text-accent` (#5865F2): Primary brand color.
- `text-success` (#2ECC71): Success states.
- `text-error` (#FF5F56): Error states.

### Component Guidelines

1.  **Keep it Simple**: Components should be focused on a single responsibility.
1.  **Reusable**: Extract common patterns into `components/`.
1.  **Tailwind**: Use utility classes for styling. Avoid custom CSS unless for complex animations or legacy overrides.
1.  **Lucide Icons**: Import icons from `lucide-react`.
1.  **Models**: Use/create models in `domain/` for data structures.

## Best Practices

### Data Fetching
Use `useQuery` and `useMutation` from React Query for server state.
```tsx
const { data, isLoading } = useQuery({ 
  queryKey: ['todos'], 
  queryFn: fetchTodos 
});
```

### Forms
Use `react-hook-form` with `zod` resolvers.
```tsx
const schema = z.object({ name: z.string().min(1) });
const { register, handleSubmit } = useForm({ resolver: zodResolver(schema) });
```

### Routing
Use `react-router-dom` for navigation.
```tsx
<Link to="/project/123" className="text-accent">View Project</Link>
```
