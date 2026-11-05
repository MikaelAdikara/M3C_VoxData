import { LiveRefresh } from "@/components/live/LiveRefresh";
import { SignalsScreen } from "@/components/signals/SignalsScreen";
import { getCurrentRole, getSignalsView } from "@/lib/queries";

export const metadata = { title: "Line signals · Learning Line" };

export default async function SignalsPage() {
  const [view, role] = await Promise.all([getSignalsView(), getCurrentRole()]);
  return (
    <>
      <LiveRefresh />
      <SignalsScreen view={view} canWalkCheck={role === "operator" || role === "team_leader"} />
    </>
  );
}
