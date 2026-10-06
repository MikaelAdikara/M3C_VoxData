import { createSeedData } from "@/lib/seed";
import { getStore, getStoreBackend } from "@/lib/store";

async function main() {
  const seed = createSeedData();
  await getStore().reset();

  console.log(
    `Seeded deterministic ${getStoreBackend()} store: ${seed.stations.length} stations, ${seed.alerts.length} alerts, ${seed.tickets.length} tickets, ${seed.cards.length} cards, ${seed.ideas.length} ideas.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
