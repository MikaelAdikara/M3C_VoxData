"use client";

import { useState, useTransition } from "react";

import { actorLabel, plantTime } from "@/components/format";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { sendTestEvent } from "@/lib/actions/events";
import type { EventsView } from "@/lib/types";

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
const dayOf = (iso: string) => dayFmt.format(new Date(iso));

const TYPE_LABEL: Record<EventsView["events"][number]["type"], string> = {
  "alert.raised": "Alert raised",
  "andon.yellow": "Yellow andon",
  "alert.rejected": "Alert rejected",
  "decision.team_leader": "Team-leader decision",
  "ticket.opened": "Kaizen ticket",
  "card.validated": "Card validated",
};

const TYPE_TONE: Partial<Record<EventsView["events"][number]["type"], string>> = {
  "andon.yellow": "badge--caution",
  "card.validated": "badge--safe",
  "ticket.opened": "badge--instruct",
};

export function EventsScreen({ view }: { view: EventsView }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<string>("all");
  const { webhook } = view;
  const shown = filter === "all" ? view.events : view.events.filter((e) => e.type === filter);
  const topDay = view.events[0] ? dayOf(view.events[0].timestamp) : "";

  return (
    <main className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Event outbox</h1>
          <p className="page__sub">
            Every alert, operator decision, team-leader decision, Kaizen ticket and validated card as one JSON event. Actors are roles, never names.
          </p>
        </div>
      </div>

      <section className="panel ev-hook" aria-labelledby="hook-title">
        <div className="panel__head">
          <h2 id="hook-title">Workflow webhook</h2>
          <span className={`badge ${webhook.configured ? "badge--safe" : "badge--outline"}`}>
            {webhook.configured ? `On · ${webhook.host}` : "Off"}
          </span>
        </div>
        <div className="panel__body ev-hook__body">
          <p>
            {webhook.configured
              ? `New events are posted to ${webhook.host}${webhook.signed ? " with an HMAC signature" : ""} as they happen, for a workflow tool such as n8n: for example a yellow andon becomes a Telegram message to the team-leader group.`
              : "Off in this demo, so no event leaves the app. In the plant, events go to the team's workflow tool: for example, a yellow andon becomes a Telegram message to the team-leader group."}
          </p>
          {webhook.lastDelivery ? (
            <p className="muted">
              Last delivery from this server: {plantTime(webhook.lastDelivery.at).slice(0, 8)}, {webhook.lastDelivery.events} event
              {webhook.lastDelivery.events === 1 ? "" : "s"}, {webhook.lastDelivery.ok ? "accepted" : `failed (${webhook.lastDelivery.error})`}.
            </p>
          ) : null}
          <div className="ev-hook__actions">
            <Button
              variant="ghost"
              disabled={!webhook.configured || pending}
              onClick={() => {
                setMessage(null);
                start(async () => {
                  const r = await sendTestEvent();
                  setMessage(r.ok ? "Test event accepted by the webhook." : r.error);
                });
              }}
              icon={<Icon name="paper-plane-tilt" />}
            >
              Send test event
            </Button>
            {message ? <span role="status">{message}</span> : null}
          </div>
        </div>
      </section>

      <section className="panel" aria-labelledby="ev-title">
        <div className="panel__head">
          <h2 id="ev-title">Latest events <span className="muted num">({shown.length} of {view.total}, incl. 30 days of simulated history)</span></h2>
          <label className="ev-filter">
            <span className="sr-only">Event type</span>
            <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All types</option>
              {view.counts.map((c) => (
                <option key={c.type} value={c.type}>{TYPE_LABEL[c.type as keyof typeof TYPE_LABEL] ?? c.type} ({c.count})</option>
              ))}
            </select>
          </label>
        </div>
        <ol className="ev-list">
          {shown.map((e) => (
            <li key={e.id}>
              <details>
                <summary>
                  <span className="num ev-time">{dayOf(e.timestamp) === topDay ? "" : `${dayOf(e.timestamp)} `}{plantTime(e.timestamp).slice(0, 5)}</span>
                  <span className={`badge ${TYPE_TONE[e.type] ?? "badge--outline"}`}>{TYPE_LABEL[e.type]}</span>
                  <span className="mono muted">{e.stationId ?? "plant"}</span>
                  <span className="ev-sum">{e.summary}</span>
                  <span className="muted ev-actor">{actorLabel(e.actor)}</span>
                </summary>
                <pre className="ev-json">{e.json}</pre>
              </details>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
