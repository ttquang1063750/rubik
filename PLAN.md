# Plan: TypeScript + SCSS + Vitest Refactor

## Context

Rubik Solver hiện tại là vanilla JS (1275 dòng, 4 modules: cube, render3d, solver-lbl, app) chạy tĩnh trên Cloudflare. Rewrite thành TypeScript (type safety), SCSS (nesting/variables), Vitest (unit tests on cube logic) để:
- Nâng cao maintainability qua types
- Organize CSS qua SCSS modules
- Verify core logic (cube, solver) với test suite
- Vẫn deploy tĩnh trên Cloudflare qua Vite bundler

**Decision**: Dùng npm + Vite, Vitest strict TypeScript, focus unit tests trên cube logic.

---

## Architecture Plan

### 1. Project Structure

```
rubik-solver/
├── src/
│   ├── core/
│   │   ├── cube.ts              (tái viết từ js/cube.js)
│   │   ├── solver-lbl.ts        (tái viết từ js/solver-lbl.js)
│   │   └── types.ts             (shared types: Face, Move, etc.)
│   ├── ui/
│   │   ├── app.ts               (tái viết từ js/app.js)
│   │   ├── renderer.ts          (tái viết từ js/render3d.js, Three.js)
│   │   └── components.ts        (build UI helpers: palette, buttons)
│   ├── styles/
│   │   ├── main.scss            (root + theme variables)
│   │   ├── layout.scss          (grid, layout)
│   │   ├── cube3d.scss          (khối 3D container)
│   │   ├── panel.scss           (control panel)
│   │   ├── buttons.scss         (button styles, states)
│   │   └── player.scss          (playback controls)
│   └── index.html               (entry point)
├── tests/
│   ├── core/
│   │   ├── cube.test.ts         (Cube moves, state, solve)
│   │   ├── solver-lbl.test.ts   (LBL solving, coverage)
│   │   └── types.test.ts        (validators, helpers)
│   └── setup.ts                 (Vitest config helpers)
├── public/
│   ├── favicon.svg
│   ├── logo.svg
│   └── og-image.svg
├── package.json                 (new)
├── tsconfig.json                (new)
├── vite.config.ts               (new)
├── vitest.config.ts             (new)
└── [docs]
    ├── AGENTS.md
    ├── DEPLOY.md
    └── ...
```

### 2. TypeScript Types (src/core/types.ts)

```typescript
// Fundamental types
export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
export type Move = string; // "R", "U'", "F2", etc.
export type FaceletState = string[]; // 54 chars: U|R|F|D|L|B
export type Vec3 = [number, number, number];

export interface Sticker {
  index: number;
  face: Face;
  faceIdx: number;
  pos: Vec3;
  n: Vec3;
  center: Vec3;
}

export interface SolveResult {
  stages: Array<{ name: string; moves: Move[] }>;
  moves: Move[];
  solved: boolean;
}
```

### 3. Cube Core (src/core/cube.ts)

**Rewrite from `js/cube.js`:**
- Class `Cube` with typed methods
  - `constructor(state?: FaceletState)`
  - `move(m: Move): Cube` (returns this, fluent API)
  - `apply(seq: Move[] | string): Cube`
  - `isSolved(): boolean`
  - `clone(): Cube`
  - `get state(): FaceletState`
  - `toString(): string`
- Static helpers: `Cube.solved()`, `Cube.fromString()`, `Cube.simplify()`, `Cube.invertSeq()`
- Export `STICKERS: Sticker[]`, `MOVE_DEF`, `FACES: Face[]`, `OFFSET`

**Leverage existing logic**: Translate IIFE + geometry functions to class + functions. No semantic changes.

### 4. Solver (src/core/solver-lbl.ts)

**Rewrite from `js/solver-lbl.js`:**
- `export function solveLBL(state: FaceletState): SolveResult`
- Internal helpers (stay private, use TypeScript `private`)
  - `doCross()`
  - `doCorners()`
  - `doMiddle()`
  - `doLastLayer()`
  - Micro-search, macro-search typed
- Test: 2000 random scrambles, coverage >95%

**Reuse existing logic**: Algorithms + formulas unchanged, add types.

### 5. Renderer (src/ui/renderer.ts)

**Rewrite from `js/render3d.js`:**
- Class `RubikRenderer` (same public API)
  - `constructor(container: HTMLElement)`
  - `setState(state: FaceletState): void`
  - `animateMove(move: Move, ms: number, cb?: () => void): void`
  - `pickEnabled: boolean`
  - `onPick: ((idx: number) => void) | null`
  - `resetView(): void`
  - `flash(idx: number): void`
- Use `Three` types from `@types/three`
- No semantic changes, add types

### 6. App (src/ui/app.ts)

**Rewrite from `js/app.js`:**
- Initialize renderer, solver (selector: LBL or Kociemba)
- Event handlers typed with proper return types
- State management (minimal):
  ```typescript
  let state: FaceletState = Cube.solved().state;
  let selected: Face = 'U';
  let inputMode: boolean = true;
  let playback: SolveResult | null = null;
  ```
