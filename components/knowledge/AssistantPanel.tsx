"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { routeToOwner } from "@/lib/actions/knowledge";
import type { AssistantAnswer } from "@/lib/types";

const SUGGESTIONS = [
  "Thin bead at the start of shift on st-04, what do we do?",
  "Bead break near the right door after a nozzle change?",
  "Why are we getting false alarms on the grey sealer?",
  "How do we fix paint orange peel?",
];

const MODE_LABEL: Record<AssistantAnswer["mode"], string> = {
  live: "Live answer, checked against cited cards",
  offline: "Offline mode: quoted from the cited card",
  no_card: "No validated card",
};

/** Text with [CARD-ID rN] citations turned into chips that open the card. */
function CitedText({ text }: { text: string }) {
  const parts = text.split(/(\[[A-Z0-9-]+ r\d+\])/g);
  return (
    <p className="answer__text">
      {parts.map((part, i) => {
        const m = /^\[([A-Z0-9-]+) r(\d+)\]$/.exec(part);
        return m ? (
          <Link key={i} href={`/knowledge?card=${m[1]}`} className="cite">
            {m[1]} r{m[2]}
          </Link>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </p>
  );
}

/**
 * Assistant grounded in validated cards only. It cites every answer and,
 * when no card covers the question, offers to route it to the owner engineer.
 */
export function AssistantPanel() {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [routed, setRouted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [routing, start] = useTransition();

  async function ask(q: string) {
    const text = q.trim();
    if (!text) return;
    setQuestion(text);
    setAsked(text);
    setAnswer(null);
    setError(null);
    setRouted(false);
    setLoading(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "The assistant could not answer.");
      else setAnswer(data as AssistantAnswer);
    } catch {
      setError("The assistant is not reachable. Check the connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel assistant" aria-labelledby="assistant-title">
      <div className="panel__head">
        <h2 id="assistant-title">Ask the assistant</h2>
        <Badge tone="outline">Validated cards only</Badge>
      </div>
      <div className="panel__body ask">
        <form
          className="ask__form"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}
        >
          <label htmlFor="ask-q" className="sr-only">
            Question
          </label>
          <input
            id="ask-q"
            className="input"
            value={question}
            maxLength={500}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Describe the problem at the line"
            autoComplete="off"
          />
          <Button type="submit" aria-label="Ask" disabled={loading || !question.trim()} icon={<Icon name="arrow-right" weight="bold" />}>
            Ask
          </Button>
        </form>
        <div className="suggest">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => void ask(s)} disabled={loading}>
              {s}
            </button>
          ))}
        </div>

        <div aria-live="polite">
          {loading ? (
            <div className="answer" aria-busy="true">
              <p className="answer__q">{asked}</p>
              <div className="skeleton" style={{ height: 56 }} />
            </div>
          ) : error ? (
            <p className="form-error" role="alert">
              <Icon name="warning-circle" weight="bold" /> {error}
            </p>
          ) : answer ? (
            <div className="answer">
              <p className="answer__q">{asked}</p>
              {answer.mode === "no_card" ? (
                <div className="empty-answer">
                  <p>
                    <strong>No validated card covers this.</strong> The assistant does not guess.
                  </p>
                  {routed ? (
                    <p className="next">
                      <Icon name="check" weight="bold" />
                      <span>Routed to the owner engineer (role:engineer@body).</span>
                    </p>
                  ) : (
                    <Button
                      variant="ghost"
                      disabled={routing}
                      onClick={() =>
                        start(async () => {
                          const r = await routeToOwner(asked ?? "");
                          if (r.ok) setRouted(true);
                          else setError(r.error);
                        })
                      }
                      icon={<Icon name="arrow-bend-up-right" weight="bold" />}
                    >
                      Route to owner engineer
                    </Button>
                  )}
                </div>
              ) : (
                <CitedText text={answer.text} />
              )}
              <p className="answer__mode">{MODE_LABEL[answer.mode]}</p>
            </div>
          ) : null}
        </div>
        <p className="muted ask__foot">Answers quote validated cards and cite them. Line-stop decisions stay with the team leader.</p>
      </div>
    </section>
  );
}
