"use client";

import React, {
  useRef,
  forwardRef,
  useImperativeHandle,
  type ForwardedRef,
} from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { T_DARK } from "./canvasTokens";

interface MonacoCodeEditorProps {
  value: string;
  language?: "html" | "css" | "javascript" | "typescript" | "json";
  onChange?: (value: string | undefined) => void;
  readOnly?: boolean;
  height?: string;
}

/** Imperative surface for the Element↔Code Linker (App Uplift feature C). */
export interface MonacoCodeEditorHandle {
  /**
   * Find `searchText` in the current model, scroll it into view and flash a
   * line highlight. Returns true when a match was found.
   */
  revealAndFlash: (searchText: string) => boolean;
}

/**
 * Monaco code editor — Drafting Room "dark inset" theme. Reads as a graphite
 * slab dropped into the otherwise paper-light canvas page (mirrors the
 * design-preview-v2 CodeWell). Ink is paper-tinted at graded opacity, the
 * one accent is the brighter cobalt that survives on dark.
 */
export default forwardRef(function MonacoCodeEditor(
  {
    value,
    language = "html",
    onChange,
    readOnly = false,
    height = "100%",
  }: MonacoCodeEditorProps,
  ref: ForwardedRef<MonacoCodeEditorHandle>
) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const flashDecorationsRef =
    useRef<editor.IEditorDecorationsCollection | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    revealAndFlash: (searchText: string): boolean => {
      const ed = editorRef.current;
      const model = ed?.getModel();
      if (!ed || !model) return false;
      const match = model.findMatches(
        searchText,
        false, // searchOnlyEditableRange
        false, // isRegex
        false, // matchCase
        null,
        false
      )[0];
      if (!match) return false;

      const line = match.range.startLineNumber;
      ed.revealLineInCenter(line, 0 /* ScrollType.Smooth */);
      ed.setPosition({ lineNumber: line, column: match.range.startColumn });

      // Flash: replace any previous highlight, auto-clear after 1.6s.
      flashDecorationsRef.current?.clear();
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashDecorationsRef.current = ed.createDecorationsCollection([
        {
          range: match.range,
          options: {
            isWholeLine: true,
            className: "cc-link-flash-line",
            inlineClassName: "cc-link-flash-inline",
          },
        },
      ]);
      flashTimerRef.current = setTimeout(() => {
        flashDecorationsRef.current?.clear();
      }, 1600);
      return true;
    },
  }));

  const handleBeforeMount = (monaco: typeof import("monaco-editor")) => {
    // Silence language-service diagnostics entirely so no red squiggles or
    // overview-ruler markers ever get produced. The editor is for previewing
    // generated code, not authoring with lint feedback, so validation is just
    // noise.
    // Language-service namespaces are typed as `{ deprecated: true }` in the
    // bundled monaco type defs, but the runtime objects still exist and still
    // accept the same calls. Cast through unknown so TS doesn't reject the
    // property access; the try/catch keeps us safe if a future Monaco bundle
    // actually removes them.
    try {
      const langs = monaco.languages as unknown as {
        html?: { htmlDefaults?: { setOptions: (o: unknown) => void } };
        css?: { cssDefaults?: { setOptions: (o: unknown) => void } };
        typescript?: {
          typescriptDefaults?: {
            setDiagnosticsOptions: (o: unknown) => void;
          };
          javascriptDefaults?: {
            setDiagnosticsOptions: (o: unknown) => void;
          };
        };
      };
      langs.html?.htmlDefaults?.setOptions({
        format: { tabSize: 2, insertSpaces: true },
        suggest: {},
      });
      langs.css?.cssDefaults?.setOptions({ validate: false, lint: {} });
      langs.typescript?.typescriptDefaults?.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
      });
      langs.typescript?.javascriptDefaults?.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
      });
    } catch {
      // Defaults objects can be absent depending on which language workers
      // got bundled; the CSS hide below covers that case anyway.
    }

    monaco.editor.defineTheme("drafting-room", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "86868A", fontStyle: "italic" },
        { token: "keyword", foreground: "B7B8E5", fontStyle: "bold" },
        { token: "string", foreground: "8C8DD4" },
        { token: "number", foreground: "C4936A" },
        { token: "type", foreground: "B7B8E5" },
        { token: "delimiter", foreground: "D6D6D4" },
        { token: "tag", foreground: "B7B8E5" },
        { token: "attribute.name", foreground: "86868A" },
        { token: "attribute.value", foreground: "8C8DD4" },
      ],
      colors: {
        "editor.background": "#0E0E0F",
        "editor.foreground": "#D6D6D4",
        "editorLineNumber.foreground": "#4D4D50",
        "editorLineNumber.activeForeground": "#F2F1EC",
        "editor.lineHighlightBackground": "#131316",
        "editor.lineHighlightBorder": "#131316",
        "editor.selectionBackground": "#232347",
        "editor.inactiveSelectionBackground": "#1A1A1F",
        "editorCursor.foreground": "#8C8DD4",
        "editorGutter.background": "#0E0E0F",
        "editorIndentGuide.background": "#1F1F22",
        "editorIndentGuide.activeBackground": "#4D4D50",
        "editorRuler.foreground": "#1F1F22",
        "scrollbarSlider.background": "rgba(242, 241, 236, 0.12)",
        "scrollbarSlider.hoverBackground": "rgba(242, 241, 236, 0.25)",
        "scrollbarSlider.activeBackground": "rgba(140, 141, 212, 0.5)",
        "editorOverviewRuler.border": "#0E0E0F",
        "editorOverviewRuler.background": "#0E0E0F",
        "editorOverviewRuler.errorForeground": "#8B2A2A00",
        "editorOverviewRuler.warningForeground": "#A85A1800",
        "editorOverviewRuler.infoForeground": "#4A4B8C00",
        "editorError.foreground": "#C97070",
        "editorError.background": "#0E0E0F00",
        "editorWarning.foreground": "#C4936A",
        "editorWarning.background": "#0E0E0F00",
        "editorInfo.foreground": "#8C8DD4",
        "editorInfo.background": "#0E0E0F00",
        "editorBracketMatch.background": "#232347",
        "editorBracketMatch.border": "#8C8DD4",
        "editorWidget.background": "#131316",
        "editorWidget.border": "#F2F1EC",
        "editorSuggestWidget.background": "#131316",
        "editorSuggestWidget.border": "#F2F1EC",
        "editorSuggestWidget.selectedBackground": "#232347",
        "editorSuggestWidget.highlightForeground": "#8C8DD4",
        "minimap.background": "#0E0E0F",
        "minimap.errorHighlight": "#8B2A2A00",
        "minimap.warningHighlight": "#A85A1800",
        "minimapSlider.background": "rgba(242, 241, 236, 0.12)",
        "minimapSlider.hoverBackground": "rgba(242, 241, 236, 0.25)",
        "minimapSlider.activeBackground": "rgba(140, 141, 212, 0.5)",
      },
    });
    monaco.editor.setTheme("drafting-room");
  };

  const handleEditorDidMount = (e: editor.IStandaloneCodeEditor) => {
    editorRef.current = e;
  };

  const handleFormat = () => {
    if (editorRef.current) {
      editorRef.current.getAction("editor.action.formatDocument")?.run();
    }
  };

  return (
    <div
      className="relative flex h-full flex-col"
      style={{ background: T_DARK.bg }}
    >
      {/* Belt-and-braces: hide Monaco's decorations overview ruler canvas
          (the slim column on the right edge of the scrollbar that paints lint
          markers in red/orange). Setting overviewRulerLanes: 0 and disabling
          language services SHOULD prevent it being rendered, but worker
          timing can flash a red bar before our options apply. CSS removes
          the element entirely. */}
      <style jsx global>{`
        /* Element↔Code Linker flash highlight (cleared after 1.6s). */
        .monaco-editor .cc-link-flash-line {
          background: rgba(140, 141, 212, 0.22) !important;
        }
        .monaco-editor .cc-link-flash-inline {
          background: rgba(140, 141, 212, 0.35) !important;
        }
        .monaco-editor .overflow-guard .decorationsOverviewRuler,
        .monaco-editor .overflow-guard .decorationsOverviewRuler > canvas,
        .monaco-editor .overflow-guard .decorationsOverviewRuler > svg,
        .monaco-editor .overflow-guard .decorationsOverviewRuler > div {
          display: none !important;
        }
        .monaco-editor .overflow-guard .scroll-decoration,
        .monaco-editor .overflow-guard .minimap,
        .monaco-editor .overflow-guard .minimap-decorations-layer {
          opacity: 0 !important;
        }
        .monaco-editor .monaco-scrollable-element > .scrollbar,
        .monaco-editor .monaco-scrollable-element > .scrollbar > .slider,
        .monaco-editor .monaco-scrollable-element > .scrollbar > .slider.active,
        .monaco-editor .monaco-scrollable-element > .scrollbar > .slider:hover,
        .monaco-editor .monaco-scrollable-element > .scrollbar.vertical,
        .monaco-editor .monaco-scrollable-element > .scrollbar.horizontal {
          background: transparent !important;
        }
        .monaco-editor .monaco-scrollable-element > .scrollbar > .slider {
          background-color: rgba(242, 241, 236, 0.18) !important;
          border-radius: 9999px !important;
          box-shadow: none !important;
        }
        .monaco-editor .monaco-scrollable-element > .scrollbar > .slider:hover {
          background-color: rgba(242, 241, 236, 0.32) !important;
        }
        .monaco-editor
          .monaco-scrollable-element
          > .scrollbar
          > .slider.active {
          background-color: rgba(140, 141, 212, 0.55) !important;
        }
      `}</style>
      {/* Editor sub-header — file / language + format action */}
      <div
        className="flex items-center justify-between border-b px-3 py-1.5"
        style={{
          borderColor: T_DARK.ruleSoft,
          background: T_DARK.bgRaised,
          fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
        }}
      >
        <div
          className="flex items-center gap-2 text-[13px] tracking-[0.14em] uppercase"
          style={{ color: T_DARK.inkMuted }}
        >
          <span
            className="inline-block h-1.5 w-1.5"
            style={{ background: T_DARK.cobalt }}
            aria-hidden="true"
          />
          <span style={{ color: T_DARK.inkBright }}>
            ~/output.{language === "javascript" ? "jsx" : language}
          </span>
          <span>· {language.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <button
              onClick={handleFormat}
              className="flex items-center gap-1 px-2 py-1 text-[13px] tracking-[0.14em] uppercase transition-colors"
              style={{
                background: T_DARK.surfaceSoft,
                border: `1px solid ${T_DARK.rule}`,
                color: T_DARK.inkMuted,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = T_DARK.surfaceHover;
                e.currentTarget.style.color = T_DARK.inkBright;
                e.currentTarget.style.borderColor = "rgba(242, 241, 236, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = T_DARK.surfaceSoft;
                e.currentTarget.style.color = T_DARK.inkMuted;
                e.currentTarget.style.borderColor = T_DARK.rule;
              }}
              title="Format code (Shift+Alt+F)"
            >
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              FORMAT
            </button>
          )}
          <span
            className="text-[13px] tracking-[0.14em] uppercase"
            style={{ color: T_DARK.inkFaint }}
          >
            {readOnly ? "READ-ONLY" : "Ctrl+S TO SAVE"}
          </span>
        </div>
      </div>

      <div className="flex-1">
        <Editor
          height={height}
          defaultLanguage={language}
          language={language}
          value={value}
          theme="drafting-room"
          beforeMount={handleBeforeMount}
          onChange={onChange}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily:
              "var(--font-jetbrains-mono, ui-monospace, monospace), Menlo, monospace",
            lineNumbers: "on",
            rulers: [],
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
            padding: { top: 14, bottom: 14 },
            renderWhitespace: "selection",
            renderLineHighlight: "line",
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
            // Kill the overview-ruler strip (the slim red/yellow column on the
            // right of the scrollbar that surfaces lint markers). Setting lanes
            // to 0 removes the strip entirely; renderValidationDecorations: off
            // also stops squiggle underlines from being painted in-line so the
            // editor looks calm regardless of language-service noise.
            overviewRulerLanes: 0,
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            renderValidationDecorations: "off",
            guides: {
              indentation: true,
              highlightActiveIndentation: true,
            },
          }}
          onMount={handleEditorDidMount}
        />
      </div>
    </div>
  );
});
