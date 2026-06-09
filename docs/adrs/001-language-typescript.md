# ADR-001: Language - TypeScript

- **Status**: Accepted
- **Date**: 2026-06-09

## Context

ANTS needs a programming language that works effectively with our primary developer: Qwen3-35B-A3B, a mixture-of-experts model with ~3B active parameters. The language choice must maximize the coding agent's effectiveness while providing type safety, a strong ecosystem, and excellent runtime performance on Apple Silicon (Mac Studio M5 with 128GB unified memory). The entire system is offline-first and privacy-constrained — no cloud dependency, everything runs locally.

The language decision is foundational. It affects every other technology choice, the development velocity, the reliability of AI-generated code, and the long-term maintainability of the project.

## Decision

**We choose TypeScript as the programming language for ANTS.**

Qwen3-35B-A3B writes TypeScript more effectively than any other language in our testing. The model produces more correct, idiomatic, and well-structured TypeScript code compared to Rust, Go, or Python. This is the primary driver — since the coding agent is the primary developer, maximizing its effectiveness is paramount.

TypeScript provides compile-time type safety that catches errors before runtime, which is critical when the primary developer is an AI that can make subtle type errors. The massive npm ecosystem provides libraries for everything we need. Native execution on Bun eliminates the traditional build step overhead.

## Alternatives Considered

### Rust
- **Pros**: Memory safety without garbage collection, exceptional performance, strong type system, excellent for systems programming.
- **Cons**: Steep learning curve makes AI code generation less reliable. Slow compile times hurt development velocity. Smaller web framework ecosystem. Overkill for an API server that doesn't need Rust's performance characteristics. Qwen3-35B-A3B produces significantly less reliable Rust code.

### Go
- **Pros**: Simple language, excellent concurrency primitives, fast compilation, good standard library for HTTP services.
- **Cons**: Less expressive type system (no sum types, limited generics). Error handling is verbose. Smaller ecosystem for API/web frameworks compared to TypeScript. Qwen3-35B-A3B's Go output is competent but less idiomatic than its TypeScript.

### Python
- **Pros**: Dominant in AI/ML ecosystem, excellent prototyping speed, massive library ecosystem.
- **Cons**: Weak typing (type hints are optional and not enforced at runtime). Poor runtime performance for an API server. GIL limits true concurrency. Not suitable as a production API server without significant optimization. Type errors surface at runtime, which is dangerous with AI-generated code.

## Consequences

**Positive:**
- Qwen3-35B-A3B produces the highest quality TypeScript code, maximizing AI-assisted development velocity.
- Compile-time type safety catches errors before they reach runtime.
- Massive npm ecosystem provides libraries for every need.
- Native Bun execution eliminates build step overhead.
- Excellent developer tooling (IDE support, linting, formatting).
- Strong alignment with our runtime choice (Bun) and framework choice (Hono).

**Negative:**
- TypeScript's type system can be complex (generics, conditional types) and may produce confusing error messages.
- The npm ecosystem has quality variability — dependency vetting is essential.
- TypeScript adds a compilation step for non-Bun runtimes, though this is mitigated by our Bun choice.
- Some advanced TypeScript patterns may be challenging for AI code generation (though rare in practice).