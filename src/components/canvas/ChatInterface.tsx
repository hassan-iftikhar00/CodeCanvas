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
import { T_CANVAS } from "./canvasTokens";

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
    : "Draw a sketch on the canvas and click Run Detection. I can help refine the code once it is generated.",
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
    // swallow - chat history is best-effort
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
    <div
      className="flex h-full flex-col"
      style={{
        background: T_CANVAS.paper,
        fontFamily: "var(--font-inter, ui-sans-serif, system-ui, sans-serif)",
      }}
    >
      {/* SUB-HEADER — sketch state indicator */}
      <div
        className="flex items-center justify-between border-b px-4 py-2 text-[10px] tracking-[0.16em] uppercase"
        style={{
          borderColor: T_CANVAS.rule,
          color: T_CANVAS.muted,
          fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
        }}
      >
        <span style={{ color: T_CANVAS.graphite }}>ASK</span>
        <StatusPill ready={hasCode} />
      </div>

      {/* MESSAGES */}
      <div
        className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        style={{ background: T_CANVAS.paper }}
      >
        <AnimatePresence initial={false}>
          {visibleMessages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 0.9, 0.28, 1] }}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className="max-w-[88%] whitespace-pre-wrap break-words px-3 py-2 text-[13px] leading-[1.55]"
                style={
                  message.role === "user"
                    ? {
                        background: T_CANVAS.cobalt,
                        color: T_CANVAS.paper,
                        border: `1px solid ${T_CANVAS.cobalt}`,
                      }
                    : {
                        background: T_CANVAS.vellum,
                        color: T_CANVAS.graphite,
                        border: `1px solid ${T_CANVAS.rule}`,
                      }
                }
              >
                {message.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isProcessing ? (
          <div className="flex justify-start">
            <div
              className="flex items-center gap-2 px-3 py-2 text-[11px] tracking-[0.16em] uppercase"
              style={{
                background: T_CANVAS.vellum,
                border: `1px solid ${T_CANVAS.rule}`,
                color: T_CANVAS.muted,
                fontFamily:
                  "var(--font-jetbrains-mono, ui-monospace, monospace)",
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5"
                style={{
                  background: T_CANVAS.cobalt,
                  animation: "cc-pulse 1.2s ease-in-out infinite",
                }}
              />
              REFINING
            </div>
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      {/* SUGGESTION CHIPS — only when has code + no user messages yet */}
      {hasCode && messages.length === 0 ? (
        <div
          className="flex flex-wrap gap-1.5 border-t px-4 py-2"
          style={{ borderColor: T_CANVAS.rule }}
        >
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setInput(s)}
              className="px-2.5 py-1 text-[10px] tracking-[0.14em] uppercase transition-colors"
              style={{
                background: T_CANVAS.paper,
                border: `1px solid ${T_CANVAS.rule}`,
                color: T_CANVAS.muted,
                fontFamily:
                  "var(--font-jetbrains-mono, ui-monospace, monospace)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = T_CANVAS.cobalt;
                e.currentTarget.style.borderColor = T_CANVAS.cobalt;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = T_CANVAS.muted;
                e.currentTarget.style.borderColor = T_CANVAS.rule;
              }}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {/* INPUT BAR */}
      <form
        onSubmit={onSubmit}
        className="border-t px-3 py-3"
        style={{ borderColor: T_CANVAS.rule, background: T_CANVAS.vellum }}
      >
        <div
          className="flex items-end gap-2 px-2.5 py-2 transition-colors"
          style={{
            background: T_CANVAS.paper,
            border: `1px solid ${T_CANVAS.rule}`,
          }}
        >
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
            className="flex-1 resize-none bg-transparent text-[13px] leading-[1.5] focus:outline-none disabled:opacity-50"
            style={{
              maxHeight: MAX_INPUT_HEIGHT,
              color: T_CANVAS.graphite,
            }}
          />
          <motion.button
            type="submit"
            whileTap={{ scale: 0.92 }}
            disabled={!input.trim() || isProcessing || !hasCode}
            aria-label="Send message"
            className="flex h-7 w-7 flex-none items-center justify-center transition-colors disabled:opacity-40"
            style={{
              background:
                !input.trim() || !hasCode ? T_CANVAS.vellum : T_CANVAS.cobalt,
              color:
                !input.trim() || !hasCode ? T_CANVAS.muted : T_CANVAS.paper,
              border: `1px solid ${
                !input.trim() || !hasCode ? T_CANVAS.rule : T_CANVAS.cobalt
              }`,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3 w-3"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </motion.button>
        </div>
      </form>

      <style jsx>{`
        @keyframes cc-pulse {
          0%,
          100% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.4);
          }
        }
      `}</style>
    </div>
  );
}

function StatusPill({ ready }: { ready: boolean }) {
  return (
    <span
      className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] tracking-[0.14em] uppercase"
      style={{
        background: ready ? T_CANVAS.cobaltWash : T_CANVAS.vellum,
        color: ready ? T_CANVAS.cobaltInk : T_CANVAS.muted,
        border: `1px solid ${ready ? T_CANVAS.cobalt : T_CANVAS.rule}`,
      }}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5"
        style={{ background: ready ? T_CANVAS.cobalt : T_CANVAS.muted }}
      />
      {ready ? "READY" : "SKETCH FIRST"}
    </span>
  );
}
