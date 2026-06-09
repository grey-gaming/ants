# ADR-002: Runtime - Bun

- **Status**: Accepted
- **Date**: 2026-06-09

## Context

ANTS needs a runtime for executing TypeScript. The runtime must support streaming (SSE for LLM responses), fast startup times for development, and excellent performance on Apple Silicon. Our deployment target is a Mac Studio M5 with 128GB unified memory running locally and offline.

The runtime is the foundation that TypeScript code executes on. It affects startup performance, API response times, development experience, and which npm packages are compatible.

## Decision

**We choose Bun as the runtime.**

Bun provides native TypeScript execution without a build step, which dramatically improves development velocity when the primary developer is an AI coding agent. Fast startup times (2-5x faster than Node.js) reduce feedback loops. Built-in tools (test runner, bundler, package manager) reduce dependency count. Excellent Apple Silicon performance via native Metal integration.

Bun's compatibility with the npm ecosystem means we can use existing packages while benefiting from Bun's performance. The built-in test runner and bundler eliminate the need for Jest, Webpack, or similar tooling.

## Alternatives Considered

### Node.js
- **Pros**: Most mature JavaScript/TypeScript runtime. Largest ecosystem compatibility. Battle-tested in production. Extensive community knowledge.
- **Cons**: Requires a compilation step (tsx, ts-node, or build step) for TypeScript. Slower startup times. No built-in test runner or bundler (requires Jest, Vitest, etc.). Larger memory footprint. Less optimized for Apple Silicon.

### Deno
- **Pros**: Secure by default (permissions model). Native TypeScript support. Built-in tooling (formatter, linter, test runner). Good standard library.
- **Cons**: Different standard library from Node.js creates compatibility issues. Smaller ecosystem. Import-by-URL pattern is unfamiliar. Community and third-party library support is less mature than Node/Bun.

### Cloudflare Workers
- **Pros**: Edge-optimized, fast cold starts, built-in Key-Value storage.
- **Cons**: Edge-only runtime, not self-hostable. Violates offline-first constraint. Proprietary runtime with limited API surface.

## Consequences

**Positive:**
- Native TypeScript execution eliminates build step — `bun run src/index.ts` just works.
- Fast startup times improve development loop.
- Built-in test runner (`bun test`) eliminates Jest dependency.
- Built-in bundler reduces tooling complexity.
- Excellent Apple Silicon performance.
- Compatible with most npm packages.

**Negative:**
- Bun is newer than Node.js — less battle-tested in production.
- Some npm packages may have compatibility issues (though this is increasingly rare).
- Bun's API surface is still evolving — minor breaking changes between versions.
- Smaller community than Node.js — fewer Stack Overflow answers, tutorials.
- Hot reload behavior can differ from Node.js in edge cases.