/**
 * Multi-step onboarding overlay shown on first visit.
 * Step 0: Welcome popup (centered modal).
 * Steps 1–4: Tooltip popups with arrows pointing at specific UI elements
 * identified by data-onboarding attributes.
 */
import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { isOnboardingDone, markOnboardingDone } from "../lib/onboarding";
import { useEditMode } from "../context/EditModeContext";

/** Total number of guided steps (after the welcome screen). */
const STEP_COUNT = 4;

/** Identifiers matching data-onboarding attributes on target elements. */
const STEP_TARGETS = [
  "", // step 0 = welcome (no target)
  "controls", // step 1 = navigation buttons
  "", // step 2 = gesture hint (centered modal)
  "edit-toggle", // step 3 = edit mode toggle
  "", // step 4 = add person (centered modal — button is inside SVG)
];

/** Inline SVG: two-finger pinch/spread gesture (mobile). */
function PinchGestureSvg() {
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Two finger circles */}
      <circle cx="36" cy="50" r="7" stroke="#78716c" strokeWidth="2" fill="#fafaf9" />
      <circle cx="64" cy="50" r="7" stroke="#78716c" strokeWidth="2" fill="#fafaf9" />
      {/* Outward arrows — drawn as lines + polygon arrowheads */}
      {/* Left finger → up-left */}
      <line x1="30" y1="42" x2="22" y2="30" stroke="#78716c" strokeWidth="2" />
      <polygon points="18,28 24,26 22,32" fill="#78716c" />
      {/* Left finger → down-left */}
      <line x1="30" y1="58" x2="22" y2="70" stroke="#78716c" strokeWidth="2" />
      <polygon points="18,72 24,74 22,68" fill="#78716c" />
      {/* Right finger → up-right */}
      <line x1="70" y1="42" x2="78" y2="30" stroke="#78716c" strokeWidth="2" />
      <polygon points="82,28 76,26 78,32" fill="#78716c" />
      {/* Right finger → down-right */}
      <line x1="70" y1="58" x2="78" y2="70" stroke="#78716c" strokeWidth="2" />
      <polygon points="82,72 76,74 78,68" fill="#78716c" />
    </svg>
  );
}

/** Inline SVG: scroll / trackpad gesture (desktop). */
function ScrollGestureSvg() {
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Trackpad rectangle */}
      <rect x="20" y="25" width="60" height="50" rx="8" stroke="#78716c" strokeWidth="2" fill="#fafaf9" />
      {/* Two fingers */}
      <circle cx="40" cy="50" r="5" stroke="#78716c" strokeWidth="1.5" fill="#e7e5e4" />
      <circle cx="60" cy="50" r="5" stroke="#78716c" strokeWidth="1.5" fill="#e7e5e4" />
      {/* Arrow up */}
      <line x1="50" y1="27" x2="50" y2="14" stroke="#78716c" strokeWidth="2" />
      <polygon points="50,10 46,16 54,16" fill="#78716c" />
      {/* Arrow down */}
      <line x1="50" y1="73" x2="50" y2="86" stroke="#78716c" strokeWidth="2" />
      <polygon points="50,90 46,84 54,84" fill="#78716c" />
    </svg>
  );
}

/** Compute position for the tooltip relative to a target element. */
function getTooltipPosition(target: HTMLElement): { top: number; left: number; arrowSide: "left" | "right" | "top" | "bottom" } {
  const rect = target.getBoundingClientRect();
  const midX = rect.left + rect.width / 2;
  const midY = rect.top + rect.height / 2;

  // If target is on the right side of the screen, place tooltip to the left
  if (midX > window.innerWidth / 2) {
    return {
      top: midY - 40,
      left: rect.left - 16,
      arrowSide: "right",
    };
  }
  // Otherwise place tooltip to the right
  return {
    top: midY - 40,
    left: rect.right + 16,
    arrowSide: "left",
  };
}

/** Detect touch-primary device (mobile / tablet). */
function isTouchDevice(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}