- Reuse validation logic, DOM helpers
- Type all event handlers

### 7. Styles (src/styles/*.scss)

**Rewrite from `css/styles.css`:**
- `main.scss`: root variables + theme
  ```scss
  $colors: (
    bg: #0e1116,
    bg2: #161b22,
    text: #e6edf3,
    muted: #9aa7b4,
    accent: #4f8cff,
    accent2: #2ea043,
  );
  $spacing: 16px;
  $radius: 14px;
  
  @mixin flex-center {
    display: flex;
    align-items: center;
  }
  ```
- Modular: `layout.scss`, `buttons.scss`, `player.scss` (one per component)
- Nesting + `@extend`, `@mixin`
- No semantic changes to visual output

---

## Build Setup

### package.json

```json
{
  "name": "rubik-solver",
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  },
  "dependencies": {
    "three": "^0.160.0"
  },
  "devDependencies": {
    "@types/node": "^latest",
    "@types/three": "^r160",
    "@vitest/ui": "^latest",
    "@vitest/coverage-v8": "^latest",
    "typescript": "^5.0",
    "vite": "^5.0",
    "vitest": "^latest",
    "sass": "^latest"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
  },
  server: { 
    port: 5173,
    strictPort: false,
  },
  publicDir: '../public',
});
```

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'tests', 'src/index.html'],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
  },
});
```

---

## Test Plan (Vitest)

### Unit Tests: Cube Logic (tests/core/cube.test.ts)

**Coverage target**: >95% (all moves, all state transitions)

```typescript
describe('Cube', () => {
  test('solved state has all 9 of each color', () => { });
  test('solved state has centers correct', () => { });
  test('move("R") rotates right face CW', () => { });
  test('move("R") + move("R\'") = identity', () => { });
  test('move("R2") = move("R") twice', () => { });
  test('all 18 moves work (U,D,L,R,F,B x3)', () => { });
  test('apply(sequence) same as applying each move', () => { });
  test('isSolved() works for solved & scrambled', () => { });
  test('fromString(toString) round-trip lossless', () => { });
  test('clone() creates independent copy', () => { });
  test('5000 random scrambles all isValid()', () => { });
  test('5000 random scrambles all solvable', () => { });
});
```

### Unit Tests: LBL Solver (tests/core/solver-lbl.test.ts)

```typescript
describe('solveLBL', () => {
  test('2000 random scrambles all solve to solved', () => {
    // for 2000 random: scramble -> solveLBL -> apply solution -> isSolved
  });
  test('solution moves are all valid (alphabet)', () => {
    // check all moves in [U,U',U2,...,B2]
  });
  test('solution length < 200 moves', () => {
    // all solutions reasonable length
  });
  test('stages array non-empty and ordered', () => {
    // stages have names, moves are sequential
  });
  test('stage moves sum to total moves', () => { });
  test('all stage names are non-empty strings', () => { });
});
```

### Cross-Test: Cube ↔ cubejs (tests/core/integration.test.ts)

```typescript
describe('Cube <-> cubejs validation', () => {
  test('move(m) output == cubejs move(m) @ 5000 samples', () => {
    // load cubejs globally, compare state after random sequences
  });
  test('Cube.fromString(state) produces same result as cubejs', () => { });
});
```

---

## Migration Strategy (Phase-based)

### Phase 1: Setup Infrastructure (1-2h)
- [ ] Create directory structure: `src/`, `tests/`, `public/`
- [ ] Create `package.json`, install deps (`npm install`)
- [ ] Create `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`
- [ ] Create `src/index.html` entry point
- [ ] Test dev server: `npm run dev` works

### Phase 2: Core Logic (3-4h)
- [ ] Translate `js/cube.js` → `src/core/cube.ts` with types
- [ ] Create `src/core/types.ts` with all type definitions
- [ ] Write cube unit tests (`tests/core/cube.test.ts`)
- [ ] Validate: `npm run test` passes, coverage >95%
- [ ] Validate against cubejs: write integration test
- [ ] Translate `js/solver-lbl.js` → `src/core/solver-lbl.ts`
- [ ] Write solver tests (`tests/core/solver-lbl.test.ts`)

### Phase 3: UI Layer (2-3h)
- [ ] Translate `js/render3d.js` → `src/ui/renderer.ts` with Three.js types
- [ ] Translate `js/app.js` → `src/ui/app.ts` with event handler types
- [ ] Create `src/ui/components.ts` for UI helpers
- [ ] Wire up to `src/index.html`
- [ ] Test: `npm run dev` → app loads and works

### Phase 4: Styles (1-2h)
- [ ] Create `src/styles/main.scss` with variables & mixins
- [ ] Create modular SCSS files: `layout.scss`, `buttons.scss`, `player.scss`, etc.
- [ ] Replace `<link>` in index.html to import main.scss
- [ ] Verify no visual regressions (screenshot comparison)

### Phase 5: Testing & Build (1-2h)
- [ ] Run full test suite: `npm run test`
- [ ] Check coverage: `npm run test:coverage` (target >80%)
- [ ] Build: `npm run build` → verify `dist/` has index.html, assets
- [ ] Check bundle size: `dist/index.html.gz` <200KB
- [ ] Test: `npm run preview` → app works from dist/

### Phase 6: Cleanup & Docs (1h)
- [ ] Delete old `js/`, `css/` directories (backup first)
- [ ] Create `DEVELOPMENT.md` (how to run dev, test, build)
- [ ] Update `AGENTS.md` with TS/test references
- [ ] Update `README.md` with new build process

---

## Verification Plan

### 1. Build Succeeds
```bash
npm run build
# Expected: 
# - dist/ directory created
# - dist/index.html exists
# - dist/assets/ has .js, .css files
# - No TypeScript errors
```

### 2. Tests Pass & Coverage
```bash
npm run test
# Expected:
# - All tests pass (cube + solver)
# - Coverage report shows >95% for core/
# - No `any` types in coverage report
```

### 3. App Functional (Manual QA)
- `npm run dev` → http://localhost:5173
- Buttons work: Solved, Scramble, Clear
- Palette colors selectable
- Cube 3D renders and rotates
- Solve (both methods) produces playback
- Playback controls work (next, prev, play, etc.)
- UI styling matches old version (no visual diff)

### 4. Deploy to Cloudflare
```bash
npm run build
# Copy dist/ to Cloudflare Pages repo
# Push → verify at https://rubik.js-tools.org
# Smoke test: scramble → solve → playback
```

### 5. Cross-Validation Tests
- `npm run test` includes integration tests
- Cube moves match cubejs: 5000 samples ✓
- 2000+ random scrambles solve: ✓
- TypeScript strict: 0 errors ✓

---

## Critical Files & Reuse Strategy

| Source File | Target File | What to Reuse | Notes |
|-------------|-------------|---------------|-------|
| `js/cube.js` | `src/core/cube.ts` | All move generation, geometry, state logic | Convert IIFE to class, add types |
| `js/solver-lbl.js` | `src/core/solver-lbl.ts` | All algorithms, formulas, micro/macro search | Extract to function, add types |
| `js/render3d.js` | `src/ui/renderer.ts` | Three.js scene, animation, pick logic | Add Three types, keep API same |
| `js/app.js` | `src/ui/app.ts` | Event handlers, validation, state, playback | Add event handler types |
| `css/styles.css` | `src/styles/*.scss` | All visual rules, colors, layout | Organize to modules, use variables |
| `vendor/three.min.js` | npm `three` package | (drop file, use npm) | `import * as THREE from 'three'` |
| `vendor/cube.js` | (keep file) | Test cross-validation only | Reference only in test files |

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Three.js types are complex | Build may fail, types hard to understand | Use `@types/three`, create simple wrapper `Renderer` class |
| cubejs not typed (test only) | Test validation may be weak | Keep cubejs.js in vendor, use in tests only, wrap with helpers |
| Bundle size increases | Deploy fails if >500KB | Vite tree-shakes, gzip on Cloudflare, monitor dist size |
| Test flakiness (3D animations) | Tests become unreliable | Don't test renderer internals, only data/logic path |
| Circular imports | TypeScript compilation fails | Plan module structure carefully: `types.ts` → `cube.ts` → `solver.ts` → `ui/` |
| Breaking Three.js API | Animations don't work | Pin `three@0.160.0` to match old vendor version |

---

## Success Criteria

- ✅ **TypeScript strict mode** — 0 errors, no `any` (except vendor boundary)
- ✅ **95%+ unit test coverage** — cube + solver thoroughly tested
- ✅ **2000 scramble tests** — all pass, all solve, all valid
- ✅ **Vitest runs <5s** — test suite fast
- ✅ **Visual identical** — screenshot diff shows 0 changed pixels
- ✅ **Build <200KB gzipped** — same size as vanilla version
- ✅ **Deploy to Cloudflare** — `npm run build && npm run preview` works
- ✅ **SCSS modular** — clean code organization, no visual regressions
- ✅ **Type safety** — hovering in IDE shows helpful type hints
- ✅ **No runtime errors** — dev console clean (no errors/warnings)

---

## Timeline Estimate

- **Phase 1** (setup): 1-2 hours
- **Phase 2** (core): 3-4 hours
- **Phase 3** (UI): 2-3 hours
- **Phase 4** (styles): 1-2 hours
- **Phase 5** (test/build): 1-2 hours
- **Phase 6** (docs): 1 hour

**Total: ~10-14 hours** (assuming no major blockers)

---

## Next Steps

1. ✅ Plan approved
2. → Start Phase 1: Create directory structure & install deps
3. → Phase 2: Translate cube.ts + tests
4. → Phase 3: Translate solver.ts + tests
5. → Phase 4: UI layer (renderer, app)
6. → Phase 5: SCSS modules
7. → Phase 6: Build, test, deploy

Ready to begin Phase 1? 🚀
