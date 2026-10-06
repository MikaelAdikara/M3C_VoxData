import { LiveRefresh } from "@/components/live/LiveRefresh";
import { RoleGate } from "@/components/live/RoleGate";
import { ShiftBoardScreen } from "@/components/shift/ShiftBoardScreen";
import { getCurrentRole, getShiftBoardView } from "@/lib/queries";

export const metadata = { title: "Shift board · Learning Line" };

export default async function ShiftBoardPage() {
  const [view, role] = await Promise.all([getShiftBoardView(), getCurrentRole()]);

  return (
    <>
      <LiveRefresh />
      <ShiftBoardScreen
        view={view}
        canDecide={role === "team_leader"}
        notice={
          <RoleGate need="team_leader" current={role}>
            Only the team leader decides stop and fix, contain or continue.
          </RoleGate>
        }
      />
    </>
  );
}
