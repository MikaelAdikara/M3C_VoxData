import Link from "next/link";

import { TICKET_LABEL } from "@/components/kaizen/labels";
import { RoleGate } from "@/components/live/RoleGate";
import { Badge, LoopBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { getCurrentRole, getKaizenView } from "@/lib/queries";

export const metadata = { title: "Kaizen · Learning Line" };

export default async function KaizenPage() {
  const [view, role] = await Promise.all([getKaizenView(), getCurrentRole()]);
  const max = Math.max(1, ...view.pareto.map((p) => p.count));
  const total = view.pareto.reduce((t, p) => t + p.count, 0);

  return (
    <main className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Kaizen cockpit</h1>
          <p className="page__sub">Sealer process · owner role:engineer@body</p>
        </div>
        <LoopBadge loop="kaizen" />
      </div>

      <RoleGate need="engineer" current={role}>
        The owner engineer writes the A3 and moves the ticket on.
      </RoleGate>

      <div className="cockpit">
        <section className="panel" aria-labelledby="pareto-title">
          <div className="panel__head">
            <h2 id="pareto-title">Confirmed defects</h2>
            <span className="muted">Last 30 days · {total.toLocaleString("en-GB")} total</span>
          </div>
          <div className="panel__body pareto">
            {view.pareto.length === 0 ? (
              <EmptyState title="No confirmed defects in the last 30 days" />
            ) : (
              view.pareto.map((p) => (
                <div key={p.defectType.id} className="pareto__row" data-crit={p.defectType.criticality === "leak_critical" || undefined}>
                  <span className="pareto__name">
                    {p.defectType.criticality === "leak_critical" ? (
                      <span className="pareto__crit" title="Leak-critical">
                        <Icon name="drop" weight="bold" />
                        <span className="sr-only">Leak-critical</span>
                      </span>
                    ) : null}
                    {p.defectType.name}
                  </span>
                  <span className="pareto__track">
                    <span className="pareto__bar" style={{ width: `${(p.count / max) * 100}%` }} />
                  </span>
                  <span className="num pareto__val">
                    {p.count} <small>({Math.round((p.count / total) * 100)}%)</small>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel" aria-labelledby="tickets-title">
          <div className="panel__head">
            <h2 id="tickets-title">Open tickets</h2>
            <Badge tone="outline">{view.tickets.length} open</Badge>
          </div>
          <div className="panel__body">
            {view.tickets.length === 0 ? (
              <EmptyState title="No open tickets">
                A ticket opens automatically on the third confirmed repeat of a defect at one station in a shift.
              </EmptyState>
            ) : (
              <ul className="ticket-list">
                {view.tickets.map((t) => (
                  <li key={t.id}>
                    <Link href={`/kaizen/${t.id}`} className="ticket-row">
                      <span className="ticket-row__id mono">{t.id}</span>
                      <span className="ticket-row__what">
                        {t.defectType.name} · {t.stationId}
                        <small>{t.ownerRole}</small>
                      </span>
                      <span className="ticket-row__status">
                        {t.defectType.criticality === "leak_critical" ? (
                          <Badge tone="stop" icon={<Icon name="drop" weight="bold" />}>
                            Leak-critical
                          </Badge>
                        ) : null}
                        <Badge tone="outline">{TICKET_LABEL[t.status]}</Badge>
                      </span>
                      <Icon name="arrow-right" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
