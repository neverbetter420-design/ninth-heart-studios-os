"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Source = { label: string; href: string };
type Coverage = { area: string; available: number | null; reviewed: number; complete: boolean };
type ChatEntry = { role: "user" | "assistant"; content: string; sources?: Source[]; coverage?: Coverage[]; partial?: boolean };
function suggestions(page: string) {
  if (/^\/projects\//.test(page)) return ["What is this project's Heartbeat and One Move?", "Walk me through the strongest next task", "Which tasks and approvals are still open?"];
  if (page.startsWith("/leads/discover")) return ["Compare my strongest saved prospects by category", "Why is my best prospect ranked first?", "Where is my prospect evidence weak?"];
  if (page.startsWith("/opportunities")) return ["Which saved opportunities fit NHS best?", "Compare the recorded marketplace sources", "What evidence is missing before I bid?"];
  return ["What deserves my attention today?", "Compare my strongest saved prospects", "Which projects need watching?"];
}

/** Admin-only AI drawer. All live data reads are independently authorized on
 * the server. Drafts and existing Muse tools remain separate and unchanged. */
export function MuseConcierge({ previewOpen = false }: { previewOpen?: boolean } = {}) {
  const [open, setOpen] = useState(previewOpen);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const scrollEnd = useRef<HTMLDivElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const page = usePathname() || "/muse";

  useEffect(() => {
    if (!open) return;
    const previous = trigger.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Keep the dialog's ancestor path active while making every background
    // sibling inert to pointer, keyboard and assistive-technology navigation.
    const background: { element: HTMLElement; inert: boolean }[] = [];
    let branch = panel.current?.parentElement;
    while (branch?.parentElement && branch.parentElement !== document.documentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          background.push({ element: sibling, inert: sibling.inert }); sibling.inert = true;
        }
      }
      branch = branch.parentElement;
    }
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
      if (!panel.current.contains(document.activeElement)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      for (const item of background) item.element.inert = item.inert;
      previous?.focus();
    };
  }, [open]);

  useEffect(() => () => activeRequest.current?.abort(), []);

  useEffect(() => {
    if (open) scrollEnd.current?.scrollIntoView({ block: "end", behavior: "instant" });
  }, [open, messages, busy]);

  async function ask(text: string) {
    const prompt = text.trim();
    if (activeRequest.current || prompt.length < 2 || prompt.length > 1000) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    const history = messages.slice(-6).map(({ role, content }) => ({ role, content: content.slice(0, 1500) }));
    while (history.length && new TextEncoder().encode(JSON.stringify({ question: prompt, history, page })).byteLength > 12000) history.shift();
    setMessages(previous => [...previous.slice(-29), { role: "user", content: prompt }]);
    setQuestion("");
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/muse-ai", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(50000)]),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt, history, page }),
      });
      const data = await response.json() as { answer?: string; error?: string; sources?: Source[]; coverage?: Coverage[]; partial?: boolean };
      if (!response.ok || typeof data.answer !== "string") throw new Error(data.error || "Muse is unavailable.");
      if (activeRequest.current !== controller) return;
      setMessages(previous => [...previous, {
        role: "assistant", content: data.answer!.slice(0, 4800),
        sources: Array.isArray(data.sources) ? data.sources : [],
        coverage: Array.isArray(data.coverage) ? data.coverage : [], partial: data.partial === true,
      }]);
    } catch (cause) {
      if (activeRequest.current === controller) setError(controller.signal.aborted ? "Stopped. You can ask again." : cause instanceof Error ? cause.message : "Muse is unavailable.");
    } finally {
      if (activeRequest.current === controller) { activeRequest.current = null; setBusy(false); }
    }
  }

  function resetConversation() {
    activeRequest.current?.abort(); activeRequest.current = null;
    setMessages([]); setQuestion(""); setError(""); setBusy(false);
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
              <div className="nhs-muse-header-actions">
                {!!messages.length && <button className="nhs-muse-reset" type="button" onClick={resetConversation}>New chat</button>}
                <button className="nhs-muse-close" type="button" aria-label="Close Muse" onClick={() => setOpen(false)}>×</button>
              </div>
            </header>
            <div className="nhs-muse-conversation" role="log" aria-live="polite" aria-relevant="additions text">
              {!messages.length ? (
                <div className="nhs-muse-welcome">
                  <span className="nhs-muse-emblem" aria-hidden="true">✦</span>
                  <h3>What needs your attention?</h3>
                  <p>Ask about leads, saved prospects, project deadlines or opportunities.</p>
                  <div className="nhs-muse-prompts">
                    {suggestions(page).map(prompt => (
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
                  {message.role === "assistant" && !!message.coverage?.length && (
                    <details className="nhs-muse-evidence">
                      <summary>{message.partial ? "Some evidence is unavailable" : "Evidence checked for this answer"}</summary>
                      <ul>{message.coverage.map(item => <li key={item.area}>
                        {item.area}: {item.complete ? `${item.reviewed} ${item.reviewed === 1 ? "record" : "records"} reviewed` : "incomplete — conclusions limited"}
                      </li>)}</ul>
                      <p>Saved records, checked on demand. Displayed details may be shorter.</p>
                    </details>
                  )}
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
                {busy ? <button className="nhs-muse-send" type="button" onClick={() => activeRequest.current?.abort()}>Stop</button> :
                  <button className="nhs-muse-send" type="submit" disabled={question.trim().length < 2}>
                    Ask Muse <span aria-hidden="true">↗</span>
                  </button>}
              </form>
              <p className="nhs-muse-disclaimer">
                Read-only · Chat clears on reload · No automatic scans or messages
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
