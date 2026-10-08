import { notFound } from "next/navigation";

import { LiveRefresh } from "@/components/live/LiveRefresh";
import { RoleGate } from "@/components/live/RoleGate";
import { StationScreen } from "@/components/station/StationScreen";
import { getCameraView, getCurrentRole, getStationView } from "@/lib/queries";

export const metadata = { title: "Station · Learning Line" };

export default async function StationPage({
  searchParams,
}: {
  searchParams: Promise<{ st?: string }>;
}) {
  const { st } = await searchParams;
  const stationId = st ?? "st-04";
  const [view, role, cameras] = await Promise.all([getStationView(stationId), getCurrentRole(), getCameraView()]);
  if (!view) notFound();
  const camera = cameras.cameras.find((c) => c.stationId === stationId) ?? null;

  return (
    <>
      <LiveRefresh />
      <StationScreen
        view={view}
        camera={camera}
        cameraEvents={camera ? cameras.events.filter((e) => e.cameraId === camera.id) : []}
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
