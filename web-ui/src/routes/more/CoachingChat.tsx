import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Send, Check, X, AlertCircle } from 'lucide-react';

import { postCommand, executeCommand } from '@/lib/api';
import type { CommandAction, CommandResponse, CommandResult } from '@/lib/api';

// ─── Log model ──────────────────────────────────────────────────────────────

interface UserEntry { id: number; kind: 'user'; text: string }
interface ResultEntry { id: number; kind: 'result'; summary: string; results: CommandResult[] }
interface ConfirmEntry {
  id: number;
  kind: 'confirm';
  summary: string;
  actions: CommandAction[];
  status: 'pending' | 'done' | 'cancelled';
  results?: CommandResult[];
}
interface ErrorEntry { id: number; kind: 'error'; text: string }
type LogEntry = UserEntry | ResultEntry | ConfirmEntry | ErrorEntry;

const QUICK_PROMPTS = [
  'Time off this week',
  'Move today→tomorrow',
  "How's my training?",
  'Add a Z2 ride tomorrow',
] as const;

let nextId = 1;

// ─── Cards ────────────────────────────────────────────────────────────────────

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end" data-testid="entry-user">
      <div className="max-w-[82%] rounded-2xl rounded-br-sm bg-accent/20 px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-100">
        {text}
      </div>
    </div>
  );
}

function ResultCard({ summary, results }: { summary: string; results: CommandResult[] }) {
  // The summary already carries the result text for single-action reads/writes;
  // only list extra results that aren't already in the header.
  const extra = results.filter((r) => r.summary !== summary);
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-raised px-3.5 py-3" data-testid="entry-result">
      <p className="m-0 text-[13px] font-medium text-slate-100">{summary}</p>
      {extra.length > 0 && (
        <ul className="mt-2 space-y-1">
          {extra.map((r, i) => (
            <li
              key={i}
              className={`text-[12px] leading-snug ${r.ok ? 'text-slate-300' : 'text-rose-400'}`}
            >
              {r.summary}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConfirmCard({
  entry,
  onConfirm,
  onCancel,
  busy,
}: {
  entry: ConfirmEntry;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  if (entry.status === 'done') {
    return <ResultCard summary={entry.summary} results={entry.results ?? []} />;
  }
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-3.5 py-3" data-testid="entry-confirm">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" strokeWidth={2} />
        <div className="flex-1">
          <p className="m-0 text-[12px] font-semibold uppercase tracking-wide text-amber-400">Confirm change</p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-100">{entry.summary}</p>
        </div>
      </div>
      {entry.status === 'cancelled' ? (
        <p className="mt-2 text-[12px] text-slate-500">Cancelled.</p>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            onClick={onConfirm}
            disabled={busy}
            data-testid="confirm-btn"
            className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-semibold text-bg-base disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Check size={16} strokeWidth={2.5} /> Confirm
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            data-testid="cancel-btn"
            className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-border-default bg-bg-raised px-3 text-[13px] font-medium text-slate-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={16} strokeWidth={2.5} /> Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function ErrorCard({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 px-3.5 py-3 text-[13px] text-rose-300" data-testid="entry-error">
      {text}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-start" data-testid="busy">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-bg-raised px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CoachingChat() {
  const navigate = useNavigate();
  const [log, setLog] = useState<LogEntry[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [log, busy]);

  const push = useCallback((entry: LogEntry) => setLog((l) => [...l, entry]), []);

  const submit = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;
      setInput('');
      push({ id: nextId++, kind: 'user', text });
      setBusy(true);
      try {
        const resp: CommandResponse = await postCommand(text);
        if (resp.executed) {
          push({ id: nextId++, kind: 'result', summary: resp.summary, results: resp.results ?? [] });
        } else if (resp.needs_confirm && (resp.proposed_actions ?? resp.actions)?.length) {
          push({
            id: nextId++,
            kind: 'confirm',
            summary: resp.summary,
            actions: (resp.proposed_actions ?? resp.actions)!,
            status: 'pending',
          });
        } else {
          push({ id: nextId++, kind: 'result', summary: resp.summary, results: [] });
        }
      } catch {
        push({ id: nextId++, kind: 'error', text: 'I hit an error reaching the coach. Try again.' });
      } finally {
        setBusy(false);
      }
    },
    [busy, push],
  );

  const confirm = useCallback(
    async (id: number, actions: CommandAction[]) => {
      if (busy) return;
      setBusy(true);
      try {
        const { results } = await executeCommand(actions);
        setLog((l) =>
          l.map((e) => (e.id === id && e.kind === 'confirm' ? { ...e, status: 'done', results } : e)),
        );
      } catch {
        push({ id: nextId++, kind: 'error', text: 'The change failed. Try again.' });
      } finally {
        setBusy(false);
      }
    },
    [busy, push],
  );

  const cancel = useCallback((id: number) => {
    setLog((l) => l.map((e) => (e.id === id && e.kind === 'confirm' ? { ...e, status: 'cancelled' } : e)));
  }, []);

  return (
    <div className="flex h-[100dvh] flex-col bg-bg-base text-foreground font-ui">
      <header
        className="flex shrink-0 items-end border-b border-border-subtle bg-bg-surface px-4 pb-2 pt-safe"
        style={{ height: 'calc(56px + env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="mr-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Go back"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        <h1 className="m-0 flex-1 text-[17px] font-semibold">Command Bar</h1>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {log.length === 0 && (
          <div className="pt-8 text-center">
            <p className="text-[14px] font-medium text-slate-200">Tell your coach what to do.</p>
            <p className="mt-1 text-[12px] text-slate-500">
              Reads run instantly. Changes ask you to confirm first.
            </p>
          </div>
        )}
        {log.map((e) => {
          if (e.kind === 'user') return <UserBubble key={e.id} text={e.text} />;
          if (e.kind === 'result') return <ResultCard key={e.id} summary={e.summary} results={e.results} />;
          if (e.kind === 'error') return <ErrorCard key={e.id} text={e.text} />;
          return (
            <ConfirmCard
              key={e.id}
              entry={e}
              busy={busy}
              onConfirm={() => confirm(e.id, e.actions)}
              onCancel={() => cancel(e.id)}
            />
          );
        })}
        {busy && <Spinner />}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t border-border-subtle bg-bg-surface">
        <div className="flex gap-2 overflow-x-auto px-4 pt-3 pb-1">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => submit(p)}
              disabled={busy}
              className="shrink-0 rounded-full border border-border-default bg-bg-raised px-3 py-1.5 text-[12px] font-medium text-slate-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {p}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); submit(input); }}
          className="flex items-center gap-2 px-4 pb-safe-offset-3 pt-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell your coach what to do…"
            aria-label="Command input"
            className="h-11 flex-1 rounded-full border border-border-default bg-bg-raised px-4 text-[14px] text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Run command"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-bg-base disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Send size={18} strokeWidth={2.5} />
          </button>
        </form>
      </div>
    </div>
  );
}
