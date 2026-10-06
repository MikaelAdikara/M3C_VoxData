import { createSeedData } from "@/lib/seed";
import { resetMemoryStore } from "@/lib/store/memory";

async function main() {
  const seed = createSeedData();
  await resetMemoryStore();

  console.log(
    `Seeded deterministic memory store: ${seed.stations.length} stations, ${seed.alerts.length} alerts, ${seed.tickets.length} tickets, ${seed.cards.length} cards, ${seed.ideas.length} ideas.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
