import { createSeedData } from "@/lib/seed";
import type { LearningLineStore } from "@/lib/store";
import type { StoreSnapshot } from "@/lib/types";

function cloneSnapshot(snapshot: StoreSnapshot): StoreSnapshot {
  return structuredClone(snapshot);
}

export class MemoryStore implements LearningLineStore {
  private state: StoreSnapshot;

  constructor(seed: StoreSnapshot = createSeedData()) {
    this.state = cloneSnapshot(seed);
  }

  async getSnapshot(): Promise<StoreSnapshot> {
    return cloneSnapshot(this.state);
  }

  async reset(): Promise<StoreSnapshot> {
    this.state = createSeedData();
    return this.getSnapshot();
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
