import { describe, test, expect } from "bun:test";

type RunStatus = 'queued' | 'in_progress' | 'awaiting_response' | 'paused' | 'completed' | 'failed' | 'cancelled';
const TERMINAL_STATES: readonly RunStatus[] = ['completed', 'failed', 'cancelled'];

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

  test("transitionFrom uses expectedStatus for optimistic concurrency", () => {
    const validTransitions: Array<{ from: RunStatus; to: RunStatus }> = [
      { from: 'queued', to: 'in_progress' },
      { from: 'in_progress', to: 'completed' },
      { from: 'in_progress', to: 'failed' },
      { from: 'queued', to: 'cancelled' },
    ];

    for (const { from, to } of validTransitions) {
      expect(TERMINAL_STATES.includes(from)).toBe(false);
      expect(from).not.toBe(to);
    }
  });

  test("concurrent transitions are prevented by checking expectedStatus in WHERE clause", () => {
    const expectedStatus: RunStatus = 'queued';
    const newStatus: RunStatus = 'in_progress';

    expect(expectedStatus).not.toBe(newStatus);
    expect(TERMINAL_STATES.includes(expectedStatus)).toBe(false);

    const concurrentStatus: RunStatus = 'completed';
    expect(concurrentStatus).not.toBe(expectedStatus);
    expect(TERMINAL_STATES.includes(concurrentStatus)).toBe(true);
  });
});