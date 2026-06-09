# ADR-008: LLM Provider - Ollama (Initial)

- **Status**: Accepted
- **Date**: 2026-06-09

## Context

ANTS requires a local LLM inference engine that runs entirely on Apple Silicon, respects our strict privacy constraint (nothing leaves the machine), and provides good performance for our primary model: Qwen3-35B-A3B (a mixture-of-experts model with ~3B active parameters out of 35B total). The target hardware is a Mac Studio M5 with 128GB unified memory.

Privacy is non-negotiable. Cloud LLM APIs (OpenAI, Anthropic, Google) are excluded because they send data off-machine. The inference engine must run locally, support streaming, handle tool calling, and be manageable without deep ML expertise.

The provider must be abstracted behind an interface so that future providers (different local engines, different models, or cloud APIs if privacy requirements change) can be swapped without modifying agent code.

## Decision

**We choose Ollama as the initial LLM provider, abstracted behind a provider interface.**

Ollama provides easy model management (pull, list, run models), Apple Silicon optimization via Metal, a RESTful API for inference, streaming support, and runs headless without a GUI. Qwen3-35B-A3B runs well on Ollama with Metal acceleration on Apple Silicon.

The provider abstraction layer (defined in `src/llm/provider.ts`) ensures that agent code never directly references Ollama. This allows future model routing (different agent tiers use different model sizes), provider swapping (e.g., switching to llama.cpp or vLLM), and potential cloud API integration if privacy requirements change.

## Alternatives Considered

### llama.cpp
- **Pros**: Lower-level control, supports more model formats, highly optimized inference, active development.
- **Cons**: No built-in model management — manual download and configuration. No RESTful API (requires separate server). More manual configuration for each model. Less user-friendly for development iteration.

### vLLM
- **Pros**: Excellent inference throughput, PagedAttention for memory efficiency, production-grade.
- **Cons**: No Apple Silicon / Metal support — CUDA only. Cannot run on our target hardware. Excluded by hardware constraint.

### LM Studio
- **Pros**: Nice GUI for model management, Apple Silicon optimization, good model library.
- **Cons**: GUI-oriented — not suitable for headless server deployment. Not designed for API-first integration. Adds unnecessary GUI dependency.

### Cloud LLM APIs (OpenAI, Anthropic, Google)
- **Pros**: Superior model quality, no hardware investment needed, zero inference management.
- **Cons**: Violates privacy constraint. Data leaves the machine. Requires internet connectivity. Ongoing cost. Explicitly excluded.

### MLX (Apple ML Framework)
- **Pros**: Native Apple Silicon optimization, direct Metal integration, fast inference.
- **Cons**: No server mode (designed for scripts and notebooks, not API serving). Less model support than Ollama. Requires more manual setup for serving.

## Consequences

**Positive:**
- Easy model management (pull, run, list models via CLI).
- Apple Silicon optimization via Metal provides good inference performance.
- RESTful API enables clean integration with Vercel AI SDK.
- Streaming support for real-time token delivery.
- Provider abstraction enables future model routing and provider swapping.
- Headless operation suitable for server deployment.
- Active community and good documentation.

**Negative:**
- Ollama is an additional system dependency (must be installed and running).
- Qwen3-35B-A3B is a large model; comfortable inference with concurrency requires 128GB unified memory.
- Ollama's API may lag behind the latest model features (mitigated: can use direct HTTP calls for advanced features).
- Community-maintained Ollama provider in Vercel AI SDK may have feature gaps.