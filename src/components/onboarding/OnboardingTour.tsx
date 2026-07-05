"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DRAFTING_TOKENS as T } from "@/lib/drafting-room/tokens";

const MONO = "var(--font-jetbrains-mono, ui-monospace, monospace)";
const SANS = "var(--font-inter, ui-sans-serif, system-ui)";
const SERIF = "var(--font-instrument-serif, ui-serif, Georgia, serif)";

export type OnboardingPlacement =
  | "right"
  | "left"
  | "top"
  | "bottom"
  | "center";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  placement?: OnboardingPlacement;
}

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface OnboardingTourProps {
  isOpen: boolean;
  steps: OnboardingStep[];
  stepIndex: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onFinish: () => void;
}

const HIGHLIGHT_PADDING = 10;
const TOOLTIP_GAP = 16;
const VIEWPORT_PADDING = 0;

export default function OnboardingTour({
  isOpen,
  steps,
  stepIndex,
  onNext,
  onBack,
  onSkip,
  onFinish,
}: OnboardingTourProps) {
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(
    null
  );
  const [tooltipPos, setTooltipPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const currentStep = steps[stepIndex];
  const totalSteps = steps.length;

  const updateHighlight = useCallback(() => {
    if (!currentStep) {
      setHighlightRect(null);
      return;
    }

    const target = document.querySelector(
      currentStep.targetSelector
    ) as HTMLElement | null;
    if (!target) {
      setHighlightRect(null);
      return;
    }

    const rect = target.getBoundingClientRect();
    const top = Math.max(rect.top - HIGHLIGHT_PADDING, VIEWPORT_PADDING);
    const left = Math.max(rect.left - HIGHLIGHT_PADDING, VIEWPORT_PADDING);
    const bottom = Math.min(
      rect.bottom + HIGHLIGHT_PADDING,
      window.innerHeight - VIEWPORT_PADDING
    );
    const right = Math.min(
      rect.right + HIGHLIGHT_PADDING,
      window.innerWidth - VIEWPORT_PADDING
    );
    const width = right - left;
    const height = bottom - top;

    setHighlightRect({ top, left, width, height });
  }, [currentStep]);

  useEffect(() => {
    if (!isOpen) return;

    let rafId = 0;
    const handleUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(updateHighlight);
    };

    handleUpdate();

    const target = currentStep
      ? (document.querySelector(
          currentStep.targetSelector
        ) as HTMLElement | null)
      : null;
    const observer = target ? new ResizeObserver(handleUpdate) : null;
    if (observer && target) {
      observer.observe(target);
    }

    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate, true);

    return () => {
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate, true);
      if (observer) {
        observer.disconnect();
      }
      cancelAnimationFrame(rafId);
    };
  }, [currentStep, isOpen, updateHighlight]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onSkip();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (stepIndex >= totalSteps - 1) {
          onFinish();
        } else {
          onNext();
        }
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (stepIndex > 0) {
          onBack();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onBack, onFinish, onNext, onSkip, stepIndex, totalSteps]);

  useEffect(() => {
    if (!isOpen || !tooltipRef.current) {
      setTooltipPos(null);
      return;
    }

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (!highlightRect || !currentStep) {
      setTooltipPos({
        top: Math.max(
          (viewportHeight - tooltipRect.height) / 2,
          VIEWPORT_PADDING
        ),
        left: Math.max(
          (viewportWidth - tooltipRect.width) / 2,
          VIEWPORT_PADDING
        ),
      });
      return;
    }

    const placement = currentStep.placement ?? "right";
    let top =
      highlightRect.top + highlightRect.height / 2 - tooltipRect.height / 2;
    let left = highlightRect.left + highlightRect.width + TOOLTIP_GAP;

    if (placement === "left") {
      left = highlightRect.left - tooltipRect.width - TOOLTIP_GAP;
    }
    if (placement === "top") {
      top = highlightRect.top - tooltipRect.height - TOOLTIP_GAP;
      left =
        highlightRect.left + highlightRect.width / 2 - tooltipRect.width / 2;
    }
    if (placement === "bottom") {
      top = highlightRect.top + highlightRect.height + TOOLTIP_GAP;
      left =
        highlightRect.left + highlightRect.width / 2 - tooltipRect.width / 2;
    }
    if (placement === "center") {
      top =
        highlightRect.top + highlightRect.height / 2 - tooltipRect.height / 2;
      left =
        highlightRect.left + highlightRect.width / 2 - tooltipRect.width / 2;
    }

    const clampedTop = Math.min(
      Math.max(top, VIEWPORT_PADDING),
      viewportHeight - tooltipRect.height - VIEWPORT_PADDING
    );
    const clampedLeft = Math.min(
      Math.max(left, VIEWPORT_PADDING),
      viewportWidth - tooltipRect.width - VIEWPORT_PADDING
    );

    setTooltipPos({ top: clampedTop, left: clampedLeft });
  }, [currentStep, highlightRect, isOpen]);

  const highlightStyle = useMemo(() => {
    if (!highlightRect) return undefined;
    return {
      top: `${highlightRect.top}px`,
      left: `${highlightRect.left}px`,
      width: `${highlightRect.width}px`,
      height: `${highlightRect.height}px`,
    };
  }, [highlightRect]);

  if (!isOpen || !currentStep) {
    return null;
  }

  const isLastStep = stepIndex >= totalSteps - 1;

  return (
    <AnimatePresence>
      <motion.div
        key="onboarding"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70]"
        role="dialog"
        aria-modal="true"
        aria-label="Onboarding walkthrough"
      >
        {highlightRect ? (
          <div className="absolute inset-0" />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ background: "rgba(14, 14, 15, 0.62)" }}
          />
        )}

        {highlightRect ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="absolute"
            style={{
              ...highlightStyle,
              border: `1px solid ${T.cobalt}`,
              outline: `2px solid ${T.cobalt}`,
              outlineOffset: 2,
              boxShadow: "0 0 0 9999px rgba(14, 14, 15, 0.65)",
            }}
          />
        ) : null}

        <motion.div
          ref={tooltipRef}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="absolute w-[340px] max-w-[82vw] p-4"
          style={{
            top: tooltipPos?.top ?? "50%",
            left: tooltipPos?.left ?? "50%",
            transform: tooltipPos ? "none" : "translate(-50%, -50%)",
            background: T.paper,
            border: `1px solid ${T.rule}`,
            color: T.graphite,
            fontFamily: SANS,
          }}
        >
          <div
            className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em]"
            style={{
              color: T.muted,
              fontFamily: MONO,
            }}
          >
            <span style={{ color: T.graphite }}>
              ONBOARDING · STEP {stepIndex + 1} / {totalSteps}
            </span>
            <button
              type="button"
              onClick={onSkip}
              className="text-[10px] tracking-[0.16em] uppercase transition-colors"
              style={{ color: T.muted }}
              onMouseEnter={(e) => (e.currentTarget.style.color = T.cobalt)}
              onMouseLeave={(e) => (e.currentTarget.style.color = T.muted)}
            >
              SKIP
            </button>
          </div>
          <h3
            className="mt-3 text-[20px] tracking-[-0.01em]"
            style={{
              color: T.graphite,
              fontFamily: SERIF,
              fontWeight: 400,
            }}
          >
            {currentStep.title}
          </h3>
          <p
            className="mt-2 text-[12px] leading-[1.55]"
            style={{ color: T.muted }}
          >
            {currentStep.description}
          </p>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              disabled={stepIndex === 0}
              className="px-3 py-1.5 text-[10px] tracking-[0.18em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: T.paper,
                border: `1px solid ${T.rule}`,
                color: T.muted,
                fontFamily: MONO,
              }}
              onMouseEnter={(e) => {
                if (stepIndex !== 0) e.currentTarget.style.color = T.graphite;
              }}
              onMouseLeave={(e) => (e.currentTarget.style.color = T.muted)}
            >
              ← BACK
            </button>
            <button
              type="button"
              onClick={isLastStep ? onFinish : onNext}
              className="px-3.5 py-1.5 text-[10px] tracking-[0.18em] uppercase transition-colors"
              style={{
                background: T.cobalt,
                border: `1px solid ${T.cobalt}`,
                color: T.paper,
                fontFamily: MONO,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = T.cobaltInk;
                e.currentTarget.style.borderColor = T.cobaltInk;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = T.cobalt;
                e.currentTarget.style.borderColor = T.cobalt;
              }}
            >
              {isLastStep ? "FINISH →" : "NEXT →"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
