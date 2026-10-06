import Link from "next/link";

import { CARD_STATUS_LABEL } from "@/components/kaizen/labels";
import { AssistantPanel } from "@/components/knowledge/AssistantPanel";
import { CardDetail } from "@/components/knowledge/CardDetail";
import { RoleGate } from "@/components/live/RoleGate";
import { Badge, LoopBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { getCurrentRole, getKnowledgeView } from "@/lib/queries";
import type { CardStatus, KnowledgeFilters } from "@/lib/types";

export const metadata = { title: "Knowledge · Learning Line" };

const STATUSES: CardStatus[] = ["validated", "draft", "retired"];

type Search = { status?: string; station?: string; card?: string };

function href(current: Search, patch: Partial<Search>) {
  const next = { ...current, ...patch };
  const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
  const s = qs.toString();
  return s ? `/knowledge?${s}` : "/knowledge";
}

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const filters: KnowledgeFilters = {
    status: STATUSES.includes(sp.status as CardStatus) ? (sp.status as CardStatus) : undefined,
    stationId: sp.station || undefined,
  };
  const [view, all, role] = await Promise.all([getKnowledgeView(filters), getKnowledgeView(), getCurrentRole()]);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, all.cards.filter((c) => c.status === s).length]));
  // Open the requested card, else the first draft waiting for the senior expert, else the first card.
  const selected =
    all.cards.find((c) => c.id === sp.card) ??
    view.cards.find((c) => c.status === "draft") ??
    view.cards[0] ??
    null;

  return (
    <main className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Knowledge cards</h1>
          <p className="page__sub">{all.cards.length} cards · the assistant reads validated cards only</p>
        </div>
        <LoopBadge loop="kaizen" />
      </div>

      <RoleGate need="senior_expert" current={role}>
        Only the senior expert validates or returns a card. Anyone can ask the assistant.
      </RoleGate>

      <div className="kb">
        <section className="panel" aria-labelledby="cards-title">
          <div className="panel__head">
            <h2 id="cards-title">Cards</h2>
            <span className="muted">
              Showing {view.cards.length} of {all.cards.length}
            </span>
          </div>
          <div className="panel__body">
            <nav className="filters" aria-label="Filter by status">
              <Link className="choice" aria-current={!filters.status ? "true" : undefined} href={href(sp, { status: undefined, card: undefined })}>
                All <span className="num muted">{all.cards.length}</span>
              </Link>
              {STATUSES.map((s) => (
                <Link
                  key={s}
                  className="choice"
                  aria-current={filters.status === s ? "true" : undefined}
                  href={href(sp, { status: s, card: undefined })}
                >
                  {CARD_STATUS_LABEL[s]} <span className="num muted">{counts[s]}</span>
                </Link>
              ))}
            </nav>
            <nav className="filters filters--stations" aria-label="Filter by station">
              <Link className="choice" aria-current={!filters.stationId ? "true" : undefined} href={href(sp, { station: undefined, card: undefined })}>
                All stations
              </Link>
              {all.filters.stations.map((st) => (
                <Link
                  key={st.id}
                  className="choice"
                  aria-current={filters.stationId === st.id ? "true" : undefined}
                  href={href(sp, { station: st.id, card: undefined })}
                >
                  {st.id}
                </Link>
              ))}
            </nav>
            {view.cards.length === 0 ? (
              <EmptyState icon="books" title="No cards match these filters">
                <Link href="/knowledge">Clear filters</Link>
              </EmptyState>
            ) : (
              <ul className="card-list">
                {view.cards.map((c) => (
                  <li key={c.id} data-status={c.status}>
                    <Link href={href(sp, { card: c.id })} aria-current={selected?.id === c.id ? "true" : undefined}>
                      <span className="card-list__top">
                        <span className="mono">
                          {c.id} r{c.revision}
                        </span>
                        {c.status === "validated" ? (
                          <Badge tone="safe" icon={<Icon name="seal-check" weight="bold" />}>
                            Validated
                          </Badge>
                        ) : c.status === "draft" ? (
                          <Badge tone="outline">{c.returnedComment ? "Returned" : "Draft"}</Badge>
                        ) : (
                          <Badge>Retired</Badge>
                        )}
                      </span>
                      <span className="card-list__sym">
                        {c.symptom} · {c.stationIds.join(", ")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section aria-label="Selected card">
          {selected ? (
            <CardDetail key={`${selected.id}-${selected.revision}-${selected.returnedAt ?? ""}`} card={selected} canValidate={role === "senior_expert"} />
          ) : (
            <EmptyState icon="books" title="No card selected" />
          )}
        </section>

        <AssistantPanel />
      </div>
    </main>
  );
}
