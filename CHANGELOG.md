# Changelog

## 0.1.3 - 2026-09-24

### Fixed

- Drain response bodies that lack `dump()`, attach a no-op stream error listener before teardown, and abort the drain when the fetch signal fires so discard cannot crash the host or hang (`#7`, Indosaram).

### Changed

- Require Node `>=22.19.0`.
- Move CI to Bun `1.4.2` (`oven-sh/setup-bun@v2`) with a Node 22/24 matrix on Ubuntu and macOS, plus an `npm ci` consumer job.
- Add `@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`, and `@earendil-works/pi-tui` as exact `0.87.1` devDependencies. Peer range for `@earendil-works/pi-*` stays `*` so date-versioned downstream runtimes still resolve.
- Refresh runtime and toolchain dependencies (see version table in the release notes). Majors: `jsdom` 29.1.1 → 30.1.1 (`@types/jsdom` 30.0.0), `undici` 7.28.0 → 8.11.0, `vitest` 4 → 5.0.1.

### CI

- `actions/checkout@v7`, `actions/setup-node@v7`.
- Jobs: `test` (`bun install --frozen-lockfile`, `bun run check`, `bun run test`, `npm pack --dry-run`) and `npm-consumer` (`npm ci`, `npm test`).
