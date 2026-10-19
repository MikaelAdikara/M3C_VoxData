import { buildGuideProgress } from "@/lib/guide/progress";
import { getCurrentRole } from "@/lib/queries";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** The visitor's guided-demo progress, read from their own demo state. */
export async function GET(): Promise<Response> {
  const [snapshot, role] = await Promise.all([getStore().getSnapshot(), getCurrentRole()]);
  return Response.json(buildGuideProgress(snapshot, role), { headers: { "Cache-Control": "no-store" } });
}
