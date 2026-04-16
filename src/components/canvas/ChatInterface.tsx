"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  onSendMessage: (message: string) => Promise<string | void>;
  isProcessing: boolean;
  hasCode: boolean;
}

export default function ChatInterface({
  onSendMessage,
  isProcessing,
  hasCode,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasShownWelcome = useRef(false);

  // Show appropriate welcome message based on whether code exists
  useEffect(() => {
    if (!hasShownWelcome.current) {
      hasShownWelcome.current = true;
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: hasCode
            ? "Your code is ready! I can help you refine it. Try saying 'Make the buttons blue' or 'Add a navigation bar'."
            : "Draw a sketch on the canvas first, then click Generate Code. Once code is generated, I can help you refine it!",
        },
      ]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update welcome message when code becomes available
  useEffect(() => {
    if (
      messages.length === 1 &&
      messages[0].id === "welcome" &&
      hasCode &&
      messages[0].content.startsWith("Draw a sketch")
    ) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content:
            "Your code is ready! I can help you refine it. Try saying 'Make the buttons blue', 'Add a dark mode', or 'Change the layout to grid'.",
        },
      ]);
    }
  }, [hasCode, messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    // Block if no code exists — sketch-first workflow
    if (!hasCode) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "user", content: input.trim() },
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "I need code to work with first! Please draw a UI sketch on the canvas and click the Generate Code button. Then I can help you refine it.",
        },
      ]);
      setInput("");
      return;
    }

    const userMessage = input.trim();
    setInput("");

    // Add user message
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", content: userMessage },
    ]);

    try {
      const response = await onSendMessage(userMessage);

      // Add assistant response
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            typeof response === "string" && response.length > 0
              ? response
              : "Done! I've updated the code based on your request. Check the code panel below.",
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "Sorry, I encountered an error processing that request. Please try again.",
        },
      ]);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#2E2E2E] px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#888]">
            AI Assistant
          </h2>
          {hasCode ? (
            <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              Ready
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
              Sketch first
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                message.role === "user"
                  ? "bg-[#FF6B00] text-white"
                  : "bg-[#1E1E1E] text-[#D0D0D0]"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-[#1E1E1E] rounded-2xl px-3.5 py-2.5 text-xs text-[#A0A0A0]">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-1.5 h-1.5 bg-[#FF6B00] rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="w-1.5 h-1.5 bg-[#FF6B00] rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="w-1.5 h-1.5 bg-[#FF6B00] rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
                <span className="ml-1 text-[#666]">Refining code...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion chips when code is ready */}
      {hasCode && messages.length <= 2 && (
        <div className="px-3 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {[
              "Make it dark mode",
              "Add rounded corners",
              "Make buttons bigger",
              "Add a header",
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setInput(suggestion)}
                className="rounded-full border border-[#2E2E2E] bg-[#0A0A0A] px-2.5 py-1 text-[10px] text-[#A0A0A0] transition-all hover:border-[#FF6B00] hover:text-[#FF6B00]"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-3 border-t border-[#2E2E2E]">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              hasCode
                ? "Describe what to change..."
                : "Generate code from sketch first..."
            }
            disabled={!hasCode}
            className="w-full rounded-xl bg-[#0A0A0A] border border-[#2E2E2E] px-3.5 py-2.5 pr-10 text-xs text-white placeholder:text-[#555] focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing || !hasCode}
            className="absolute right-1.5 top-1.5 rounded-lg bg-[#FF6B00] p-1.5 text-white transition-all hover:bg-[#E66000] disabled:opacity-30 disabled:hover:bg-[#FF6B00]"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 10l7-7m0 0l7 7m-7-7v18"
              />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
