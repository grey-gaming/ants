# ADR-007: Validation - Zod and openapi-typescript

- **Status**: Accepted
- **Date**: 2026-06-09

## Context

ANTS follows a spec-first development approach where the OpenAPI 3.1 specification is the single source of truth. Types and validation must derive from this spec, not be maintained separately. We need runtime validation (incoming requests must be validated) and compile-time type safety (TypeScript types must match the API contract).

The validation system must work with our Hono framework (route handlers need request/response validation), support our OpenAPI spec-first workflow, and be reliable enough for AI-generated code (clear error messages, intuitive API).

## Decision

**We use Zod for runtime validation and openapi-typescript for generating TypeScript types from the OpenAPI specification.**

Zod provides runtime validation with excellent TypeScript inference, clear error messages, and composable schemas. openapi-typescript generates TypeScript type definitions directly from our OpenAPI YAML, ensuring the implementation matches the spec.

Together, they create a tight feedback loop: OpenAPI spec → openapi-typescript → TypeScript types → implementation → Zod validation → runtime. The spec drives both type generation and validation, preventing drift between spec and code.

## Alternatives Considered

### JSON Schema Validation Only
- **Pros**: Direct mapping from OpenAPI spec. No additional library.
- **Cons**: No TypeScript type generation. Two sources of truth (spec + types). Manual maintenance of type definitions.

### io-ts
- **Pros**: Functional approach, excellent type inference, runtime validation.
- **Cons**: Functional programming paradigm is harder for AI code generation. Smaller community. Steeper learning curve. Less intuitive API.

### Yup
- **Pros**: Simpler API than Zod. Good for basic validation.
- **Cons**: Less powerful (limited type inference, fewer combinators). No OpenAPI integration story. Smaller ecosystem.

### Manual TypeScript Types + Separate Validation
- **Pros**: Full control over types and validation.
- **Cons**: Two sources of truth (types and spec). High risk of drift. Manual maintenance burden. Defeats spec-first approach.

## Consequences

**Positive:**
- Single source of truth: the OpenAPI spec.
- Zod provides runtime validation with excellent TypeScript inference.
- openapi-typescript generates types directly from the spec, preventing drift.
- Zod integrates with Hono via `hono/zod-openapi`.
- Clear error messages help with debugging (critical for AI-generated code).
- Composable schemas reduce duplication.

**Negative:**
- Keeping Zod schemas aligned with OpenAPI spec requires discipline.
- Two libraries (Zod + openapi-typescript) rather than one unified solution.
- openapi-typescript generates types, but Zod schemas must be manually kept in sync (mitigated: can generate Zod schemas from OpenAPI spec using openapi-zod or similar tools).
- Zod's runtime validation adds a small performance overhead on every request.