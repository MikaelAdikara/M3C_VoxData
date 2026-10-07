import { createSeedData } from "@/lib/seed";
import { normalizeSnapshot } from "@/lib/store/normalize";
import type { LearningLineStore } from "@/lib/store";
import type { StoreSnapshot } from "@/lib/types";

function cloneSnapshot(snapshot: StoreSnapshot): StoreSnapshot {
  return structuredClone(snapshot);
}

export class MemoryStore implements LearningLineStore {
  private state: StoreSnapshot;
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(seed: StoreSnapshot = createSeedData()) {
    this.state = cloneSnapshot(normalizeSnapshot(seed));
  }

  async getSnapshot(): Promise<StoreSnapshot> {
    return cloneSnapshot(this.state);
  }

  async mutate<T>(mutation: (draft: StoreSnapshot) => T | Promise<T>): Promise<T> {
    const operation = this.mutationQueue.then(async () => {
      const draft = cloneSnapshot(this.state);
      const result = await mutation(draft);
      this.state = draft;
      return result;
    });

    this.mutationQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async reset(): Promise<StoreSnapshot> {
    const operation = this.mutationQueue.then(() => {
      this.state = createSeedData();
      return cloneSnapshot(this.state);
    });
    this.mutationQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }
}

const globalStore = globalThis as typeof globalThis & {
  learningLineMemoryStore?: MemoryStore;
};

export function getMemoryStore(): MemoryStore {
  globalStore.learningLineMemoryStore ??= new MemoryStore();
  return globalStore.learningLineMemoryStore;
}

export async function resetMemoryStore(): Promise<StoreSnapshot> {
  return getMemoryStore().reset();
}
