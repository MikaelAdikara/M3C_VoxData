import { EventsScreen } from "@/components/events/EventsScreen";
import { LiveRefresh } from "@/components/live/LiveRefresh";
import { getEventsView } from "@/lib/queries";

export const metadata = { title: "Event outbox · Learning Line" };

export default async function EventsPage() {
  return (
    <>
      <LiveRefresh intervalMs={4000} />
      <EventsScreen view={await getEventsView()} />
    </>
  );
}
