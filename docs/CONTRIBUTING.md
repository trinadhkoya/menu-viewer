# Contributing Guide

## Prerequisites

- Node.js 20+
- npm 10+

## Setup

```bash
git clone https://github.com/trinadhkoya/menu-viewer.git
cd menu-viewer
npm install
npm run dev    # → http://localhost:5173
```

## Development Workflow

1. Create a branch from `main`
2. Make changes
3. Run linting and tests:
   ```bash
   npm run lint
   npm run test
   ```
4. Build to verify:
   ```bash
   npm run build
   ```
5. Open a PR against `main`

## Project Conventions

### Zero-Dependency Policy
No runtime dependencies beyond React and Zustand. Do not add lodash, axios, styled-components, date-fns, or any other library. Use native APIs (`fetch`, `structuredClone`, `Intl`, etc.) and hand-rolled utilities.

### Single CSS File
All styles live in `src/App.css`. Group new styles near related existing sections. Use the naming convention: `.component-element--modifier` (BEM-like).

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` — new feature
- `fix:` — bug fix
- `ux:` — visual/UX changes
- `refactor:` — code restructuring (no behavior change)
- `test:` — adding or updating tests
- `docs:` — documentation only
- `chore:` — tooling, config, dependencies

### TypeScript
- Strict mode enabled
- No `any` types — use `unknown` and narrow
- Interfaces for data shapes, types for unions/aliases
- All menu types defined in `src/types/menu.ts`

### Testing
- Tests live in `src/utils/__tests__/`
- Use Vitest + Testing Library
- Name test files `*.test.ts` or `*.test.tsx`
- Run: `npm run test` (single run) or `npm run test:watch` (watch mode)

## File Organization

```
src/
├── components/    # React components (one component per file)
├── hooks/         # Custom React hooks
├── store/         # Zustand stores
├── types/         # TypeScript interfaces and types
├── utils/         # Pure utility functions (no React imports)
│   └── __tests__/ # Unit tests for utilities
├── assets/        # Static assets
├── App.tsx        # Root component
├── App.css        # All application styles
├── main.tsx       # Entry point
└── index.css      # Global resets
```

## Key Areas for Contribution

See [CODE_REVIEW.md](./CODE_REVIEW.md) for prioritized improvement areas:

- **P0:** Bug fixes (DiffView count mismatch, storeRef render access)
- **P1:** Dark mode for customizer, accessibility improvements
- **P2:** Component decomposition, test coverage expansion

## Menu Data

Sample menu JSON files are in the project root:
- `arbys-menu-response.json`
- `bww-menu-response.json`
- `snc-menu-response.json`
- `dunkin-menu.json`

These are real MBDP-normalized payloads used for development and testing.

## Documentation

Project documentation lives in `docs/`:
- [CONTEXT.md](./CONTEXT.md) — project background and domain knowledge
- [ARCHITECTURE.md](./ARCHITECTURE.md) — technical architecture and file map
- [CHANGELOG.md](./CHANGELOG.md) — release history
- [CODE_REVIEW.md](./CODE_REVIEW.md) — known issues and improvement plan
- [SKILLS.md](./SKILLS.md) — engineering patterns and techniques used
