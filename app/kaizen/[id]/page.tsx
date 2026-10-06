import { notFound } from "next/navigation";

import { TicketScreen } from "@/components/kaizen/TicketScreen";
import { RoleGate } from "@/components/live/RoleGate";
import { getCurrentRole, getTicketView } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `${id} · Kaizen · Learning Line` };
}

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [view, role] = await Promise.all([getTicketView(id), getCurrentRole()]);
  if (!view) notFound();

  return (
    <TicketScreen
      view={view}
      canEdit={role === "engineer"}
      notice={
        <RoleGate need="engineer" current={role}>
          Only the owner engineer writes the A3, starts the trial and requests validation.
        </RoleGate>
      }
    />
  );
}
