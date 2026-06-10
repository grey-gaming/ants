# ADR-025: Split OpenAPI Spec by Domain

- **Status**: Accepted
- **Date**: 2026-06-10

## Context

The monolithic `openapi/spec.yaml` is 2160+ lines, exceeding the coding model's context window. Small coding models (Qwen3-35B-A3B with ~3B active params) struggle to read and modify the entire spec at once. The spec needs to be split into domain-specific files that each fit comfortably in context.

Existing ADRs that constrain this decision:
- ADR-010 (OpenAI-Inspired Custom API) — the spec defines the canonical API contract
- ADR-007 (Validation — Zod + openapi-typescript) — types are generated from the spec

## Decision

### 1. Split into domain-grouped files

Split the monolithic spec into three directories:
- `openapi/paths/` — domain-grouped path files (Paths Objects)
- `openapi/schemas/` — domain-grouped schema files (maps of schema names to Schema objects)
- `openapi/parameters.yaml` and `openapi/responses.yaml` — shared parameters and responses (small enough to stay as single files)

The root `openapi/spec.yaml` retains metadata (`openapi`, `info`, `servers`, `security`, `tags`, `securitySchemes`) with empty `paths`, `components.schemas`, `components.parameters`, and `components.responses` sections that the bundler fills.

### 2. Each path file is a Paths Object

Each path file in `openapi/paths/` is a YAML map of URL patterns to PathItem objects for one domain (e.g., `threads.yaml`, `runs.yaml`). Cross-file schema references use `$ref: '../schemas/xxx.yaml#/SchemaName'`. Cross-file parameter and response references use `$ref: '../parameters.yaml#/ParamName'` and `$ref: '../responses.yaml#/ResponseName'`.

### 3. Each schema file is a map of schema names to Schema objects

Each schema file in `openapi/schemas/` is a YAML map of schema names to Schema objects for one domain (e.g., `thread.yaml`, `message.yaml`). Cross-schema references use `$ref: 'other-schema.yaml#/SchemaName'`.

### 4. Parameters and responses stay in root-level files

`openapi/parameters.yaml` and `openapi/responses.yaml` contain all shared parameters and responses. They are small enough not to need further splitting. References to schemas within these files use `$ref: 'schemas/xxx.yaml#/SchemaName'`.

### 5. Security schemes stay in root `spec.yaml`

Security schemes are small and rarely modified. They remain in the root `spec.yaml`.

### 6. OpenAPI 3.1 `$ref` supports external file references

OpenAPI 3.1 supports `$ref` with relative file paths for cross-file schema references. The bundler resolves these references to produce a single valid spec.

### 7. Add `bun run spec:bundle` command

Use `@redocly/cli` to merge all files into `openapi/bundled.yaml` for code generators and type generation. The bundler resolves all `$ref` references and produces a self-contained spec.

### 8. Add `bun run spec:validate` command

Validate the bundled spec using `@redocly/cli lint` to catch structural errors.

### 9. Add `bun run spec:types` command

Generate TypeScript types from the bundled spec using `openapi-typescript`.

### 10. `openapi/bundled.yaml` is gitignored

The bundled spec is a generated artifact. It should not be committed. The bundler must run before any tooling that needs a single-file spec.

### 11. Path files reference schemas with relative paths

Path files use `$ref: '../schemas/xxx.yaml#/SchemaName'` to reference schemas. This keeps the directory structure clear and references consistent.

## Alternatives Considered

### Keep single file
- **Pros**: Simple tooling, no bundling step, all content in one place.
- **Cons**: Context window issues persist. Small coding models cannot read or modify the entire file. PR diffs are harder to review.
- **Rejected**: The 2160+ line file exceeds practical context limits.

### Split into microservice specs
- **Pros**: Each service owns its spec, independent deployment.
- **Cons**: Over-engineering for a single API system. ANTS is one service with one spec. Would require API gateway coordination.
- **Rejected**: ANTS is a monolithic API, not microservices.

### Use JSON instead of YAML
- **Pros**: Faster parsing, better tooling support for programmatic generation.
- **Cons**: No real benefit for the stated problem (context size). YAML is more readable for humans. All existing tooling supports YAML.
- **Rejected**: YAML readability outweighs JSON parsing speed for a spec that humans read and edit.

## Consequences

**Positive:**
- Each file fits comfortably in a small coding model's context window.
- Easier to review in PRs — changes are scoped to a domain file.
- Domain-aligned ownership — each domain's spec evolves independently.
- The bundled spec remains a single-file artifact for code generators and type generation.
- The root `spec.yaml` is minimal and rarely changes.

**Negative:**
- Requires a bundling step before type generation and validation.
- `$ref` syntax is slightly more complex (relative file paths instead of internal anchors).
- Contributors must understand the file structure before making changes.
- The bundler is an additional dependency and build step.