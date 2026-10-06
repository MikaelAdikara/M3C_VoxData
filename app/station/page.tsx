import { notFound } from "next/navigation";

import { LiveRefresh } from "@/components/live/LiveRefresh";
import { RoleGate } from "@/components/live/RoleGate";
import { StationScreen } from "@/components/station/StationScreen";
import { getCurrentRole, getStationView } from "@/lib/queries";

export const metadata = { title: "Station · Learning Line" };

export default async function StationPage({
  searchParams,
}: {
  searchParams: Promise<{ st?: string }>;
}) {
  const { st } = await searchParams;
  const [view, role] = await Promise.all([getStationView(st ?? "st-04"), getCurrentRole()]);
  if (!view) notFound();

  return (
    <>
      <LiveRefresh />
      <StationScreen
        view={view}
        canDecide={role === "operator"}
        notice={
          <RoleGate need="operator" current={role}>
            Only the operator at the station confirms or rejects an alert.
          </RoleGate>
        }
      />
    </>
  );
}
