-- Seed script: Register all builtin tools in the DB
-- Run with: psql $DATABASE_URL -f packages/store/seed/tools.sql

-- Builtin tools (type='builtin' means they're provided by the framework)
-- Each entry mirrors the tool in packages/tools/src/tools/

INSERT INTO tools (name, description, type, parameters_schema, active, created_by, updated_by)
VALUES
  ('web-search',
   'Search the web for information. Returns up to 5 results with titles, URLs, and descriptions.',
   'builtin',
   '{"type":"object","properties":{"query":{"type":"string"},"numResults":{"type":"number"}},"required":["query"]}',
   true, NULL, NULL),

  ('calculator',
   'Perform mathematical calculations. Supports basic arithmetic (+, -, *, /, %), exponentiation (^), and common math functions (sqrt, sin, cos, tan, log, ln, abs, round, floor, ceil, pi, e, pow, max, min).',
   'builtin',
   '{"type":"object","properties":{"expression":{"type":"string"}},"required":["expression"]}',
   true, NULL, NULL),

  ('time-date',
   'Get current date and time, convert between timezones, format dates, or calculate durations between dates. Supports IANA timezone names.',
   'builtin',
   '{"type":"object","properties":{"action":{"type":"string"},"timezone":{"type":"string"},"datetime":{"type":"string"},"format":{"type":"string"},"fromTimezone":{"type":"string"},"toTimezone":{"type":"string"},"startDate":{"type":"string"},"endDate":{"type":"string"}},"required":["action"]}',
   true, NULL, NULL),

  ('file-read-write',
   'Read files, write files, and list directories. Actions: read, write, list. Paths should be absolute.',
   'builtin',
   '{"type":"object","properties":{"action":{"type":"string"},"path":{"type":"string"},"content":{"type":"string"},"recursive":{"type":"boolean"}},"required":["action","path"]}',
   true, NULL, NULL),

  ('shell-command',
   'Execute a shell command and return stdout/stderr. Commands run in a sandboxed subprocess with a timeout. Destructive commands are blocked.',
   'builtin',
   '{"type":"object","properties":{"command":{"type":"string"},"timeout":{"type":"number"}},"required":["command"]}',
   true, NULL, NULL),

  ('code-execution',
   'Execute Python code in a sandboxed subprocess. The code should print its output to stdout. Has a 30-second timeout. Cannot install packages or access the network.',
   'builtin',
   '{"type":"object","properties":{"code":{"type":"string"},"timeout":{"type":"number"}},"required":["code"]}',
   true, NULL, NULL),

  ('web-scraping',
   'Fetch and extract content from a web URL. Returns the page content as cleaned text. Supports HTML and plain text pages. Has a 15-second timeout.',
   'builtin',
   '{"type":"object","properties":{"url":{"type":"string"},"maxChars":{"type":"number"}},"required":["url"]}',
   true, NULL, NULL),

  ('memory-vector',
   'Store and retrieve information using keyword search. Actions: store, search, list, delete.',
   'builtin',
   '{"type":"object","properties":{"action":{"type":"string"},"content":{"type":"string"},"query":{"type":"string"},"tags":{"type":"array"},"limit":{"type":"number"},"memoryId":{"type":"string"}},"required":["action"]}',
   true, NULL, NULL),

  ('sql-query',
   'Execute read-only SQL queries on a PostgreSQL database. Only SELECT statements are allowed. Results are returned as an array of row objects.',
   'builtin',
   '{"type":"object","properties":{"query":{"type":"string"},"limit":{"type":"number"}},"required":["query"]}',
   true, NULL, NULL),

  ('weather',
   'Get current weather data for a location. Requires OPENWEATHER_API_KEY environment variable. Supports city name or lat/lon coordinates.',
   'builtin',
   '{"type":"object","properties":{"location":{"type":"string"},"unit":{"type":"string"}},"required":["location"]}',
   true, NULL, NULL),

  ('image-generation',
   'Generate images from text descriptions. Uses draw-things-cli for local generation on macOS. Falls back to a helpful error if not available.',
   'builtin',
   '{"type":"object","properties":{"prompt":{"type":"string"},"width":{"type":"number"},"height":{"type":"number"},"steps":{"type":"number"},"seed":{"type":"number"},"model":{"type":"string"}},"required":["prompt"]}',
   true, NULL, NULL)

ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parameters_schema = EXCLUDED.parameters_schema,
  type = EXCLUDED.type;
