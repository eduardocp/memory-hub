# Memory Hub Web - Clean Architecture

This document describes the folder structure and architectural patterns used in the Memory Hub web application.

## Folder Structure

```
src/
├── assets/           # Static assets (images, fonts, etc.)
├── components/       # Reusable UI components
├── config/           # Application configuration
│   └── index.ts      # API_URL and other config exports
├── context/          # React contexts (SocketContext, etc.)
├── domain/           # Domain models and business entities
│   ├── models.ts     # TypeScript interfaces (HelperEvent, Project, etc.)
│   └── index.ts      # Barrel export
├── hooks/            # Custom React hooks
├── pages/            # Page components (routes)
├── services/         # API services and external integrations
│   ├── api.ts        # Axios instance and service classes
│   └── index.ts      # Barrel export
├── shared/           # Shared utilities, constants, and schemas
│   ├── constants.ts  # EVENT_TYPES, NOTE_TYPES, DATE_FILTERS
│   ├── schemas.ts    # Zod validation schemas
│   └── index.ts      # Barrel export
├── App.tsx           # Main application component
├── main.tsx          # Application entry point
└── index.css         # Global styles
```

## Architecture Principles

### 1. Separation of Concerns
- **Domain**: Contains pure TypeScript interfaces representing business entities
- **Services**: Handles all external API communication
- **Pages**: Contains page-level components with their specific logic
- **Components**: Reusable UI components that can be shared across pages
- **Config**: Centralized configuration that can be easily changed

### 2. Barrel Exports
Each major folder has an `index.ts` that re-exports its contents for cleaner imports:
```typescript
// Instead of
import { HelperEvent } from '../domain/models';
import { Project } from '../domain/models';

// You can use
import type { HelperEvent, Project } from '../domain';
```

### 3. Type-Only Imports
Use `import type` for types to comply with `verbatimModuleSyntax`:
```typescript
import type { HelperEvent } from '../domain';
import { API_URL } from '../config';
```

### 4. Centralized Configuration
All configuration (API URLs, feature flags) lives in `/config`:
```typescript
// config/index.ts
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
```

### 5. Form Validation with Zod
All form schemas are centralized in `/shared/schemas.ts`:
```typescript
import { projectSchema, noteSchema } from '../shared/schemas';
import type { ProjectFormData } from '../shared/schemas';
```

### 6. Service Layer
API calls are abstracted into service classes:
```typescript
import { SettingsService, AIService } from '../services';

// Usage
const settings = await SettingsService.getAll();
const models = await AIService.getModels();
```

## Adding New Features

1. **New Entity Type**: Add interface to `domain/models.ts`
2. **New API Endpoint**: Add service method to `services/api.ts`
3. **New Form**: Add Zod schema to `shared/schemas.ts`
4. **New Constants**: Add to `shared/constants.ts`
5. **New Page**: Create in `pages/` folder

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3000` |
