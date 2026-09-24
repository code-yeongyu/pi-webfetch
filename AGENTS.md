# Repository Conventions

Conventions for human contributors and AI agents working on this repository.

## Style

- Terse technical prose. No emojis in commits, issues, PR comments, or code.
- TypeScript strict mode. No `any`, no `unknown` casts where avoidable, no `@ts-ignore`, no `@ts-expect-error`, no enums.
- ESM modules with `.js` suffix in import paths (Node16 resolution).
- Tabs for indentation. Double quotes for strings (matches biome config).
- Tests use vitest with `#given .. #when .. #then` description style or plain `// given / // when / // then` body comments.

## Commands

- `bun install` — install dependencies (preferred for development).
- `npm install` / `npm ci` — supported consumer install paths.
- `bun run test` / `npm test` — run vitest test suite once.
- `bun run typecheck` — strict TypeScript check (no emit).
- `bun run check` — type check + biome.
- `pi -e ./src/index.ts` — load the extension into a local pi session for manual smoke testing.

## Constraints

- No Bun APIs. Runtime is Node only. Bun is used as the development/CI toolchain, not as a runtime API.
- No dependency on pi-coding-agent internal modules outside the documented public extension API in `@earendil-works/pi-coding-agent`.
- Keep network behavior bounded: abort-aware fetches, timeout cap, and response size cap.
- Tool renderers read typed `details` returned by `execute`; renderers must not parse formatted strings.

## Don'ts

- No `git add -A` or `git add .`. Stage only the files you changed.
- No `git commit --no-verify`. No force pushes. No history rewriting on shared branches.
