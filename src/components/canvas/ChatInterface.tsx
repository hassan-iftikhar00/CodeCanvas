"use client";

import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "motion/react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  onSendMessage: (message: string) => Promise<string | void>;
  isProcessing: boolean;
  hasCode: boolean;
  projectId?: string;
}

const CHAT_STORAGE_PREFIX = "cc:chat:";
const MAX_PERSISTED_MESSAGES = 50;
const MAX_INPUT_HEIGHT = 120;

const buildWelcome = (hasCode: boolean): Message => ({
  id: "welcome",
  role: "assistant",
  content: hasCode
    ? 'Your code is ready. Try "Make the buttons rounded" or "Add a hero section".'
    : "Draw a sketch on the canvas and click Run Detection. I can help refine the code once it's generated.",
});

const loadStoredMessages = (projectId?: string): Message[] => {
  if (!projectId) return [];
  try {
    const stored = localStorage.getItem(`${CHAT_STORAGE_PREFIX}${projectId}`);
    if (stored) {
      const parsed = JSON.parse(stored) as Message[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // swallow — chat history is best-effort
  }
  return [];
};

const SUGGESTIONS = [
  "Make it dark mode",
  "Add rounded corners",
  "Make buttons bigger",
  "Add a header",
];

export default function ChatInterface({
  onSendMessage,
  isProcessing,
  hasCode,
  projectId,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(() =>
    loadStoredMessages(projectId)
  );
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const welcome = buildWelcome(hasCode);
  const visibleMessages =
    messages.length === 0 ? [welcome] : [welcome, ...messages];

  useEffect(() => {
    if (!projectId) return;
    try {
      localStorage.setItem(
        `${CHAT_STORAGE_PREFIX}${projectId}`,
        JSON.stringify(messages.slice(-MAX_PERSISTED_MESSAGES))
      );
    } catch {
      // swallow
    }
  }, [messages, projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  // Auto-grow textarea (1–4 lines)
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [input]);

  const send = async () => {
    if (!input.trim() || isProcessing) return;
    const userMessage = input.trim();
    setInput("");

    if (!hasCode) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "user", content: userMessage },
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "I need code to refine. Draw a UI sketch on the canvas, then click Run Detection.",
        },
      ]);
      return;
    }

    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", content: userMessage },
    ]);

    try {
      const response = await onSendMessage(userMessage);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            typeof response === "string" && response.length > 0
              ? response
              : "Done. The code panel has been updated.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "I hit an error processing that. Mind trying again?",
        },
      ]);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send();
  };

  const onKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="flex h-full flex-col bg-[var(--cc-bg-surface)]">
      {/* Inline section header */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <span className="h-px flex-1 bg-[var(--cc-border-subtle)]" />
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--cc-text-muted)]">
          Ask AI
        </span>
        <StatusPill ready={hasCode} />
        <span className="h-px flex-1 bg-[var(--cc-border-subtle)]" />
      </div>

      {/* Messages */}
      <div
        className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        <AnimatePresence initial={false}>
          {visibleMessages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 0.9, 0.28, 1] }}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[88%] whitespace-pre-wrap break-words rounded-[8px] px-3 py-2 text-[13px] leading-relaxed ${
                  message.role === "user"
                    ? "bg-[var(--cc-bg-elevated)] text-[var(--cc-text-primary)]"
                    : "bg-[#0d0d0d] text-[#cccccc] border border-[var(--cc-border-subtle)]"
                }`}
              >
                {message.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isProcessing ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-[8px] border border-[var(--cc-border-subtle)] bg-[#0d0d0d] px-3 py-2">
              <span className="text-[12px] text-[var(--cc-text-secondary)]">
                Refining
              </span>
              <span className="cc-caret" aria-hidden="true" />
            </div>
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion chips when empty */}
      {hasCode && messages.length === 0 ? (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setInput(s)}
              className="rounded-full border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-elevated)] px-2.5 py-1 text-[11px] text-[var(--cc-text-secondary)] transition-colors hover:border-[var(--cc-accent)] hover:text-[var(--cc-accent)]"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {/* Input bar */}
      <form
        onSubmit={onSubmit}
        className="border-t border-[var(--cc-border-subtle)] bg-[var(--cc-bg-elevated)] px-3 py-3"
      >
        <div className="flex items-end gap-2 rounded-[8px] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-canvas)] px-3 py-2 transition-colors focus-within:border-[var(--cc-accent)]">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              setInput(e.target.value)
            }
            onKeyDown={onKey}
            placeholder={
              hasCode
                ? "Describe what to change... (Enter to send, Shift+Enter for newline)"
                : "Run detection first to start refining..."
            }
            disabled={!hasCode}
            rows={1}
            aria-label="Chat message"
            className="flex-1 resize-none bg-transparent text-[13px] leading-relaxed text-[var(--cc-text-primary)] placeholder:text-[var(--cc-text-muted)] focus:outline-none disabled:opacity-50"
            style={{ maxHeight: MAX_INPUT_HEIGHT }}
          />
          <motion.button
            type="submit"
            whileTap={{ scale: 0.92 }}
            disabled={!input.trim() || isProcessing || !hasCode}
            aria-label="Send message"
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--cc-bg-elevated)] text-[var(--cc-text-secondary)] transition-colors hover:bg-[var(--cc-accent)] hover:text-white disabled:opacity-40 disabled:hover:bg-[var(--cc-bg-elevated)] disabled:hover:text-[var(--cc-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </motion.button>
        </div>
      </form>
    </div>
  );
}

function StatusPill({ ready }: { ready: boolean }) {
  return (
    <span
      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
        ready
          ? "bg-[rgba(34,197,94,0.1)] text-[#4ade80]"
          : "bg-[rgba(245,158,11,0.1)] text-[#fbbf24]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          ready ? "bg-[#4ade80]" : "bg-[#fbbf24]"
        }`}
      />
      {ready ? "Ready" : "Sketch first"}
    </span>
  );
}
