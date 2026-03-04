import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ── Store URLs ─────────────────────────────────────────────────────────────────
const FIREFOX_URL =
  "https://addons.mozilla.org/en-US/firefox/addon/palettelive/";
const EDGE_URL =
  "https://microsoftedge.microsoft.com/addons/detail/palettelive/dgooneodmgfebhldkhakbbikhlfnlcnh";

// ── Browser detection ─────────────────────────────────────────────────────────
type DetectedBrowser = "edge" | "firefox" | "other";

function detectBrowser(): DetectedBrowser {
  const ua = navigator.userAgent;
  if (/Edg\//i.test(ua)) return "edge";
  if (/Firefox\//i.test(ua)) return "firefox";
  return "other";
}

// ── Open Firefox extension (protocol trick — falls back to new tab) ────────────
function openFirefoxExtension() {
  if (detectBrowser() === "firefox") {
    // Already in Firefox — open AMO directly
    window.open(FIREFOX_URL, "_blank", "noopener,noreferrer");
    return;
  }

  let launched = false;
  const onBlur = () => { launched = true; };
  const onVis = () => { if (document.hidden) launched = true; };

  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVis);

  // Try to hand off to the Firefox app via its registered protocol handler
  window.location.href = `firefox://open-url?url=${encodeURIComponent(FIREFOX_URL)}`;

  // After 1.5 s, if the OS didn't switch to Firefox, fall back to a new tab
  setTimeout(() => {
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("visibilitychange", onVis);
    if (!launched) window.open(FIREFOX_URL, "_blank", "noopener,noreferrer");
  }, 1500);
}

// ── Open Edge extension (protocol trick for non-Edge browsers) ────────────────
function openEdgeExtension() {
  if (detectBrowser() === "edge") {
    window.open(EDGE_URL, "_blank", "noopener,noreferrer");
    return;
  }

  let launched = false;
  const onBlur = () => { launched = true; };
  const onVis = () => { if (document.hidden) launched = true; };

  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVis);

  window.location.href = `microsoft-edge:${EDGE_URL}`;

  setTimeout(() => {
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("visibilitychange", onVis);
    if (!launched) window.open(EDGE_URL, "_blank", "noopener,noreferrer");
  }, 1500);
}

// ── Browser logos ────────────────────────────────────────────────────────────
const EdgeLogo = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M21.86 17.86c-.34.18-.7.34-1.07.47A9.5 9.5 0 0 1 17.5 19a9.5 9.5 0 0 1-9.5-9.5c0-2.15.72-4.13 1.92-5.72C5.66 4.92 3 8.12 3 12a9 9 0 0 0 9 9c3.27 0 6.13-1.74 7.72-4.35.37-.6.64-1.15.14-.79Z"
      fill="#0078D7"
    />
    <path
      d="M14.5 4A7.5 7.5 0 0 1 22 11.5c0 .46-.04.9-.12 1.34-.26 1.44-1.24 3.16-3.38 3.16-1.66 0-2.5-1.2-2.5-2.5V9a.5.5 0 0 0-.5-.5H9.6A5.5 5.5 0 0 0 9 11.5C9 14.54 11.46 17 14.5 17h.5a8.5 8.5 0 0 0 5.95-2.43A7.5 7.5 0 0 1 14.5 4Z"
      fill="#54AEFF"
    />
  </svg>
);

const FirefoxLogo = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="#FF9500" />
    <path
      d="M19.5 8.5C18.1 5.6 15 4 12 4c-1.5 0-3 .4-4.3 1.1C9 6 10 7.5 10.5 9c.3 1 .3 2 0 3-.2.7-.6 1.3-1 1.8-.5.6-1 1.1-1.2 1.8-.3.8-.2 1.7.2 2.5.7 1.4 2 2.4 3.5 2.8 1 .3 2 .3 3 0 1.6-.4 2.9-1.4 3.7-2.8.5-.8.7-1.7.7-2.6 0-.9-.2-1.8-.7-2.5-.3-.4-.6-.8-.7-1.3-.1-.5 0-1.1.4-1.5.3-.3.8-.5 1.1-.7Z"
      fill="#FF6611"
    />
    <path
      d="M12 6c-.8 0-1.7.2-2.4.6 1 .9 1.6 2.1 1.7 3.4.1.8 0 1.6-.4 2.3-.3.6-.8 1.1-1.3 1.6-.4.4-.7.9-.8 1.4-.1.6 0 1.2.4 1.7.6.8 1.5 1.3 2.5 1.4.9.1 1.8-.1 2.6-.6.8-.5 1.3-1.3 1.5-2.2.1-.5.1-1 0-1.5-.2-.7-.6-1.2-1.1-1.6-.4-.3-.8-.7-.8-1.2 0-.4.2-.8.5-1 .5-.4 1.2-.5 1.8-.4C15.7 8.2 14 6 12 6Z"
      fill="#FFCC00"
    />
  </svg>
);

