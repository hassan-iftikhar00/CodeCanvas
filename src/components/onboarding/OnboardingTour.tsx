"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export type OnboardingPlacement = "right" | "left" | "top" | "bottom" | "center";

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
const VIEWPORT_PADDING = 8;

export default function OnboardingTour({
  isOpen,
  steps,
  stepIndex,
  onNext,
  onBack,
  onSkip,
  onFinish,
}: OnboardingTourProps) {
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(
    null
  );
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
    const width = Math.min(
      rect.width + HIGHLIGHT_PADDING * 2,
      window.innerWidth - left - VIEWPORT_PADDING
    );
    const height = Math.min(
      rect.height + HIGHLIGHT_PADDING * 2,
      window.innerHeight - top - VIEWPORT_PADDING
    );

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
      ? (document.querySelector(currentStep.targetSelector) as HTMLElement | null)
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
        top: Math.max((viewportHeight - tooltipRect.height) / 2, VIEWPORT_PADDING),
        left: Math.max((viewportWidth - tooltipRect.width) / 2, VIEWPORT_PADDING),
      });
      return;
    }

    const placement = currentStep.placement ?? "right";
    let top = highlightRect.top + highlightRect.height / 2 - tooltipRect.height / 2;
    let left = highlightRect.left + highlightRect.width + TOOLTIP_GAP;

    if (placement === "left") {
      left = highlightRect.left - tooltipRect.width - TOOLTIP_GAP;
    }
    if (placement === "top") {
      top = highlightRect.top - tooltipRect.height - TOOLTIP_GAP;
      left = highlightRect.left + highlightRect.width / 2 - tooltipRect.width / 2;
    }
    if (placement === "bottom") {
      top = highlightRect.top + highlightRect.height + TOOLTIP_GAP;
      left = highlightRect.left + highlightRect.width / 2 - tooltipRect.width / 2;
    }
    if (placement === "center") {
      top = highlightRect.top + highlightRect.height / 2 - tooltipRect.height / 2;
      left = highlightRect.left + highlightRect.width / 2 - tooltipRect.width / 2;
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
            className="absolute inset-0 bg-black/70"
          />
        )}

        {highlightRect ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="absolute rounded-[16px] ring-2 ring-[#FF6B00] shadow-[0_0_0_9999px_rgba(0,0,0,0.72)]"
            style={highlightStyle}
          />
        ) : null}

        <motion.div
          ref={tooltipRef}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="absolute w-[320px] max-w-[82vw] rounded-2xl border border-[#2E2E2E] bg-[#111111] p-4 text-white shadow-[0_25px_60px_-25px_rgba(0,0,0,0.8)]"
          style={{
            top: tooltipPos?.top ?? "50%",
            left: tooltipPos?.left ?? "50%",
            transform: tooltipPos ? "none" : "translate(-50%, -50%)",
          }}
        >
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-[#7A7A7A]">
            <span>
              Step {stepIndex + 1} of {totalSteps}
            </span>
            <button
              type="button"
              onClick={onSkip}
              className="text-[10px] font-semibold uppercase text-[#B0B0B0] transition-colors hover:text-white"
            >
              Skip
            </button>
          </div>
          <h3 className="mt-2 text-[18px] font-semibold text-white">
            {currentStep.title}
          </h3>
          <p className="mt-2 text-[13px] text-[#B8B8B8]">
            {currentStep.description}
          </p>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              disabled={stepIndex === 0}
              className="rounded-[10px] border border-[#2E2E2E] px-3 py-1.5 text-[12px] font-semibold text-[#B0B0B0] transition-colors hover:border-[#3A3A3A] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
            <div className="flex items-center gap-2">
              {isLastStep ? (
                <button
                  type="button"
                  onClick={onFinish}
                  className="rounded-[10px] bg-[#FF6B00] px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[0_0_16px_rgba(255,107,0,0.35)] transition-transform hover:scale-[1.02]"
                >
                  Finish
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onNext}
                  className="rounded-[10px] bg-[#FF6B00] px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[0_0_16px_rgba(255,107,0,0.35)] transition-transform hover:scale-[1.02]"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
