import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Send } from 'lucide-react';

import {
  getCoachingState, getCoachingBrief, analyzeActivity, getActivities,
} from '@/lib/api';

// ─── Message model ────────────────────────────────────────────────────────────

interface ChatMessage {
  id: number;
  role: 'user' | 'coach';
  text: string;
}

const QUICK_PROMPTS = [
  "How's my training?",
  'Should I train today?',
  'Analyze last ride',
  'Race week plan',
] as const;

// Pull readable coaching prose out of whatever shape the backend returns.
// Returns '' for objects with no human-readable field rather than dumping raw
// JSON into a chat bubble.
function asText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of ['result', 'brief', 'summary', 'message', 'text'] as const) {
      if (typeof o[k] === 'string') return (o[k] as string).trim();
    }
    return '';
  }
  return String(v);
}

// Route a prompt to the best available coaching tool.
async function replyFor(prompt: string): Promise<string> {
  const p = prompt.toLowerCase();

  if (p.includes('analyze') && (p.includes('ride') || p.includes('last') || p.includes('activity'))) {
    const acts = await getActivities({ limit: 1 });
    const id = acts?.[0]?.id;
    if (!id) return "I couldn't find a recent activity to analyze.";
    const out = asText(await analyzeActivity(id));
    return out || `Analysis for "${acts[0].name ?? id}" is queued. Check back shortly.`;
  }

  if (p.includes("how's my training") || p.includes('how is my training') || p.includes('should i train')) {
    const [state, brief] = await Promise.allSettled([getCoachingState(), getCoachingBrief()]);
    const parts: string[] = [];
    if (brief.status === 'fulfilled') parts.push(asText(brief.value));
    if (state.status === 'fulfilled') parts.push(asText(state.value));
    const text = parts.filter(Boolean).join('\n\n');
    return text || 'No coaching state is available right now.';
  }

  // Generic free-text question → coaching brief.
  const out = asText(await getCoachingBrief());
  return out || "I don't have a reading for that yet. Try one of the quick prompts above.";
}

// ─── Bubbles ──────────────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        data-testid={`bubble-${msg.role}`}
        className={[
          'max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
          isUser
            ? 'rounded-br-sm bg-accent/20 text-slate-100'
            : 'rounded-bl-sm bg-bg-raised text-slate-200',
        ].join(' ')}
      >
        {msg.text}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start" data-testid="typing">
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

let nextId = 1;

export default function CoachingChat() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, role: 'coach', text: "I'm your coach. Ask about today's session, your training, or a recent ride." },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, busy]);

  const send = useCallback(async (raw: string) => {
    const prompt = raw.trim();
    if (!prompt || busy) return;
    setInput('');
    setMessages((m) => [...m, { id: nextId++, role: 'user', text: prompt }]);
    setBusy(true);
    try {
      const reply = await replyFor(prompt);
      setMessages((m) => [...m, { id: nextId++, role: 'coach', text: reply }]);
    } catch {
      setMessages((m) => [...m, { id: nextId++, role: 'coach', text: 'I hit an error reaching the coaching engine. Try again in a moment.' }]);
    } finally {
      setBusy(false);
    }
  }, [busy]);

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
        <h1 className="m-0 flex-1 text-[17px] font-semibold">Coaching Chat</h1>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => <Bubble key={m.id} msg={m} />)}
        {busy && <TypingBubble />}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t border-border-subtle bg-bg-surface">
        <div className="flex gap-2 overflow-x-auto px-4 pt-3 pb-1">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              disabled={busy}
              className="shrink-0 rounded-full border border-border-default bg-bg-raised px-3 py-1.5 text-[12px] font-medium text-slate-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {p}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-center gap-2 px-4 pb-safe-offset-3 pt-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your coach…"
            aria-label="Message your coach"
            className="h-11 flex-1 rounded-full border border-border-default bg-bg-raised px-4 text-[14px] text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-bg-base disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Send size={18} strokeWidth={2.5} />
          </button>
        </form>
      </div>
    </div>
  );
}
