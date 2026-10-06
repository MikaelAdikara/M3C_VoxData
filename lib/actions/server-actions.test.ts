import { describe, expect, it } from "vitest";

import * as alertActions from "@/lib/actions/alerts";
import * as ideaActions from "@/lib/actions/ideas";
import * as kaizenActions from "@/lib/actions/kaizen";
import * as knowledgeActions from "@/lib/actions/knowledge";
import * as roleActions from "@/lib/actions/role";
import * as shiftActions from "@/lib/actions/shift";
import * as simulatorActions from "@/lib/actions/simulator";

describe("server action module exports", () => {
  it.each([
    ["alerts", alertActions],
    ["ideas", ideaActions],
    ["kaizen", kaizenActions],
    ["knowledge", knowledgeActions],
    ["role", roleActions],
    ["shift", shiftActions],
    ["simulator", simulatorActions],
  ])("exports only async functions from %s", (_name, actions) => {
    expect(Object.keys(actions).length).toBeGreaterThan(0);
    for (const action of Object.values(actions)) {
      expect(typeof action).toBe("function");
      expect(action.constructor.name).toBe("AsyncFunction");
    }
  });
});
