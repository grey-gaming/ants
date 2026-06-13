import type { QueueWorker } from "@ants/core";

export interface WorkerManager {
  getStatus(): { activeRuns: number; queueDepth: number; running: boolean };
}

export function createWorkerManager(worker: QueueWorker): WorkerManager {
  return {
    getStatus() {
      const status = worker.getStatus();
      return {
        activeRuns: status.activeRuns,
        queueDepth: 0,
        running: status.running,
      };
    },
  };
}
