"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Source = { label: string; href: string };
type ChatEntry = { role: "user" | "assistant"; content: string; sources?: Source[] };
const SUGGESTIONS = [
  "What deserves my attention today?",
  "Compare my strongest saved prospects",
  "Which projects need watching?",
];

/** Admin-only AI drawer. All live data reads are independently authorized on
 * the server. Drafts and existing Muse tools remain separate and unchanged. */
export function MuseConcierge() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const scrollEnd = useRef<HTMLDivElement>(null);
  const page = usePathname() || "/muse";

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : trigger.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const focusables = [...panel.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], textarea:not([disabled]), input:not([disabled])',
      )].filter(el => el.getClientRects().length);
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (open) scrollEnd.current?.scrollIntoView({ block: "end", behavior: "instant" });
  }, [open, messages, busy]);

  async function ask(text: string) {
    const prompt = text.trim();
    if (busy || prompt.length < 2 || prompt.length > 1000) return;
    const history = messages.slice(-6).map(({ role, content }) => ({ role, content }));
    setMessages(previous => [...previous, { role: "user", content: prompt }]);
    setQuestion("");
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/muse-ai", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt, history, page }),
      });
      const data = await response.json() as { answer?: string; error?: string; sources?: Source[] };
      if (!response.ok || typeof data.answer !== "string") throw new Error(data.error || "Muse is unavailable.");
      setMessages(previous => [...previous, {
        role: "assistant", content: data.answer!.slice(0, 4800),
        sources: Array.isArray(data.sources) ? data.sources : [],
      }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Muse is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <div className="nhs-muse-area">
      <button ref={trigger} type="button" className="nhs-muse-shortcut" aria-expanded={open}
        aria-controls="nhs-muse-concierge" onClick={() => setOpen(v => !v)}>
        <span aria-hidden="true">✧</span> Muse AI
      </button>
      {open && (
        <div className="nhs-muse-overlay">
          <button className="nhs-muse-backdrop" type="button" aria-label="Close Muse" onClick={() => setOpen(false)} />
          <section ref={panel} id="nhs-muse-concierge" className="nhs-muse-drawer" role="dialog"
            aria-modal="true" aria-labelledby="nhs-muse-title" aria-describedby="nhs-muse-description">
            <header className="nhs-muse-drawer-head">
              <div>
                <p className="nhs-muse-overline">NINTH HEART · STUDIO INTELLIGENCE</p>
                <h2 id="nhs-muse-title"><span aria-hidden="true">✧</span> Muse AI</h2>
                <p id="nhs-muse-description">An intelligent second look. Your decisions stay yours.</p>
              </div>
              <button className="nhs-muse-close" type="button" aria-label="Close Muse" onClick={() => setOpen(false)}>×</button>
            </header>
            <div className="nhs-muse-conversation" role="log" aria-live="polite" aria-relevant="additions text">
              {!messages.length ? (
                <div className="nhs-muse-welcome">
                  <span className="nhs-muse-emblem" aria-hidden="true">✦</span>
                  <h3>What needs your attention?</h3>
                  <p>Ask about leads, saved prospects, project deadlines or opportunities.</p>
                  <div className="nhs-muse-prompts">
                    {SUGGESTIONS.map(prompt => (
                      <button type="button" key={prompt} disabled={busy} onClick={() => void ask(prompt)}>
                        {prompt} <span aria-hidden="true">↗</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : messages.map((message, index) => (
                <article className={`nhs-muse-message nhs-muse-${message.role}`} key={index}>
                  <p className="nhs-muse-speaker">{message.role === "user" ? "You" : "✧ Muse"}</p>
                  <p className="nhs-muse-message-text">{message.content}</p>
                  {message.role === "assistant" && !!message.sources?.length && (
                    <div className="nhs-muse-sources">
                      <span>Open the records</span>
                      {message.sources.map(source => (
                        <Link key={source.href} href={source.href} onClick={() => setOpen(false)}>
                          {source.label} ↗
                        </Link>
                      ))}
                    </div>
                  )}
                </article>
              ))}
              {busy && <p className="nhs-muse-thinking" role="status">✧ Reviewing your studio records…</p>}
              <div ref={scrollEnd} />
            </div>
            <div className="nhs-muse-composer">
              {error && <p role="alert" className="nhs-muse-error">{error}</p>}
              <form onSubmit={handleSubmit}>
                <label htmlFor="nhs-muse-question" className="nhs-muse-input-label">Ask Muse</label>
                <textarea id="nhs-muse-question" value={question} maxLength={1000}
                  onChange={event => setQuestion(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault(); if (question.trim()) void ask(question);
                    }
                  }}
                  rows={2} placeholder="What should I focus on next?" disabled={busy} autoFocus />
                <button className="nhs-muse-send" type="submit" disabled={busy || question.trim().length < 2}>
                  {busy ? "Thinking…" : "Ask Muse"} <span aria-hidden="true">↗</span>
                </button>
              </form>
              <p className="nhs-muse-disclaimer">
                Read-only · Records checked on demand · No automatic scans or messages
              </p>
              <Link className="nhs-muse-workspace-link" href="/muse" onClick={() => setOpen(false)}>
                Muse drafts & existing studio tools ↗
              </Link>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
