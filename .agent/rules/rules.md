# Agent Behavioral Instructions

This document lists the instructions and behavioral patterns defined throughout the development of the Memory Hub project.

---

## 1. Language and Communication

- **Always speak in Brazilian Portuguese**
- Only **code must be in English** (including code comments and commit messages)

---

## 2. Database Migration Management

- **NEVER modify past migrations**
  - Migrations represent the history of schema changes
  - Other developers/environments may have already run these migrations
  - Future migrations lose context of "why" they exist if previous ones are altered
  
- **To fix issues in existing schemas**: create a NEW migration that applies the fix

---

## 3. Clean Architecture in Frontend (packages/web)

### Folder Structure
```
src/
├── config/       → Centralized configurations (API_URL, etc.)
├── domain/       → Domain models/entities (TypeScript interfaces)
├── services/     → API services and external integrations
├── shared/       → Constants, validation schemas (Zod)
├── hooks/        → Custom React hooks
├── components/   → Reusable components
├── context/      → React contexts
└── pages/        → Pages/routes
```

### Principles
- **Single Source of Truth**: Constants and types defined only once
- **Barrel Exports**: Each folder has an `index.ts` to re-export contents
- **Type-Only Imports**: Use `import type` for types (verbatimModuleSyntax compliance)

---

## 4. Form Validation

- Use **Zod** for schema definition
- Use **React Hook Form** for state management
- Use **@hookform/resolvers/zod** for integration
- Apply `as any` to the resolver to work around version incompatibility between Zod 4 and the resolver

---

## 5. Code Patterns

### TypeScript
- Use explicit types when necessary
- Prefer interfaces for domain objects
- Maintain type consistency between frontend and backend

### React
- Functional components with hooks
- Separate logic from UI when possible
- Keep pages focused on orchestration, components focused on presentation

---

## 6. Commits and Git

- Commit messages in **English**
- Follow conventional commits pattern when applicable (feat, fix, refactor, etc.)

---

## 7. Development Environment

- **API_URL** configurable via environment variable `VITE_API_URL`
- Default: `http://localhost:3000`

---

## Decision History

| Date | Decision |
|------|----------|
| 2026-01-26 | Refactor forms to use Zod + React Hook Form |
| 2026-01-26 | Apply Clean Architecture in frontend |
| 2026-01-26 | Centralize constants and types in shared folders |
| 2026-01-26 | Never modify past migrations |

---

*This document should be updated as new instructions are defined.*
