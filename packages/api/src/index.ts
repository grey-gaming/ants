import { initDb } from "@ants/store";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { buildApp } from "./server";

let sharedApp: ReturnType<typeof buildApp> | null = null;

export function getApp(dbOnly?: PostgresJsDatabase): ReturnType<typeof buildApp> {
  if (!sharedApp) {
    if (!dbOnly) {
      initDb();
    }
    sharedApp = buildApp(dbOnly);
  }
  return sharedApp;
}

export function serveApp() {
  const app = getApp();
  const port = parseInt(process.env.PORT ?? "3000", 10);
  const server = Bun.serve({
    fetch: app.fetch.bind(app),
    port,
  });
  return server;
}

// CLI entry point: `bun run packages/api/src/index.ts`
if (import.meta.main) {
  const server = serveApp();
  console.log(`ANTS API listening on http://localhost:${server.port}`);
}
