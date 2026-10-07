import { CamerasScreen } from "@/components/cctv/CamerasScreen";
import { LiveRefresh } from "@/components/live/LiveRefresh";
import { getCameraView, getCurrentRole } from "@/lib/queries";

export const metadata = { title: "Cameras · Learning Line" };

export default async function CamerasPage() {
  const [view, role] = await Promise.all([getCameraView(), getCurrentRole()]);

  return (
    <>
      <LiveRefresh intervalMs={4000} />
      <CamerasScreen view={view} canTicket={role === "team_leader" || role === "engineer"} />
    </>
  );
}
