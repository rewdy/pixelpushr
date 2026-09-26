The project's naming, structure, and style standard. The existing codebase was converged onto
it; new code follows it. When this doc and an existing file disagree, this doc
wins — fix the file.

## TypeScript

- **`type`, not `interface`** — always, unless an `interface` is technically required (e.g.
  declaration merging or a class `implements`). Convert plain object/props shapes to `type`.
- **Exported functions get a TSDoc comment** describing what they do. Do **not** restate
  parameter or return types in the TSDoc — TypeScript already carries those. Types are
  self-documenting; skip redundant comments.
- **No `index.ts` barrel files** — they slow compilation. Import from the concrete module path.
- **No type aliases / path aliases** — relative imports only (`../foo`, not `@/foo`).
- **No TS `enum`** (banned by `erasableSyntaxOnly`) — use a `const` object + derived type.

## React

- **Functional components only**, unless a class is technically required.
- **Named exports**, never `export default`.
- **Arrow functions**, not `function` declarations, for components and helpers.
- Use **hooks** to factor out logic when it clarifies a component.
- **State:** import `atomFamily` from `jotai-family`, not `jotai/utils`; persisted atoms keep using
  `atomWithStorage` from `jotai/utils`.
- **A versioned storage key is versioned on purpose.** The persona default lives behind
  `default-persona-id-v2`; the unversioned `default-persona-id` is never read. Bumping the suffix
  **silently resets every stored pick** — there is no read-through or migration — so never rename such
  a key incidentally, and a default change that should *not* disturb existing users leaves the key
  alone.

## Routing

- **Routing is `wouter`**, not `react-router` — chosen for size (~2.3 kB) and a near-1:1 hook API.
- **The catch-all route must be last in `<Switch>`.** wouter renders the *first* match, so a route
  added below the catch-all never matches and nothing errors. `src/App.tsx` carries this as a code
  comment; keep it there.
- **Drawer or modal state a user would plausibly link to belongs in the URL**, not component state —
  the cost is one optional path segment. Corollary: an active-section highlight must then be a
  **prefix match**, or the section unlights itself on its own child routes.

## Styling

- **Mantine first, custom CSS only when there's no clean built-in.** Before writing a CSS
  Module rule, ask: *does Mantine already do this?* Layout/spacing → `Group`/`Stack` (`gap`,
  `px`/`py`); text color/weight/size → `Text` props (`c`, `fw`, `size`); icon color → the
  icon's `color` prop. Reach for CSS Modules only for what has no clean prop equivalent (e.g.
  a bordered container, an `UnstyledButton` hover state, a transform/transition, a font-size
  override on a component that exposes none). It's fine to write CSS when you genuinely need
  it — just not when a component or prop already covers it.
- **Styling = Mantine theme + plain CSS Modules.** No SCSS, no tachyons (see
  [`ui-and-theme.md`](ui-and-theme.md)). Use theme tokens in CSS (`var(--mantine-*)`,
  `light-dark(...)`).

## Naming & file layout

Files: **camelCase** (`fileNameExample.ts`). Components: **PascalCase** (`MyComponent.tsx`).
When same-named files are likely, add a scope suffix:

- models → `scope.models.ts`
- state → `scope.state.ts`

| Kind                    | Location                                                  | File naming                         | Notes                                                        |
| ----------------------- | --------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------ |
| **Component**           | `src/components/` OR<br />`src/components/ComponentName/` | `ComponentName.tsx`                 | Can be placed in folder with same name as component when multiple files relate. Folder name = component name (PascalCase). |
| **Component props**     | same folder                                               | inline, or `ComponentName.props.ts` | Keep the `ComponentNameProps` type above the component when small; move to its own file when props grow. |
| **Hook**                | `src/hooks/`                                              | `useSomething.ts`                   | **React hooks only** (calls hooks / returns hook state). A pure function with no hooks is a *helper*, even if only one component uses it. |
| **Shared type / model** | `src/models/`                                             | `group.models.ts`                   | **Types only** — no runtime code. e.g. `user.models.ts`, `api.models.ts`. See locality rule below. |
| **Helper**              | `src/helpers/`                                            | `name.ts`                           | Pure functions live here (not colocated in a component folder or `src/hooks/`). Grouped when it makes sense, e.g. `format.ts`. |
| **State**               | `src/state/`                                              | `scope.state.ts`                    | Few atoms → a single module; multiple scopes → split per scope, e.g. `chatThreads.state.ts`. |
| **Config / constants**  | `src/config/`                                             | `name.ts`                           | Small → one module; more → split, e.g. `profiles.ts`, `defaults.ts`. |

### Type locality rule

A type may live **next to the code that owns it** when it isn't used widely outside that file —
keep it local rather than forcing it into `src/models/`. Once a type is consumed **across the
app**, it **must** move to `src/models/` and follow the `group.models.ts` convention. `src/models/`
holds types only; the runtime that uses them (constants, functions, schemas) lives with the code
(`src/config/`, `src/helpers/`, the owning module).

### Component template

```typescript
// src/components/ComponentName/ComponentName.tsx
import type React from "react";

type ComponentNameProps = {
  title: string;
  // ... other props
};

export const ComponentName: React.FC<ComponentNameProps> = ({ title }) => {
  // component code
};
```