// ── Modal popup ───────────────────────────────────────────────────────────────
function ExtensionModal({ onClose }: { onClose: () => void }) {
  const detected = detectBrowser();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose your browser to install PaletteLive"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl p-6"
        style={{ background: "#0d1b2a", border: "1.5px solid #415a77", boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full transition-colors"
          style={{ background: "#1b263b", color: "#778da9" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#415a77")}
          onMouseLeave={e => (e.currentTarget.style.background = "#1b263b")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header */}
        <div className="mb-5 text-center">
          <img src="/logo.png" alt="PaletteLive" width={36} height={36} className="mx-auto mb-3 rounded-xl" />
          <h2 className="text-base font-bold" style={{ color: "#e0e1dd" }}>Add PaletteLive</h2>
          <p className="mt-1 text-xs" style={{ color: "#778da9" }}>Free browser extension — choose your browser</p>
        </div>

        {/* Two browser buttons */}
        <div className="grid grid-cols-2 gap-3">
          {/* Edge */}
          <button
            type="button"
            onClick={() => { openEdgeExtension(); onClose(); }}
            className="group relative flex flex-col items-center gap-2 rounded-xl px-3 py-4 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            style={{ background: "#1b263b", border: `1.5px solid ${detected === "edge" ? "#0078D7" : "#2a3f55"}` }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "#0078D7")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = detected === "edge" ? "#0078D7" : "#2a3f55")}
          >
            {detected === "edge" && (
              <span
                className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold"
                style={{ background: "#0078D722", color: "#54AEFF", border: "1px solid #0078D740" }}
              >
                Your browser
              </span>
            )}
            <EdgeLogo />
            <span className="text-sm font-semibold" style={{ color: "#e0e1dd" }}>Microsoft Edge</span>
            <span className="text-[11px]" style={{ color: "#778da9" }}>Add extension</span>
          </button>

          {/* Firefox */}
          <button
            type="button"
            onClick={() => { openFirefoxExtension(); onClose(); }}
            className="group relative flex flex-col items-center gap-2 rounded-xl px-3 py-4 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            style={{ background: "#1b263b", border: `1.5px solid ${detected === "firefox" ? "#FF6611" : "#2a3f55"}` }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "#FF6611")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = detected === "firefox" ? "#FF6611" : "#2a3f55")}
          >
            {detected === "firefox" && (
              <span
                className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold"
                style={{ background: "#FF661122", color: "#FF9500", border: "1px solid #FF661140" }}
              >
                Your browser
              </span>
            )}
            <FirefoxLogo />
            <span className="text-sm font-semibold" style={{ color: "#e0e1dd" }}>Firefox</span>
            <span className="text-[11px]" style={{ color: "#778da9" }}>Add extension</span>
          </button>
        </div>

        <p className="mt-4 text-center text-[10px]" style={{ color: "#415a77" }}>
          Free · Open-source · Manifest V3
        </p>
      </div>
    </div>,
    document.body
  );
}

// ── Public component ───────────────────────────────────────────────────────────
export interface AddExtensionButtonProps {
  /** Fully replaces the button's inner content (text + icon). */
  children?: React.ReactNode;
  /** Fallback label when no children provided. */
  label?: string;
  /** className applied directly to the trigger <button> so it inherits any existing button styles. */
  className?: string;
  /** Inline styles applied to the trigger <button>. */
  style?: React.CSSProperties;
}

export function AddExtensionButton({
  children,
  label = "Add to Browser",
  className = "",
  style,
}: AddExtensionButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        style={style}
        aria-haspopup="dialog"
      >
        {children ?? label}
      </button>
      {open && <ExtensionModal onClose={() => setOpen(false)} />}
    </>
  );
}
