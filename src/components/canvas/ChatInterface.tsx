"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  onSendMessage: (message: string) => Promise<void>;
  isProcessing: boolean;
}

export default function ChatInterface({ onSendMessage, isProcessing }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I can help you refine your design. Try saying 'Make the buttons blue' or 'Add a navigation bar'.",
    },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput("");
    
    // Add user message
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", content: userMessage },
    ]);

    try {
      await onSendMessage(userMessage);
      
      // Add generic success message if the parent doesn't handle the response adding
      // Ideally the parent should return the AI response text
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: "I've updated the code based on your request." },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: "Sorry, I encountered an error processing that request." },
      ]);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#1A1A1A] border-l border-[#2E2E2E]">
      <div className="border-b border-[#2E2E2E] p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white">AI Assistant</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                message.role === "user"
                  ? "bg-[#FF6B00] text-white"
                  : "bg-[#2E2E2E] text-[#E0E0E0]"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-[#2E2E2E] rounded-2xl px-4 py-3 text-sm text-[#A0A0A0]">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-[#A0A0A0] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-[#A0A0A0] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-[#A0A0A0] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-[#2E2E2E]">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type instructions..."
            className="w-full rounded-xl bg-[#0A0A0A] border border-[#2E2E2E] px-4 py-3 text-sm text-white placeholder:text-[#666666] focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="absolute right-2 top-2 rounded-lg bg-[#FF6B00] p-1.5 text-white transition-all hover:bg-[#E66000] disabled:opacity-50 disabled:hover:bg-[#FF6B00]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
