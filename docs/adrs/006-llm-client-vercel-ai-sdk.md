# ADR-006: LLM Client - Vercel AI SDK

- **Status**: Accepted
- **Date**: 2026-06-09

## Context

ANTS needs a client library for LLM interaction that supports streaming responses (SSE for real-time token delivery), tool calling (agents invoke tools during multi-turn conversations), and provider abstraction (swap between Ollama, future providers, without changing agent code). The library must work with Ollama as the initial provider and support our conversational agent model where agents make multiple tool calls across multiple turns.

LLM interaction is the core of ANTS. Every agent uses the LLM client for every turn. The client must handle streaming natively (our API streams responses to users), tool calling (agents use tools like web_search), and be provider-agnostic so we can swap Ollama for other providers in the future without changing agent code.

## Decision

**We choose Vercel AI SDK as the LLM client.**

Vercel AI SDK provides a unified streaming interface, built-in tool calling abstraction, provider-agnostic design (Ollama via `@ai-sdk/ollama` provider), and handles SSE streaming natively. It's battle-tested in production (used by Vercel's own products), has excellent TypeScript types, and provides a clean abstraction that lets us swap providers without touching agent code.

The SDK's `streamText` and `generateText` APIs handle streaming and tool calling in a way that integrates naturally with our conversational agent model — agents can make multiple tool calls across multiple turns within a single `streamText` call.

## Alternatives Considered

### LangChain.js
- **Pros**: Most comprehensive LLM framework. Supports every provider. Rich tool calling system. Large community.
- **Cons**: Bloated (many dependencies). Complex abstraction layers make debugging difficult. Streaming support is functional but not elegant. Heavy for what we need — we'd use a fraction of its capabilities. Not ideal for AI-generated code due to complexity.

### Direct fetch to Ollama API
- **Pros**: Full control, no dependencies, maximum performance.
- **Cons**: Reinventing the wheel — we'd need to implement streaming, tool calling, provider abstraction, error handling, and retry logic. High maintenance burden. No type safety without manual effort.

### OpenAI Node SDK
- **Pros**: Official OpenAI client. Excellent streaming support. Well-maintained.
- **Cons**: OpenAI-specific — not provider-agnostic. Would need a custom adapter layer for Ollama. Doesn't support our multi-provider abstraction goal.

### Custom Implementation
- **Pros**: Full control, purpose-built for our needs.
- **Cons**: Highest maintenance burden. Need to implement and maintain streaming, tool calling, provider abstraction, error handling, and retry logic. Time better spent on core features.

## Consequences

**Positive:**
- Unified streaming interface — `streamText` handles SSE naturally.
- Built-in tool calling abstraction — agents define tools declaratively.
- Provider-agnostic — swap Ollama for other providers without changing agent code.
- Battle-tested in production.
- Excellent TypeScript types throughout.
- Active development and good documentation.

**Negative:**
- Tied to Vercel's release schedule and design decisions.
- Ollama provider (`@ai-sdk/ollama`) is community-maintained, not officially supported.
- Abstraction may not cover all Ollama-specific features we need (mitigated: can fall back to direct Ollama API calls for edge cases).
- Learning curve for AI SDK's specific patterns and APIs.