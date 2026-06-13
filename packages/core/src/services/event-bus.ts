import type { RunEvent } from "./run-executor";

type Subscriber = {
  filter: string;
  cb: (event: RunEvent) => void;
};

const subscribers: Subscriber[] = [];

function matches(filter: string, event: RunEvent): boolean {
  if (filter === "*") return true;
  if (filter.endsWith("*")) {
    return event.type.startsWith(filter.slice(0, -1));
  }
  return filter === event.type;
}

export const eventBus = {
  on(eventFilter: string, cb: (event: RunEvent) => void): () => void {
    const sub: Subscriber = { filter: eventFilter, cb };
    subscribers.push(sub);
    return () => {
      const idx = subscribers.indexOf(sub);
      if (idx >= 0) subscribers.splice(idx, 1);
    };
  },

  emit(event: RunEvent): void {
    for (const sub of subscribers) {
      if (matches(sub.filter, event)) {
        try {
          sub.cb(event);
        } catch {
          // A crashing subscriber must not block others
        }
      }
    }
  },
};
