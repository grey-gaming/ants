# ADR-003: Framework - Hono

- **Status**: Accepted
- **Date**: 2026-06-09

## Context

ANTS needs an HTTP framework for building the API layer. The framework must support Server-Sent Events (SSE) for streaming LLM responses, middleware for auth/rate-limiting/error-handling, OpenAPI integration for our spec-first approach, and run well on Bun.

The API framework is the core of our system — every request flows through it. The framework must handle streaming natively (LLM responses stream token by token), support type-safe route definitions that align with our OpenAPI spec, and be lightweight enough to not add unnecessary overhead.

## Decision

**We choose Hono as the HTTP framework.**

Hono is ultra-lightweight (~14KB), has a streaming-first design (native SSE support), built-in OpenAPI support with Zod validators, excellent TypeScript types, and runs on Bun, Deno, Node.js, and Cloudflare Workers. Its middleware system is clean and composable. The built-in OpenAPI integration aligns perfectly with our spec-first development approach.

Hono's `hono/zod-openapi` module lets us define routes with Zod validation that auto-generate OpenAPI schemas, creating a tight loop between spec and implementation.

## Alternatives Considered

### Express
- **Pros**: Most popular Node.js framework. Massive middleware ecosystem. Well-documented.
- **Cons**: Bloated for modern API servers. No native streaming support (requires workarounds for SSE). No built-in OpenAPI support. Callback-based middleware pattern is dated. Poor TypeScript types without additional libraries.

### Fastify
- **Pros**: Fast (as the name implies). Schema-based validation. Plugin system. Good TypeScript support.
- **Cons**: Heavier than Hono. Streaming support requires plugins. OpenAPI generation requires separate plugin. Less elegant middleware pattern. Not designed for edge/Bun runtimes primarily.

### Koa
- **Pros**: Lightweight, async/await-native middleware pattern. Minimal core.
- **Cons**: Minimal ecosystem. Poor OpenAPI story. Fewer middleware options. Not streaming-first. Smaller community.

### Elysia
- **Pros**: Built specifically for Bun. Excellent performance. Built-in WebSocket and SSE. End-to-end type safety with Eden.
- **Cons**: Bun-only (no multi-runtime support). Smaller community than Hono. Less mature. Fewer middleware options.

## Consequences

**Positive:**
- Ultra-lightweight (~14KB) — minimal overhead.
- Native SSE streaming aligns with our LLM response model.
- Built-in OpenAPI support with Zod validators enforces spec-first development.
- Multi-runtime support (Bun, Node, Deno) provides flexibility.
- Excellent TypeScript types throughout.
- Clean, composable middleware pattern.
- Growing ecosystem with active development.

**Negative:**
- Smaller ecosystem than Express — fewer community middleware options.
- Some patterns differ from Express (learning curve for developers familiar with Express).
- OpenAPI integration requires learning Hono's specific patterns.
- Community resources (tutorials, Stack Overflow) are less extensive than Express.