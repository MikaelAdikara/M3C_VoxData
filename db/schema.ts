import {
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import type { A3 } from "@/lib/types";

export const stations = pgTable("stations", {
  id: text("id").primaryKey(),
  line: text("line").notNull(),
  area: text("area").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
});

export const defectTypes = pgTable("defect_types", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  criticality: text("criticality").notNull(),
});

export const alerts = pgTable("alerts", {
  id: text("id").primaryKey(),
  stationId: text("station_id").notNull(),
  bodyId: text("body_id").notNull(),
  roi: text("roi").notNull(),
  defectTypeId: text("defect_type_id"),
  anomalyScore: real("anomaly_score").notNull(),
  threshold: real("threshold").notNull(),
  modelVersion: text("model_version").notNull(),
  image: text("image").notNull(),
  mask: text("mask").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  status: text("status").notNull(),
});

export const decisions = pgTable("decisions", {
  id: text("id").primaryKey(),
  alertId: text("alert_id").notNull(),
  actorRole: text("actor_role").notNull(),
  kind: text("kind").notNull(),
  reasonCode: text("reason_code"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const tickets = pgTable("tickets", {
  id: text("id").primaryKey(),
  stationId: text("station_id").notNull(),
  defectTypeId: text("defect_type_id").notNull(),
  triggerAlertIds: text("trigger_alert_ids").array().notNull(),
  ownerRole: text("owner_role").notNull(),
  status: text("status").notNull(),
  a3: jsonb("a3").$type<A3>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true, mode: "string" }),
});

export const cards = pgTable(
  "cards",
  {
    id: text("id").notNull(),
    revision: integer("revision").notNull(),
    status: text("status").notNull(),
    process: text("process").notNull(),
    stationIds: text("station_ids").array().notNull(),
    variants: text("variants").array().notNull(),
    factor4m: text("factor_4m").notNull(),
    symptom: text("symptom").notNull(),
    rootCause: text("root_cause").notNull(),
    countermeasure: text("countermeasure").notNull(),
    standardRevised: text("standard_revised").notNull(),
    validatedByRole: text("validated_by_role"),
    validatedAt: timestamp("validated_at", { withTimezone: true, mode: "string" }),
    sourceTicketId: text("source_ticket_id"),
  },
  (table) => [primaryKey({ columns: [table.id, table.revision] })],
);

export const ideas = pgTable("ideas", {
  id: text("id").primaryKey(),
  stationId: text("station_id").notNull(),
  text: text("text").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  answeredAt: timestamp("answered_at", { withTimezone: true, mode: "string" }),
});

export const modelReviews = pgTable("model_reviews", {
  id: text("id").primaryKey(),
  stationId: text("station_id").notNull(),
  alertIds: text("alert_ids").array().notNull(),
  status: text("status").notNull(),
});
