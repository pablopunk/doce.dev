# Security dependency overrides

This project uses `pnpm.overrides` only when a vulnerable transitive dependency cannot be updated through a direct parent dependency yet, or when pnpm's auto-installed peer dependencies need to be kept aligned with an updated security-sensitive package family.

## `dompurify >=3.4.0 <4.0.0`

`dompurify` is pulled in transitively through:

```text
@monaco-editor/react > monaco-editor > dompurify
```

`@monaco-editor/react` is already at the current available release, so the dependency is forced with a pnpm override until the parent packages update their own `dompurify` dependency.

This override addresses these advisories:

- GHSA-v2wj-7wpq-c8vv
- GHSA-cjmm-f4jc-qw8r
- GHSA-cj63-jhhr-wcxv
- GHSA-39q2-94rc-95cp
- GHSA-h7mw-gpvr-xq4m
- GHSA-crv5-9vww-q3g8
- GHSA-v9jr-rg53-9pgp
- GHSA-h8r8-wccr-v5f2

Remove this override when `@monaco-editor/react` or `monaco-editor` updates its `dompurify` dependency to a patched version.

## `esbuild >=0.28.1 <0.29.0`

`esbuild` is pulled in transitively through Astro/Vite production paths, including:

```text
@astrojs/react > vite > esbuild
@astrojs/react > vite > tsx > esbuild
```

This override is present because the currently selected Astro/Vite production dependency graph still resolves vulnerable `esbuild` versions while `pnpm audit --prod` requires `>=0.28.1`.

This override addresses these advisories:

- GHSA-gv7w-rqvm-qjhr
- GHSA-g7r4-m6w7-qqqr

Remove this override when Astro, Vite, or tsx updates its own `esbuild` dependency to a patched version.

## Effect peer dependency alignment

`@effect/platform-node` is updated to `0.107.0` for security fixes in its production dependency path. pnpm auto-installs peer dependencies for this package family, and without overrides it can keep older peer versions that no longer match what `@effect/platform-node@0.107.0` expects.

These overrides keep the Effect peer family aligned while allowing patch releases within the same pre-1.0 minor line:

- `@effect/cluster >=0.59.0 <0.60.0`
- `@effect/rpc >=0.75.1 <0.76.0`
- `@effect/sql >=0.51.1 <0.52.0`

pnpm overrides alone do not change every auto-installed peer selection in this dependency graph, so the matching peer packages are also listed as direct dependencies. `@effect/workflow` and `@effect/experimental` are direct dependencies for the same alignment reason because they are required peers of the updated `@effect/cluster` and `@effect/sql` versions.

Remove these overrides and direct Effect peer dependencies when the Effect packages can be updated together without pnpm peer dependency warnings.
