import { Hono } from "hono";
import type { Env } from "hono/types";
import { config, logger } from "@ants/core";

type AppEnv = Env & { Variables: { userId: string } };

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
}

export function createModelRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/", async (c) => {
    const models: ModelInfo[] = [];

    // Fetch from Ollama
    try {
      const ollamaUrl = config.ollamaBaseUrl.replace(/\/+$/, "");
      const ollamaRes = await fetch(`${ollamaUrl}/api/tags`);
      if (ollamaRes.ok) {
        const data = await ollamaRes.json();
        for (const model of data.models ?? []) {
          models.push({
            id: model.name,
            name: model.name,
            provider: "ollama",
          });
        }
      }
    } catch (err) {
      logger.warn("models", `Ollama fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Fetch from MLX (OpenAI-compatible /v1/models)
    const mlxBaseUrl = process.env.MLX_BASE_URL;
    if (mlxBaseUrl) {
      try {
        const mlxUrl = mlxBaseUrl.replace(/\/+$/, "");
        const mlxRes = await fetch(`${mlxUrl}/v1/models`);
        if (mlxRes.ok) {
          const data = await mlxRes.json();
          for (const model of data.data ?? []) {
            models.push({
              id: model.id,
              name: model.id,
              provider: "mlx",
            });
          }
        }
      } catch (err) {
        logger.warn("models", `MLX fetch failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return c.json(models, 200);
  });

  return app;
}
