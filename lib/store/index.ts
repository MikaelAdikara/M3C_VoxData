import { getMemoryStore } from "@/lib/store/memory";
import type { StoreSnapshot } from "@/lib/types";

export interface LearningLineStore {
  getSnapshot(): Promise<StoreSnapshot>;
  mutate<T>(mutation: (draft: StoreSnapshot) => T | Promise<T>): Promise<T>;
  reset(): Promise<StoreSnapshot>;
}

export function getStore(): LearningLineStore {
  return getMemoryStore();
}
