import type { ConfiguredServices } from "./app";

// Re-export so route files can import from here without importing from server.ts
export type Services = ConfiguredServices;