export default function OnboardingOverlay() {
  const { t } = useTranslation();
  const { setEditMode } = useEditMode();
  const [visible, setVisible] = useState(() => !isOnboardingDone());
  const [step, setStep] = useState(0);

  const finish = useCallback(() => {
    markOnboardingDone();
    setEditMode(false);
    setVisible(false);
  }, [setEditMode]);

  const next = useCallback(() => {
    setStep((s) => {
      const nextStep = s + 1;
      if (nextStep > STEP_COUNT) {
        // Past the last step — finish
        markOnboardingDone();
        setEditMode(false);
        setVisible(false);
        return s;
      }
      // Entering step 3 (edit-toggle): switch to edit mode to demonstrate it
      if (nextStep === 3) {
        setEditMode(true);
      }
      return nextStep;
    });
  }, [setEditMode]);

  if (!visible) return null;

  // Step 0: Welcome modal (centered)
  if (step === 0) {
    return createPortal(
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" role="dialog" aria-label={t("onboarding.welcomeTitle")}>
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4 text-center">
          <div className="text-4xl mb-4">🌳</div>
          <h2 className="text-xl font-bold text-stone-800 mb-3">{t("onboarding.welcomeTitle")}</h2>
          <p className="text-stone-600 text-sm leading-relaxed mb-8">{t("onboarding.welcomeBody")}</p>
          <div className="flex items-center justify-between">
            <button
              onClick={finish}
              className="text-xs text-stone-400 hover:text-stone-600 cursor-pointer"
            >
              {t("onboarding.skip")}
            </button>
            <button
              onClick={next}
              className="px-6 py-2 bg-amber-700 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 cursor-pointer"
            >
              {t("onboarding.next")}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // Step 2 (gesture) is a centered modal, not anchored to an element
  if (step === 2) {
    const isTouch = isTouchDevice();
    return createPortal(
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" role="dialog" aria-label={t("onboarding.gestureTitle")}>
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4 text-center">
          <h3 className="text-lg font-bold text-stone-800 mb-4">{t("onboarding.gestureTitle")}</h3>
          <div className="flex justify-center gap-8 mb-4">
            {isTouch ? <PinchGestureSvg /> : <ScrollGestureSvg />}
          </div>
          <p className="text-stone-600 text-sm leading-relaxed mb-6">
            {isTouch ? t("onboarding.gestureTouch") : t("onboarding.gestureTrackpad")}
          </p>
          <div className="flex items-center justify-between">
            <button onClick={finish} className="text-xs text-stone-400 hover:text-stone-600 cursor-pointer">
              {t("onboarding.skip")}
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-stone-400">{step}/{STEP_COUNT}</span>
              <button onClick={next} className="px-6 py-2 bg-amber-700 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 cursor-pointer">
                {t("onboarding.next")}
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // Step 4 (add button) is a centered modal — the + button lives inside the SVG tree
  if (step === 4) {
    return createPortal(
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" role="dialog">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4 text-center">
          {/* Illustration of the + button */}
          <div className="flex justify-center mb-4">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="24" cy="24" r="20" fill="#fffbeb" stroke="#d97706" strokeWidth="2" />
              <text x="24" y="25" textAnchor="middle" dominantBaseline="central" fontSize="24" fill="#b45309" fontWeight="700" fontFamily="system-ui, sans-serif">+</text>
            </svg>
          </div>
          <p className="text-stone-600 text-sm leading-relaxed mb-6">{t("onboarding.step4")}</p>
          <div className="flex items-center justify-between">
            <button onClick={finish} className="text-xs text-stone-400 hover:text-stone-600 cursor-pointer">
              {t("onboarding.skip")}
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-stone-400">{step}/{STEP_COUNT}</span>
              <button onClick={next} className="px-6 py-2 bg-amber-700 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 cursor-pointer">
                {t("onboarding.finish")}
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // Steps 1, 3: anchored tooltip with arrow
  const targetAttr = STEP_TARGETS[step];
  const targetEl = document.querySelector<HTMLElement>(`[data-onboarding="${targetAttr}"]`);

  // If target not found, show the step text as a centered modal instead
  if (!targetEl) {
    const stepTextKey = `onboarding.step${step}`;
    const isLast = step === STEP_COUNT;
    return createPortal(
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" role="dialog">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4 text-center">
          <p className="text-stone-600 text-sm leading-relaxed mb-6">{t(stepTextKey)}</p>
          <div className="flex items-center justify-between">
            <button onClick={finish} className="text-xs text-stone-400 hover:text-stone-600 cursor-pointer">
              {t("onboarding.skip")}
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-stone-400">{step}/{STEP_COUNT}</span>
              <button onClick={next} className="px-6 py-2 bg-amber-700 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 cursor-pointer">
                {isLast ? t("onboarding.finish") : t("onboarding.next")}
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  const pos = getTooltipPosition(targetEl);
  const rect = targetEl.getBoundingClientRect();

  // Spotlight cutout dimensions (with padding)
  const pad = 8;
  const spotX = rect.left - pad;
  const spotY = rect.top - pad;
  const spotW = rect.width + pad * 2;
  const spotH = rect.height + pad * 2;

  const stepTextKey = `onboarding.step${step}`;
  const isLast = step === STEP_COUNT;

  // Clamp tooltip so it doesn't overflow the viewport
  const tooltipStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 101,
    maxWidth: 280,
  };

  if (pos.arrowSide === "right") {
    // Tooltip is to the LEFT of the target
    tooltipStyle.top = Math.max(8, Math.min(pos.top, window.innerHeight - 160));
    tooltipStyle.right = window.innerWidth - pos.left;
  } else {
    // Tooltip is to the RIGHT of the target
    tooltipStyle.top = Math.max(8, Math.min(pos.top, window.innerHeight - 160));
    tooltipStyle.left = pos.left;
  }

  return createPortal(
    <>
      {/* Semi-transparent overlay with spotlight cutout */}
      <svg className="fixed inset-0 z-[100] pointer-events-none" width="100%" height="100%">
        <defs>
          <mask id="onboarding-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x={spotX} y={spotY} width={spotW} height={spotH} rx="8" fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#onboarding-mask)" />
      </svg>

      {/* Clickable overlay to prevent interaction outside spotlight */}
      <div className="fixed inset-0 z-[100]" onClick={(e) => e.stopPropagation()} />

      {/* Tooltip card */}
      <div style={tooltipStyle} className="bg-white rounded-xl shadow-2xl p-5 z-[101]">
        {/* Arrow */}
        <div
          className="absolute w-3 h-3 bg-white rotate-45"
          style={
            pos.arrowSide === "right"
              ? { top: 20, right: -6 }
              : { top: 20, left: -6 }
          }
        />
        <p className="text-sm text-stone-700 leading-relaxed mb-4">{t(stepTextKey)}</p>
        <div className="flex items-center justify-between">
          <button onClick={finish} className="text-xs text-stone-400 hover:text-stone-600 cursor-pointer">
            {t("onboarding.skip")}
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400">{step}/{STEP_COUNT}</span>
            <button
              onClick={next}
              className="px-5 py-1.5 bg-amber-700 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 cursor-pointer"
            >
              {isLast ? t("onboarding.finish") : t("onboarding.next")}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
