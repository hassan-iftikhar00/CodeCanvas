"use client";

import { ReactNode, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { T_CANVAS } from "./canvasTokens";

/**
 * Drafting Toolbox — the right rail of the canvas page. Replaces the
 * always-open chat panel with a unified paper-sheet container that holds
 * multiple tabs (chat / layers / versions / properties). When collapsed,
 * shrinks to a thin tab strip pinned to the right edge so the canvas gets
 * back its space.
 *
 * Owns its expanded/collapsed state and the active tab so page.tsx doesn't
 * need to know the internal mechanics — it just hands in the tab content.
 */

export type ToolboxTabId = "chat" | "layers" | "versions" | "properties";

export interface ToolboxTab {
  id: ToolboxTabId;
  label: string;
  shortcut?: string;
  icon: ReactNode;
  badge?: number;
  content: ReactNode;
  banner?: ReactNode;
}

interface DraftingToolboxProps {
  tabs: ToolboxTab[];
  activeTab: ToolboxTabId;
  onTabChange: (id: ToolboxTabId) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export default function DraftingToolbox({
  tabs,
  activeTab,
  onTabChange,
  collapsed: collapsedProp,
  onCollapsedChange,
}: DraftingToolboxProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = collapsedProp ?? internalCollapsed;
  const setCollapsed = (next: boolean) => {
    if (onCollapsedChange) onCollapsedChange(next);
    else setInternalCollapsed(next);
  };

  const active = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  return (
    <motion.aside
      animate={{ width: collapsed ? 44 : 300 }}
      transition={{ duration: 0.22, ease: [0.22, 0.9, 0.28, 1] }}
      className="flex h-full flex-shrink-0 flex-col overflow-hidden border-l"
      style={{
        background: T_CANVAS.paper,
        borderColor: T_CANVAS.rule,
        fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
      }}
      aria-label="Drafting toolbox"
    >
      {/* TITLE BLOCK — only when expanded */}
      {!collapsed && (
        <div
          className="flex items-center justify-between border-b px-4 py-2.5 text-[10px] tracking-[0.16em] uppercase"
          style={{ borderColor: T_CANVAS.rule, color: T_CANVAS.muted }}
        >
          <span style={{ color: T_CANVAS.graphite }}>TOOLBOX · v0.1</span>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse toolbox"
            title="Collapse"
            className="flex h-5 w-5 items-center justify-center transition-colors"
            style={{ color: T_CANVAS.muted }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = T_CANVAS.graphite)
            }
            onMouseLeave={(e) => (e.currentTarget.style.color = T_CANVAS.muted)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3 w-3"
              aria-hidden="true"
            >
              <path d="M13 5l7 7-7 7" />
              <path d="M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* TAB STRIP — horizontal when expanded, vertical when collapsed */}
      <div
        className={`flex border-b ${collapsed ? "flex-col" : "flex-row"}`}
        style={{ borderColor: T_CANVAS.rule }}
        role="tablist"
        aria-orientation={collapsed ? "vertical" : "horizontal"}
      >
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand toolbox"
            title="Expand toolbox"
            className="flex h-10 w-full items-center justify-center transition-colors"
            style={{
              color: T_CANVAS.muted,
              borderBottom: `1px solid ${T_CANVAS.rule}`,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = T_CANVAS.graphite)
            }
            onMouseLeave={(e) => (e.currentTarget.style.color = T_CANVAS.muted)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3 w-3"
              aria-hidden="true"
            >
              <path d="M11 5l-7 7 7 7" />
              <path d="M19 5l-7 7 7 7" />
            </svg>
          </button>
        )}
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab && !collapsed;
          const onClickTab = () => {
            if (collapsed) {
              onTabChange(tab.id);
              setCollapsed(false);
              return;
            }
            onTabChange(tab.id);
          };
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={tab.label}
              title={
                tab.shortcut ? `${tab.label} (${tab.shortcut})` : tab.label
              }
              onClick={onClickTab}
              className={`relative flex items-center justify-center gap-1.5 px-2 transition-colors ${
                collapsed ? "h-10 w-full" : "h-9 flex-1"
              }`}
              style={{
                background: isActive ? T_CANVAS.graphite : "transparent",
                color: isActive
                  ? T_CANVAS.paper
                  : tab.id === activeTab
                    ? T_CANVAS.graphite
                    : T_CANVAS.muted,
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = T_CANVAS.graphite;
              }}
              onMouseLeave={(e) => {
                if (!isActive)
                  e.currentTarget.style.color =
                    tab.id === activeTab ? T_CANVAS.graphite : T_CANVAS.muted;
              }}
            >
              <span className="flex h-4 w-4 items-center justify-center">
                {tab.icon}
              </span>
              {!collapsed && (
                <span className="text-[10px] tracking-[0.16em] uppercase">
                  {tab.label}
                </span>
              )}
              {tab.badge && tab.badge > 0 ? (
                <span
                  className="ml-auto inline-flex h-3.5 min-w-[14px] items-center justify-center px-1 text-[9px] tracking-[0.04em]"
                  style={{
                    background: isActive ? T_CANVAS.paper : T_CANVAS.cobalt,
                    color: isActive ? T_CANVAS.graphite : T_CANVAS.paper,
                  }}
                >
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* CONTENT — only when expanded */}
      {!collapsed && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {active.banner ? (
            <div className="border-b" style={{ borderColor: T_CANVAS.rule }}>
              {active.banner}
            </div>
          ) : null}
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="flex-1 overflow-hidden"
            >
              {active.content}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </motion.aside>
  );
}
