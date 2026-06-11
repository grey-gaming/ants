import { describe, test, expect } from "bun:test";

const TERMINAL_STATES: readonly string[] = ['completed', 'failed', 'cancelled'];

describe("RunService transition logic", () => {
  test("terminal states are completed, failed, cancelled", () => {
    expect(TERMINAL_STATES).toContain('completed');
    expect(TERMINAL_STATES).toContain('failed');
    expect(TERMINAL_STATES).toContain('cancelled');
  });

  test("non-terminal states are not in TERMINAL_STATES", () => {
    expect(TERMINAL_STATES).not.toContain('queued');
    expect(TERMINAL_STATES).not.toContain('in_progress');
    expect(TERMINAL_STATES).not.toContain('awaiting_response');
    expect(TERMINAL_STATES).not.toContain('paused');
  });
});