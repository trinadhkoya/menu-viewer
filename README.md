# Menupedia

A browser-based tool for exploring, debugging and comparing MBDP normalized menu JSON files across Inspire brands.

## Quick Start

```bash
npm install
npm run dev        # http://localhost:5173
```

## Features

- **Menu Browser** — sidebar category tree, product detail with modifiers, ingredients, nutrition, and size variants
- **Construct View** — classifies every product by structural type (standard, virtual, combo, etc.) with filterable dashboards
- **Menu Diff** — compare two full menus side-by-side (products & categories) across environments, with added/removed/changed highlighting
- **Product Compare** — deep-compare a single product across two environments including modifier group and modifier-level diffs
- **Brand Picker** — pre-configured endpoints for Arby's, BWW, Sonic, Dunkin and Inspire across QA / UAT / Demo / Production
- **Search** — fuzzy search across product names, IDs, PLUs, tags and categories
- **Dark / Light Theme** — persisted toggle with brand-specific accent colors

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |

## Project Structure

```
src/
├── components/
│   ├── MenuUploader.tsx      # Landing page with brand/env picker, file upload, paste, URL
│   ├── Sidebar.tsx           # Category tree navigation
│   ├── ProductDetail.tsx     # Full product view with all sections
│   ├── ProductCompare.tsx    # Product-to-product cross-env comparison
│   ├── DiffView.tsx          # Menu-to-menu diff with summary and detail
│   ├── ConstructView.tsx     # Product construct classification dashboard
│   ├── MenuStats.tsx         # Overview stats for a loaded menu
│   ├── SearchBar.tsx         # Search input
│   ├── SearchResults.tsx     # Search results list
│   └── ...
├── utils/
│   ├── menuHelpers.ts        # Ref resolution, modifier group helpers, tree walking
│   ├── menuDiff.ts           # Diff engine — entity matching, field comparison, summary
│   ├── productCompareHelpers.ts  # Field extraction, comparison, modifier group diffs
│   ├── constructClassifier.ts    # Product type classification rules
│   └── __tests__/            # Unit tests (Vitest)
├── types/
│   └── menu.ts               # TypeScript interfaces for the MBDP menu schema
├── hooks/
│   └── useTheme.ts           # Dark/light theme hook
├── App.tsx                   # Root layout, routing between views
└── App.css                   # All styles (single file)
```

## Tech Stack

- React 19 + TypeScript
- Vite 7
- Vitest + Testing Library
- ESLint (flat config)
- Zero runtime dependencies beyond React

## Contributing

1. Fork and clone
2. `npm install`
3. Make changes, run `npm run lint` and `npm run test`
4. Open a PR

Keep the zero-dependency policy — no lodash, axios, styled-components, etc.
```
