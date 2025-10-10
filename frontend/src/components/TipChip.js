import React, { useEffect, useMemo, useState } from "react";

/**
 * TipChip – kis, nem tolakodó tipp buborék
 *
 * Props:
 * - show: boolean – a szülő dönti el, megjelenjen-e (pl. !isBuildingView && showTip)
 * - text: string – a megjelenítendő szöveg
 * - onClose: () => void – bezárás callback (pl. setShowTip(false))
 * - autoHideMs?: number – ennyi ms után magától eltűnik (alap: 12000; 0 = kikapcs)
 * - rememberDismiss?: boolean – bezárás után ne mutassa újra (localStorage)
 * - storageKey?: string – kulcs a localStorage-hoz (alap: "hideBuildingTip")
 * - position?: "bottom-left" | "bottom-right" | "top-left" | "top-right"
 * - className?: string – extra CSS osztály
 * - icon?: ReactNode – bal oldali ikon (alap: 💡)
 */
const TipChip = ({
  show,
  text = "Tipp: Kattints egy épületre a belső nézethez.",
  onClose,
  autoHideMs = 12000,
  rememberDismiss = true,
  storageKey = "hideBuildingTip",
  position = "bottom-left",
  className = "",
  icon = "💡",
}) => {
  // localStorage flag (opcionális)
  const initialDismissed =
    rememberDismiss && typeof window !== "undefined"
      ? window.localStorage.getItem(storageKey) === "1"
      : false;

  const [dismissed, setDismissed] = useState(initialDismissed);

  // láthatóság kalkuláció
  const visible = useMemo(() => show && !dismissed, [show, dismissed]);

  // auto-hide timer
  useEffect(() => {
    if (!visible || autoHideMs <= 0) return;
    const t = setTimeout(() => handleClose(), autoHideMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, autoHideMs]);

  const handleClose = () => {
    if (rememberDismiss && typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, "1");
    }
    setDismissed(true);
    onClose?.();
  };

  if (!visible) return null;

  return (
    <div className={`tip-chip ${position} ${className}`} role="note" aria-live="polite">
      <div className="tip-icon" aria-hidden="true">{icon}</div>
      <div className="tip-text">{text}</div>
      <button
        className="tip-close"
        onClick={handleClose}
        aria-label="Tipp bezárása"
        title="Bezárás"
      >
        ×
      </button>
    </div>
  );
};

export default TipChip;
