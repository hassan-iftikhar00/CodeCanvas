"use client";

import React, { useRef } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";

interface MonacoCodeEditorProps {
  value: string;
  language?: "html" | "css" | "javascript" | "typescript" | "json";
  onChange?: (value: string | undefined) => void;
  readOnly?: boolean;
  height?: string;
}

/**
 * Monaco Code Editor Component
 * Professional code editor with syntax highlighting, formatting, and more
 */
export default function MonacoCodeEditor({
  value,
  language = "html",
  onChange,
  readOnly = false,
  height = "100%",
}: MonacoCodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
  };

  const handleFormat = () => {
    if (editorRef.current) {
      editorRef.current.getAction("editor.action.formatDocument")?.run();
    }
  };

  return (
    <div className="relative flex h-full flex-col">
      {/* Editor Toolbar */}
      <div className="flex items-center justify-between border-b border-[#2E2E2E] bg-[#1A1A1A] px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#A0A0A0]">
            Language: {language.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <button
              onClick={handleFormat}
              className="rounded-lg bg-[#2E2E2E] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-white hover:text-[#0A0A0A]"
              title="Format Code (Shift+Alt+F)"
            >
              <svg
                className="mr-1.5 inline-block h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              Format
            </button>
          )}
          <span className="text-xs text-[#666666]">
            {readOnly ? "Read-only" : "Press Ctrl+S to save"}
          </span>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1">
        <Editor
          height={height}
          defaultLanguage={language}
          language={language}
          value={value}
          theme="vs-dark"
          onChange={onChange}
          options={{
            readOnly,
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: "on",
            rulers: [80, 120],
            wordWrap: "on",
            automaticLayout: true,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            formatOnPaste: true,
            formatOnType: true,
            tabSize: 2,
            insertSpaces: true,
            detectIndentation: true,
            folding: true,
            foldingHighlight: true,
            bracketPairColorization: {
              enabled: true,
            },
            padding: { top: 16, bottom: 16 },
            renderWhitespace: "selection",
            renderLineHighlight: "all",
            scrollbar: {
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
          }}
          onMount={handleEditorDidMount}
        />
      </div>
    </div>
  );
}
