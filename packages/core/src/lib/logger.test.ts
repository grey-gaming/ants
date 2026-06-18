import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { logger, setLogLevel } from "./logger";

describe("logger", () => {
  let outputs: string[];
  let originalWrite: typeof process.stdout.write;

  beforeEach(() => {
    outputs = [];
    originalWrite = process.stdout.write;
    process.stdout.write = (text: string | Uint8Array) => {
      if (typeof text === "string") {
        outputs.push(text);
      }
      return true;
      };
     });

  afterEach(() => {
    process.stdout.write = originalWrite;
    });

  test("outputs valid JSON with all 10 fields", () => {
    logger.info("test-service", "hello world");
    expect(outputs.length).toBe(1);
    const entry = JSON.parse(outputs[0]);
    expect(entry.timestamp).toBeDefined();
    expect(entry.level).toBe("info");
    expect(entry.service).toBe("test-service");
    expect(entry.trace_id).toBeNull();
    expect(entry.user_id).toBeNull();
    expect(entry.thread_id).toBeNull();
    expect(entry.run_id).toBeNull();
    expect(entry.agent_type).toBeNull();
    expect(entry.message).toBe("hello world");
    });

  test("passes through context fields", () => {
    logger.info("svc", "msg", {
      trace_id: "t-1",
      user_id: "u-1",
      thread_id: "th-1",
      run_id: "r-1",
      agent_type: "T1",
      });
    const entry = JSON.parse(outputs[0]);
    expect(entry.trace_id).toBe("t-1");
    expect(entry.user_id).toBe("u-1");
    expect(entry.thread_id).toBe("th-1");
    expect(entry.run_id).toBe("r-1");
    expect(entry.agent_type).toBe("T1");
    });

  test("debug level method exists and doesn't throw", () => {
    expect(() => logger.debug("svc", "debug msg")).not.toThrow();
    });

  test("details are passed through", () => {
    logger.error("svc", "error msg", { details: { reason: "timeout" } });
    const entry = JSON.parse(outputs[outputs.length - 1]);
    expect(entry.details).toEqual({ reason: "timeout" });
    });

  test("all level methods work", () => {
      // debug is filtered out when LOG_LEVEL=info (the default)
    logger.info("svc", "i");
    logger.warn("svc", "w");
    logger.error("svc", "e");

    const lastThree = outputs.slice(-3);
    const levels = lastThree.map((o) => JSON.parse(o).level);
    expect(levels).toContain("info");
    expect(levels).toContain("warn");
    expect(levels).toContain("error");
     });

  test("debug is suppressed when log level is info", () => {
    setLogLevel("info");
    const beforeCount = outputs.length;
    logger.debug("svc", "d");
    expect(outputs.length).toBe(beforeCount);
     });
});
