import { useEffect, useMemo, useRef, useState } from "react";

const EDGE_ADDON_URL = "https://microsoftedge.microsoft.com/addons/detail/palettelive/dglieojmcknbngkffpephfdphbdfbcam";

// Detect if user is on Edge (Chromium-based Edge includes "Edg/" in the UA)
const isEdgeBrowser = () => /Edg\//i.test(navigator.userAgent);

// If on Edge: navigate directly to the add-ons page (default link behavior).
// If NOT on Edge: try microsoft-edge: protocol. If user cancels the prompt,
// fall back to opening the URL in a new tab.
const openEdgeLink = (e: React.MouseEvent<HTMLAnchorElement>) => {
  if (isEdgeBrowser()) {
    // Already on Edge — let the normal <a href="..."> navigate in-page or new tab
    return;
  }
  // Not on Edge — prevent the default navigation and try Edge protocol
  e.preventDefault();

  let edgeLaunched = false;

  const onBlur = () => { edgeLaunched = true; };
  const onVisChange = () => { if (document.hidden) edgeLaunched = true; };

  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisChange);

  window.location.href = `microsoft-edge:${EDGE_ADDON_URL}`;

  // If Edge didn't open after ~1.5s (user cancelled), open in new tab as fallback
  setTimeout(() => {
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("visibilitychange", onVisChange);
    if (!edgeLaunched) {
      window.open(EDGE_ADDON_URL, "_blank", "noopener,noreferrer");
    }
  }, 1500);
};

type Theme = "dark" | "light";

// ─── Pure export helpers (ported from extension's exporter.js) ───
type ExportColor = { name: string; value: string };

function exportToCSS(colors: ExportColor[]) {
  let out = ":root {\n";
  colors.forEach((c) => {
    const name = c.name.startsWith("--") ? c.name : "--" + c.name;
    out += `  ${name}: ${c.value};\n`;
  });
  return out + "}";
}

function exportToJSON(colors: ExportColor[]) {
  const tokens: Record<string, string> = {};
  colors.forEach((c) => {
    const key = c.name.replace(/^--/, "");
    tokens[key] = c.value;
  });
  return JSON.stringify(tokens, null, 2);
}

function exportToTailwind(colors: ExportColor[]) {
  let out = "module.exports = {\n  theme: {\n    extend: {\n      colors: {\n";
  colors.forEach((c) => {
    const key = c.name.replace(/^--/, "");
    out += `        "${key}": '${c.value}',\n`;
  });
  out += "      }\n    }\n  }\n}";
  return out;
}

function exportToCMYK(colors: ExportColor[]) {
  const lines = ["/* CMYK Color Palette */\n"];
  colors.forEach((c) => {
    const hex = c.value.replace("#", "").slice(0, 6);
    if (hex.length !== 6) { lines.push(`${c.name}: cmyk(0%, 0%, 0%, 100%)`); return; }
    const r = parseInt(hex.slice(0,2),16)/255, g = parseInt(hex.slice(2,4),16)/255, b = parseInt(hex.slice(4,6),16)/255;
    const k = 1 - Math.max(r,g,b);
    const cy = k<1 ? (1-r-k)/(1-k) : 0;
    const ma = k<1 ? (1-g-k)/(1-k) : 0;
    const ye = k<1 ? (1-b-k)/(1-k) : 0;
    lines.push(`${c.name}: cmyk(${(cy*100).toFixed(1)}%, ${(ma*100).toFixed(1)}%, ${(ye*100).toFixed(1)}%, ${(k*100).toFixed(1)}%)`);
  });
  return lines.join("\n");
}

function exportToLAB(colors: ExportColor[]) {
  function toLinear(v: number) { v /= 255; return v <= 0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }
  function hexToLab(hex: string) {
    hex = hex.replace("#","").slice(0,6);
    const r = toLinear(parseInt(hex.slice(0,2),16)), g = toLinear(parseInt(hex.slice(2,4),16)), b = toLinear(parseInt(hex.slice(4,6),16));
    let x=(r*0.4124+g*0.3576+b*0.1805)/0.95047, y=r*0.2126+g*0.7152+b*0.0722, z=(r*0.0193+g*0.1192+b*0.9505)/1.08883;
    const f=(v: number)=>v>0.008856?Math.cbrt(v):7.787*v+16/116;
    x=f(x); y=f(y); z=f(z);
    return { l:116*y-16, a:500*(x-y), b:200*(y-z) };
  }
  const lines = ["/* CIE LAB Color Palette (D65) */\n"];
  colors.forEach((c) => { const lab=hexToLab(c.value); lines.push(`${c.name}: lab(${lab.l.toFixed(2)}% ${lab.a.toFixed(2)} ${lab.b.toFixed(2)})`); });
  return lines.join("\n");
}

function exportToOKLCH(colors: ExportColor[]) {
  function toLinear(v: number) { v /= 255; return v <= 0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }
  function hexToOklch(hex: string) {
    hex = hex.replace("#","").slice(0,6);
    const r=toLinear(parseInt(hex.slice(0,2),16)), g=toLinear(parseInt(hex.slice(2,4),16)), b=toLinear(parseInt(hex.slice(4,6),16));
    const l_=Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b);
    const m_=Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b);
    const s_=Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b);
    const L=0.2104542553*l_+0.793617785*m_-0.0040720468*s_;
    const a=1.9779984951*l_-2.428592205*m_+0.4505937099*s_;
    const bOk=0.0259040371*l_+0.7827717662*m_-0.808675766*s_;
    const C=Math.sqrt(a*a+bOk*bOk);
    let H=Math.atan2(bOk,a)*(180/Math.PI); if(H<0) H+=360;
    return { l:L, c:C, h:H };
  }
  const lines = ["/* OKLCH Color Palette */\n/* oklch(Lightness  Chroma  Hue) */\n"];
  colors.forEach((c) => { const ok=hexToOklch(c.value); lines.push(`${c.name}: oklch(${(ok.l*100).toFixed(1)}% ${ok.c.toFixed(4)} ${ok.h.toFixed(1)})`); });
  return lines.join("\n");
}

function exportToPaletteLive(colors: ExportColor[]) {
  const overrides: Record<string,string> = {};
  colors.forEach((c) => { overrides[c.name] = c.value; });
  return JSON.stringify({ version: "1.0", format: "palettelive", overrides }, null, 2);
}

function buildExportColors(swatches: string[], customSwatches: Record<number,string>, roleNames: string[]) {
  return swatches.map((c, i) => ({
    name: roleNames[i] ?? `--color-${i}`,
    value: customSwatches[i] ?? c,
  }));
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function fixTextContrast(swatches: string[], customSwatches: Record<number,string>): Record<number,string> {
  // Identify background (index 0) and text-ish colors (indices >= 3)
  const bg = customSwatches[0] ?? swatches[0];
  const next = { ...customSwatches };
  swatches.forEach((_, i) => {
    if (i < 3) return; // only fix text/primary colors
    const current = next[i] ?? swatches[i];
    let ratio = contrastRatio(current, bg);
    if (ratio >= 4.5) return; // already passes AA
    // Try lightening or darkening
    let hex = current.replace("#", "");
    let r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
    const isDark = luminance(bg) > 0.5;
    for (let step = 0; step < 20 && ratio < 4.5; step++) {
      if (isDark) { r=Math.min(255,r+12); g=Math.min(255,g+12); b=Math.min(255,b+12); }
      else       { r=Math.max(0,r-12);   g=Math.max(0,g-12);   b=Math.max(0,b-12); }
      const fixed = "#" + [r,g,b].map(v => v.toString(16).padStart(2,"0")).join("");
      ratio = contrastRatio(fixed, bg);
      if (ratio >= 4.5) { next[i] = fixed; break; }
    }
  });
  return next;
}

function Icon({ name, className }: { name: string; className?: string }) {
  const common = `h-5 w-5 ${className ?? ""}`;
  switch (name) {
    case "bolt":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      );
    case "shield":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l8 4v6c0 5-3 9-8 10-5-1-8-5-8-10V6l8-4z" />
        </svg>
      );
    case "sparkles":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l1.5 6L20 10l-6.5 2L12 18l-1.5-6L4 10l6.5-2L12 2z" />
          <path d="M5 3l.7 2.7L8 6.4 5.7 7.1 5 10l-.7-2.9L2 6.4l2.3-.7L5 3z" />
        </svg>
      );
    case "eye":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "pipette":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 22l2-2" />
          <path d="M7 17l-3 3" />
          <path d="M14 3l7 7" />
          <path d="M10 7l7 7" />
          <path d="M8.5 8.5l7 7" />
          <path d="M15 2l7 7-5 5-7-7 5-5z" />
        </svg>
      );
    case "code":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 18l6-6-6-6" />
          <path d="M8 6l-6 6 6 6" />
          <path d="M14 4l-4 16" />
        </svg>
      );
    case "download":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M7 10l5 5 5-5" />
          <path d="M12 15V3" />
        </svg>
      );
    case "check":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    case "x":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </svg>
      );
    case "github":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.2-1.2-1.5-1.2-1.5-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 .1 1.6-.7 1.9-1.2.1-.7.4-1.2.7-1.5-2.6-.3-5.3-1.3-5.3-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.2 0 4.6-2.7 5.6-5.3 5.9.4.3.8 1 .8 2.1v3.1c0 .3.2.7.8.6A12 12 0 0 0 12 .5z" />
        </svg>
      );
    default:
      return null;
  }
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/80">
      {children}
    </span>
  );
}

function SoftBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm">
      {children}
    </span>
  );
}

function Pill({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 blur-2xl" />
      <div className="relative flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
          {icon}
        </div>
        <div className="space-y-2">
          <h3 className="text-base font-semibold tracking-tight text-slate-900">{title}</h3>
          <div className="text-sm leading-relaxed text-slate-600">{children}</div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="mb-3 text-xs font-semibold tracking-[0.25em] text-indigo-600">{eyebrow}</div>
      <h2 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      <p className="mt-4 text-pretty text-base leading-relaxed text-slate-600">{desc}</p>
    </div>
  );
}

function ContrastBadge({ level, pass }: { level: "AA" | "AAA"; pass: boolean }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold " +
        (pass
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700")
      }
    >
      {pass ? <Icon name="check" className="h-4 w-4" /> : <Icon name="x" className="h-4 w-4" />}
      WCAG {level}
    </span>
  );
}

function fakeContrast(hexA: string, hexB: string) {
  // Lightweight deterministic pseudo-contrast for UI demo.
  // Produces a stable-ish number from two hex strings.
  const n = (s: string) =>
    s
      .replace("#", "")
      .split("")
      .reduce((acc, ch, i) => acc + (parseInt(ch, 16) + 1) * (i + 1), 0);
  const a = n(hexA);
  const b = n(hexB);
  const ratio = 1 + (Math.abs(a - b) % 800) / 100;
  return Math.round(ratio * 10) / 10;
}

const PALETTES = [
  { name: "Midnight", bg: "#0B1220", surface: "#111C33", accent: "#818CF8", text: "#EAF0FF", primary: "#818CF8", secondary: "#22C55E" },
  { name: "Ocean", bg: "#0A192F", surface: "#112240", accent: "#64FFDA", text: "#CCD6F6", primary: "#64FFDA", secondary: "#57CBB6" },
  { name: "Sunset", bg: "#1A1423", surface: "#2D1B3D", accent: "#F97316", text: "#FFF1E6", primary: "#F97316", secondary: "#FBBF24" },
  { name: "Forest", bg: "#0D1B0E", surface: "#162A17", accent: "#22C55E", text: "#E8F5E9", primary: "#22C55E", secondary: "#86EFAC" },
  { name: "Mono", bg: "#18181b", surface: "#27272a", accent: "#a1a1aa", text: "#f4f4f5", primary: "#d4d4d8", secondary: "#71717a" },
  { name: "Candy", bg: "#1F1226", surface: "#2A1833", accent: "#EC4899", text: "#FDF2F8", primary: "#EC4899", secondary: "#F472B6" },
];

/** WCAG contrast ratio (real formula) */
function luminance(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrastRatio(a: string, b: string) {
  const la = luminance(a) + 0.05;
  const lb = luminance(b) + 0.05;
  return la > lb ? la / lb : lb / la;
}

// ─── Shared Website Preview (reused in both normal + compare mode) ───
type PaletteData = { name: string; bg: string; surface: string; accent: string; text: string; primary: string; secondary: string };
function SitePreview({ pal, heatmapOn = false, onColorClick }: { pal: PaletteData; heatmapOn?: boolean; onColorClick?: (role: "accent" | "surface" | "bg" | "text") => void }) {
  const clickable = !!onColorClick;
  const features = [
    { icon: "🎨", title: "Color Extraction", desc: "Full DOM + Shadow DOM scan. Resolves CSS variables, pseudo-states & keyframes.", tag: "Core" },
    { icon: "⚡", title: "Real-Time Overrides", desc: "Live recoloring via injected CSS + watchdog. No page reload ever needed.", tag: "Core" },
    { icon: "🖌️", title: "6 Harmony Generators", desc: "Mono, 60-30-10, Analogous, Complementary, Split-Comp & Triadic.", tag: "Design" },
    { icon: "🔍", title: "WCAG Contrast Checker", desc: "AA/AAA pass/fail per swatch. Auto-repairs contrast failures in one click.", tag: "A11y" },
    { icon: "📤", title: "6 Export Formats", desc: "CSS Vars, JSON, Tailwind Config, CMYK, CIE LAB & OKLCH exports.", tag: "Export" },
    { icon: "👁️", title: "Vision Simulation", desc: "Protanopia, Deuteranopia & Tritanopia via live SVG feColorMatrix filters.", tag: "A11y" },
    { icon: "🔥", title: "Heatmap Overlay", desc: "Outline every colored element live. Hover to see hex values instantly.", tag: "Inspect" },
    { icon: "⚖️", title: "Before / After Compare", desc: "Drag a split-screen divider to diff original vs. recolored page.", tag: "Inspect" },
    { icon: "💾", title: "SPA Persistence", desc: "Per-domain storage. Re-applies on reload, pushState & BFCache restore.", tag: "Smart" },
  ];
  const tagColors: Record<string, string> = { Core: "#3b82f6", Design: "#8b5cf6", A11y: "#10b981", Export: "#f59e0b", Inspect: "#ef4444", Smart: "#06b6d4" };
  return (
    <div style={{ background: pal.bg, minHeight: 200, position: "relative", overflowY: "auto" }} onClick={clickable ? () => onColorClick("bg") : undefined}>
      {heatmapOn && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none", overflow: "hidden" }}>
          {[pal.accent, pal.secondary, pal.primary, "#38BDF8", "#F97316"].map((c, i) => (
            <div key={i} style={{ position: "absolute", borderRadius: "50%", top: `${8 + (i * 24) % 70}%`, left: `${4 + (i * 21) % 78}%`, width: 80 + i * 20, height: 80 + i * 20, background: c, opacity: 0.28, filter: "blur(20px)", transition: "background 0.5s" }} />
          ))}
        </div>
      )}

      {/* Nav */}
      <div onClick={clickable ? (e) => { e.stopPropagation(); onColorClick("surface"); } : undefined}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 16px", background: pal.surface, borderBottom: `1px solid ${pal.accent}22`, cursor: clickable ? "pointer" : undefined, transition: "background 0.5s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <img src="/logo.png" alt="PaletteLive Logo" style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 800, color: pal.accent, letterSpacing: "-0.02em", transition: "color 0.5s" }}>PaletteLive</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {["Features", "Docs", "GitHub"].map(t => (
            <span key={t} style={{ fontSize: 9, fontWeight: 500, color: pal.text, opacity: 0.6, transition: "color 0.5s" }}>{t}</span>
          ))}
          <div onClick={clickable ? (e) => { e.stopPropagation(); onColorClick("accent"); } : undefined}
            style={{ borderRadius: 6, padding: "3px 9px", fontSize: 9, fontWeight: 700, background: pal.accent, color: pal.bg, cursor: clickable ? "pointer" : undefined, transition: "background 0.5s, color 0.5s" }}>Install Free</div>
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: "16px 16px 10px", textAlign: "center" }}>
        <div onClick={clickable ? (e) => { e.stopPropagation(); onColorClick("accent"); } : undefined}
          style={{ display: "inline-block", borderRadius: 99, padding: "2px 10px", fontSize: 8, fontWeight: 700, background: `${pal.accent}22`, color: pal.accent, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase", cursor: clickable ? "pointer" : undefined, transition: "background 0.5s, color 0.5s" }}>Chrome Extension · Manifest V3</div>
        <div onClick={clickable ? (e) => { e.stopPropagation(); onColorClick("text"); } : undefined}
          style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.2, color: pal.text, letterSpacing: "-0.03em", marginBottom: 5, cursor: clickable ? "pointer" : undefined, transition: "color 0.5s" }}>Color intelligence<br/>for every webpage</div>
        <div style={{ fontSize: 9, color: pal.text, opacity: 0.55, lineHeight: 1.5, maxWidth: 280, margin: "0 auto 10px", transition: "color 0.5s" }}>Extract, edit, generate & export color palettes from any live website in real-time — no page reload needed.</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 10 }}>
          <div onClick={clickable ? (e) => { e.stopPropagation(); onColorClick("accent"); } : undefined}
            style={{ borderRadius: 7, padding: "5px 14px", fontSize: 9, fontWeight: 700, background: pal.accent, color: pal.bg, cursor: clickable ? "pointer" : undefined, transition: "background 0.5s, color 0.5s" }}>Add to Edge</div>
          <div onClick={clickable ? (e) => { e.stopPropagation(); onColorClick("surface"); } : undefined}
            style={{ borderRadius: 7, padding: "5px 14px", fontSize: 9, fontWeight: 600, background: pal.surface, color: pal.text, border: `1px solid ${pal.accent}44`, cursor: clickable ? "pointer" : undefined, transition: "background 0.5s, color 0.5s" }}>View Docs</div>
        </div>
        {/* Stats row */}
        <div style={{ display: "flex", justifyContent: "center", gap: 18, padding: "8px 0", borderTop: `1px solid ${pal.accent}18`, borderBottom: `1px solid ${pal.accent}18` }}>
          {[["18+", "Features"], ["6", "Export Formats"], ["185", "Unit Tests"], ["82%", "Coverage"]].map(([val, label]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: pal.accent, transition: "color 0.5s" }}>{val}</div>\n              <div style={{ fontSize: 7, color: pal.text, opacity: 0.5, transition: "color 0.5s" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature grid — 9 cards in 3×3 */}
      <div style={{ padding: "10px 14px 14px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
        {features.map((f) => (
          <div key={f.title} onClick={clickable ? (e) => { e.stopPropagation(); onColorClick("surface"); } : undefined}
            style={{ borderRadius: 10, padding: "9px 10px", background: pal.surface, border: `1px solid ${pal.accent}1a`, cursor: clickable ? "pointer" : undefined, transition: "background 0.5s", display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 1 }}>
              <span style={{ fontSize: 14 }}>{f.icon}</span>
              <span style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: tagColors[f.tag] ?? pal.accent, background: `${tagColors[f.tag] ?? pal.accent}18`, borderRadius: 99, padding: "1px 5px" }}>{f.tag}</span>
            </div>
            <div onClick={clickable ? (e) => { e.stopPropagation(); onColorClick("accent"); } : undefined}
              style={{ fontSize: 8, fontWeight: 800, color: pal.accent, lineHeight: 1.25, transition: "color 0.5s", cursor: clickable ? "pointer" : undefined }}>{f.title}</div>
            <div style={{ fontSize: 7.5, color: pal.text, opacity: 0.55, lineHeight: 1.4, transition: "color 0.5s" }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {clickable && (
        <div style={{ position: "absolute", bottom: 4, right: 6, fontSize: 8, color: pal.text, opacity: 0.3, pointerEvents: "none", fontStyle: "italic" }}>Click any element to inspect</div>
      )}
    </div>
  );
}

function InteractiveDemo({ theme, tourStarted, onTourEnd }: { theme: Theme; tourStarted?: boolean; onTourEnd?: () => void }) {
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [heatmapOn, setHeatmapOn] = useState(false);
  const [compareOn, setCompareOn] = useState(false);
  const [realtimeOn, setRealtimeOn] = useState(true);
  const [selectedSwatch, setSelectedSwatch] = useState<number | null>(null);
  const [clusterOn, setClusterOn] = useState(true);
  const [clusterThreshold, setClusterThreshold] = useState(5);
  const [paletteMode, setPaletteMode] = useState("apply-palette");
  const [mappingMode, setMappingMode] = useState("auto");
  const [visionSim, setVisionSim] = useState("none");
  const [exportSelectOn, setExportSelectOn] = useState(true);
  const [popupTheme, setPopupTheme] = useState<"light" | "dark">("dark");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFmt, setExportFmt] = useState<"palettelive" | "css" | "json" | "tailwind" | "cmyk" | "lab" | "oklch">("css");
  const [applyAnim, setApplyAnim] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [genBaseColor, setGenBaseColor] = useState("#3498db");
  const [genMonoCount, setGenMonoCount] = useState(5);
  const [gen60Color, setGen60Color] = useState("#f8f9fa");
  const [gen30Color, setGen30Color] = useState("#3498db");
  const [gen10Color, setGen10Color] = useState("#e74c3c");
  const [genAnalogSpread, setGenAnalogSpread] = useState(30);
  const [genSplitGap, setGenSplitGap] = useState(30);
  const [extensionPaused, setExtensionPaused] = useState(false);
  // Interactive state
  const [compareSplit, setCompareSplit] = useState(50);
  const [editingHex, setEditingHex] = useState(PALETTES[0].accent);
  const [customSwatches, setCustomSwatches] = useState<Record<number, string>>({});
  const [scanAnim, setScanAnim] = useState(false);
  const [customPaletteInput, setCustomPaletteInput] = useState("");
  const isDraggingCompare = useRef(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const [copiedFmt, setCopiedFmt] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [importMode, setImportMode] = useState<"menu" | "clipboard">("menu");
  const [fixTextAnim, setFixTextAnim] = useState(false);
  const [reapplyAnim, setReapplyAnim] = useState(false);
  const [resetAnim, setResetAnim] = useState(false);

  // ─── Guided tour ───
  const TOUR_STEPS = [
    { id: "pl-tour-palettes", icon: "🌈", title: "Switch Palettes", body: "Click any palette preset to instantly recolor the entire live preview. Or hit the play/pause button for auto-cycling animation.", tip: "Step 1 of 6" },
    { id: "pl-tour-swatches", icon: "✏️", title: "Edit Any Color", body: "Click a swatch to open the color editor. Use the hex field, native color picker, or paste a Coolors URL to apply a whole palette at once.", tip: "Step 2 of 6" },
    { id: "pl-tour-toggles", icon: "🔥", title: "Heatmap \u0026 Compare", body: "Heatmap visualizes color density across the page. Compare lets you drag a split-screen divider to diff original vs. recolored side-by-side.", tip: "Step 3 of 6" },
    { id: "pl-tour-vision", icon: "👁️", title: "Vision Simulation", body: "See how colorblind users experience your palette — protanopia, deuteranopia, tritanopia & achromatopsia via live SVG filters.", tip: "Step 4 of 6" },
    { id: "pl-tour-editor", icon: "🎨", title: "PaletteLive Editor", body: "Type a hex code or click the color bar to open the native picker. The live preview updates instantly. Check WCAG contrast scores below — AA needs 4.5:1, AAA needs 7:1. Hit 'Apply Color To Export Set' when you're happy.", tip: "Step 5 of 6" },
    { id: "pl-tour-export", icon: "📤", title: "Export Anywhere", body: "Copy your palette as CSS variables, JSON design tokens, Tailwind config, CMYK, CIE LAB or OKLCH — or download as a file.", tip: "Step 6 of 6" },
  ];
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [spotlightRect, setSpotlightRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [tourVisible, setTourVisible] = useState(false);

  useEffect(() => {
    if (tourStarted) {
      setTourStep(0);
      setAutoPlay(false);
      setTourVisible(false);
      setTimeout(() => setTourVisible(true), 60);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourStarted]);

  useEffect(() => {
    if (tourStep === null) return;
    const step = TOUR_STEPS[tourStep];
    // Auto-select a swatch when editor step is reached so the panel opens
    if (step.id === "pl-tour-editor" && selectedSwatch === null) {
      setSelectedSwatch(4); // primary swatch
      setEditingHex(swatches[4] ?? "#A9B4FF");
    }
    const el = document.getElementById(step.id);
    if (!el) return;
    // Scroll the target into view first, then measure after scroll settles
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSpotlightRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };
    // Wait for scroll to settle before first measurement
    const scrollTimer = setTimeout(update, 420);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { clearTimeout(scrollTimer); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourStep]);

  const tourNext = () => {
    if (tourStep === null) return;
    if (tourStep < TOUR_STEPS.length - 1) {
      setTourStep(tourStep + 1);
    } else {
      setTourStep(null); setSpotlightRect(null); setTourVisible(false);
      onTourEnd?.();
    }
  };
  const tourEnd = () => { setTourStep(null); setSpotlightRect(null); setTourVisible(false); onTourEnd?.(); };

  // Build the swatch role names for export
  const ROLE_NAMES = ["--color-bg","--color-surface","--color-accent","--color-text","--color-primary","--color-secondary"];

  function getExportColors() {
    return buildExportColors(swatches.slice(0, 6), customSwatches, ROLE_NAMES);
  }

  function getExportText(fmt: string) {
    const cols = getExportColors();
    if (fmt === "css") return exportToCSS(cols);
    if (fmt === "json") return exportToJSON(cols);
    if (fmt === "tailwind") return exportToTailwind(cols);
    if (fmt === "cmyk") return exportToCMYK(cols);
    if (fmt === "lab") return exportToLAB(cols);
    if (fmt === "oklch") return exportToOKLCH(cols);
    if (fmt === "palettelive") return exportToPaletteLive(cols);
    return "";
  }

  function copyFmt(fmt: string) {
    setAutoPlay(false);
    setExportFmt(fmt as typeof exportFmt);
    const text = getExportText(fmt);
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedFmt(fmt);
    setTimeout(() => setCopiedFmt(null), 2000);
  }

  function downloadFmt(fmt: string) {
    setAutoPlay(false);
    const text = getExportText(fmt);
    const ext = fmt === "json" ? ".json" : fmt === "tailwind" ? ".js" : fmt === "palettelive" ? ".plpalette" : ".txt";
    downloadFile(`palette-${PALETTES[paletteIdx].name.toLowerCase()}${ext}`, text);
  }

  function applyImportText(raw: string) {
    const hexes = raw.match(/#[0-9a-fA-F]{6}/gi);
    if (!hexes || hexes.length < 2) return;
    const next: Record<number,string> = {};
    hexes.slice(0,6).forEach((h,i) => { next[i] = h; });
    setCustomSwatches(next);
    setAutoPlay(false);
    setEditingHex(hexes[2] ?? hexes[0]);
    setImportOpen(false);
    setImportMode("menu");
    setImportText("");
  }

  const pal = PALETTES[paletteIdx];

  // displayPal: active palette + any user-edited swatch overrides
  const displayPal = useMemo(() => {
    const base = { ...pal };
    if (customSwatches[0]) base.bg = customSwatches[0];
    if (customSwatches[1]) base.surface = customSwatches[1];
    if (customSwatches[2]) base.accent = customSwatches[2];
    if (customSwatches[3]) base.text = customSwatches[3];
    if (customSwatches[4]) base.primary = customSwatches[4];
    if (customSwatches[5]) base.secondary = customSwatches[5];
    return base;
  }, [pal, customSwatches]);

  // Build a swatch grid from the active palette
  const swatches = useMemo(() => {
    const base = [pal.bg, pal.surface, pal.accent, pal.text, pal.primary, pal.secondary];
    // Add some generated variants to fill a realistic grid
    const extras: string[] = [];
    base.forEach((hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      extras.push(
        "#" + [Math.min(255, r + 40), Math.min(255, g + 40), Math.min(255, b + 40)].map((v) => v.toString(16).padStart(2, "0")).join(""),
        "#" + [Math.max(0, r - 30), Math.max(0, g - 30), Math.max(0, b - 30)].map((v) => v.toString(16).padStart(2, "0")).join("")
      );
    });
    return [...base, ...extras].slice(0, 18);
  }, [pal]);

  const activeColor = selectedSwatch !== null
    ? (customSwatches[selectedSwatch] ?? swatches[selectedSwatch])
    : displayPal.accent;
  const bgForContrast = selectedSwatch !== null && selectedSwatch > 0
    ? (customSwatches[0] ?? swatches[0])
    : displayPal.bg;
  const ratio = contrastRatio(activeColor, bgForContrast);
  const passAANorm = ratio >= 4.5;
  const passAAANorm = ratio >= 7;
  const passAALarge = ratio >= 3;
  const passAAALarge = ratio >= 4.5;

  // Auto-play
  useEffect(() => {
    if (!autoPlay) return;
    const t = setInterval(() => {
      setTransitioning(true);
      setTimeout(() => {
        setPaletteIdx((i) => (i + 1) % PALETTES.length);
        setSelectedSwatch(null);
        setTransitioning(false);
      }, 250);
    }, 3800);
    return () => clearInterval(t);
  }, [autoPlay]);

  // Sync editingHex when active palette changes
  useEffect(() => {
    setEditingHex(PALETTES[paletteIdx].accent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteIdx]);

  const pick = (i: number) => {
    setAutoPlay(false);
    setCustomSwatches({});
    setTransitioning(true);
    setTimeout(() => { setPaletteIdx(i); setSelectedSwatch(null); setTransitioning(false); }, 250);
  };

  // Handler: user clicks a colored element in the site preview
  const handleSiteColorClick = (role: "accent" | "surface" | "bg" | "text") => {
    const roleToIdx: Record<string, number> = { bg: 0, surface: 1, accent: 2, text: 3 };
    const idx = roleToIdx[role] ?? 2;
    setSelectedSwatch(idx);
    setEditingHex(customSwatches[idx] ?? swatches[idx]);
    setAutoPlay(false);
  };

  // CSS variable palette for the popup theming
  const pv = popupTheme === "dark"
    ? { "--pl-primary": "#818cf8", "--pl-bg": "#0f172a", "--pl-fg": "#e2e8f0", "--pl-fg-muted": "#94a3b8", "--pl-border": "#334155", "--pl-hover": "#1e293b", "--pl-surface": "#1e293b", "--pl-card": "#1e293b" }
    : { "--pl-primary": "#6366f1", "--pl-bg": "#ffffff", "--pl-fg": "#1e293b", "--pl-fg-muted": "#64748b", "--pl-border": "#e2e8f0", "--pl-hover": "#f1f5f9", "--pl-surface": "#f8fafc", "--pl-card": "#ffffff" };

  return (
    <div
      className={"relative overflow-hidden rounded-2xl transition-all duration-500 " + (theme === "dark" ? "" : "")}
      style={{
        background: theme === "dark"
          ? `radial-gradient(900px 400px at 50% 0%, ${displayPal.accent}15, transparent 60%), #0a0a0f`
          : `radial-gradient(800px 350px at 50% 0%, ${displayPal.accent}10, transparent 55%), #f5f5f7`,
        boxShadow: theme === "dark"
          ? "0 0 0 1px rgba(255,255,255,0.07), 0 32px 80px rgba(0,0,0,0.6)"
          : "0 0 0 1px rgba(0,0,0,0.08), 0 20px 60px rgba(0,0,0,0.12)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif",
      }}
    >
      {/* ── macOS window title bar ── */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: theme === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", borderBottom: theme === "dark" ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)", backdropFilter: "blur(20px)" }}>
        <div className="flex items-center gap-2">
          <div className={"text-xs font-semibold " + (theme === "dark" ? "text-white/40" : "text-slate-500")}>PaletteLive — Interactive Demo</div>
          {/* Theme toggle — lives here since it only affects the demo panel */}
          <button
            onClick={() => { setAutoPlay(false); setPopupTheme((t) => t === "dark" ? "light" : "dark"); }}
            className="rounded-xl px-3 py-1 text-[11px] font-semibold transition"
            style={{ border: "1px solid " + (theme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"), color: theme === "dark" ? "rgba(255,255,255,0.80)" : "rgba(0,0,0,0.55)", background: theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }}
            title="Toggle panel theme (dark/light)"
          >
            Theme: {popupTheme === "dark" ? "Dark" : "Light"}
          </button>
        </div>
        <div id="pl-tour-palettes" className="flex items-center gap-1.5">
            {PALETTES.map((p, i) => (
            <button
              key={p.name}
              onClick={() => pick(i)}
              className={"flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 " + (i === paletteIdx
                ? (theme === "dark" ? "bg-white/12 text-white ring-1 ring-white/15" : "bg-black/8 text-slate-900 ring-1 ring-black/10")
                : (theme === "dark" ? "text-white/35 hover:text-white/60" : "text-slate-400 hover:text-slate-600"))}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: p.accent, boxShadow: i === paletteIdx ? `0 0 6px ${p.accent}88` : "none" }} />
              <span className="hidden sm:inline">{p.name}</span>
            </button>
          ))}
          <button
            onClick={() => setAutoPlay((v) => !v)}
            className={"ml-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition " + (autoPlay
              ? (theme === "dark" ? "bg-white/10 text-white/80 ring-1 ring-white/12" : "bg-black/6 text-slate-700 ring-1 ring-black/8")
              : (theme === "dark" ? "text-white/30" : "text-slate-400"))}
          >
            {autoPlay ? "⏸" : "▶"}
          </button>
        </div>
      </div>

      <div className={"grid gap-0 lg:grid-cols-[1.7fr_1fr] transition-opacity duration-300 " + (transitioning ? "opacity-30 scale-[0.995]" : "opacity-100 scale-100")}>

        {/* ═════════════════════════════════════════
            LEFT: Chrome Browser + Real PaletteLive Editor (Sidepanel)
           ═════════════════════════════════════════ */}
        <div className="p-2 sm:p-3 flex flex-col gap-2" style={pv as React.CSSProperties}>

          {/* ══ macOS / Apple-style Chrome browser window ══ */}
          <div className="overflow-hidden rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] relative" style={{ border: "1px solid rgba(0,0,0,0.28)", background: "#292929", minHeight: selectedSwatch !== null ? 420 : 580, flex: "1 1 auto", transition: "min-height 0.4s ease" }}>
            {/* SVG color-blindness simulation defs */}
            <svg width="0" height="0" style={{ position: "absolute", pointerEvents: "none" }} aria-hidden="true">
              <defs>
                <filter id="vf-protanopia"><feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0"/></filter>
                <filter id="vf-deuteranopia"><feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0"/></filter>
                <filter id="vf-tritanopia"><feColorMatrix type="matrix" values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0"/></filter>
              </defs>
            </svg>

            {/* ── Top-left window chrome: traffic lights + tab bar ── */}
            <div className="absolute top-0 left-0 right-0 z-50 flex items-start gap-1 px-3 pt-1.5" style={{ background: "#3c3c3c", height: 38 }}>
              {/* macOS traffic lights */}
              <div className="flex items-center gap-[5px] flex-shrink-0 mt-1">
                <span className="block rounded-full" style={{ width: 11, height: 11, background: "#FF5F57", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.25)" }} />
                <span className="block rounded-full" style={{ width: 11, height: 11, background: "#FEBC2E", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.25)" }} />
                <span className="block rounded-full" style={{ width: 11, height: 11, background: "#28C840", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.25)" }} />
              </div>
              {/* Active tab — SVG-shaped Chrome tab */}
              <div className="relative flex-shrink-0 ml-1" style={{ width: 200, height: 28 }}>
                <svg width="200" height="28" viewBox="0 0 200 28" fill="none" style={{ position: "absolute", inset: 0 }}>
                  <path d="M0 28 C6 28 8 26 10 22 L14 4 C15.5 1 17 0 20 0 L180 0 C183 0 184.5 1 186 4 L190 22 C192 26 194 28 200 28 Z" fill="#f1f3f4"/>
                </svg>
                <div className="absolute inset-0 flex items-center gap-1.5 px-5">
                  <div className="h-3 w-3 rounded-sm flex-shrink-0 transition-colors duration-500" style={{ background: displayPal.accent }} />
                  <span className="flex-1 min-w-0 truncate text-[11px] font-medium" style={{ color: "#3c4043" }}>palettelive.mckesav.in</span>
                  <button className="flex-shrink-0 rounded-full p-0.5 hover:bg-black/10 transition">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="#777" strokeWidth="1.6"><path d="M1 1l6 6M7 1l-6 6"/></svg>
                  </button>
                </div>
              </div>
              {/* New tab + button */}
              <button className="mt-1.5 ml-1 h-5 w-5 flex items-center justify-center rounded hover:bg-white/10 transition flex-shrink-0">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8"><path d="M6 1v10M1 6h10"/></svg>
              </button>
            </div>

            {/* ── Omnibar / address bar (below tab bar) ── */}
            <div className="flex items-center gap-1.5 px-3 py-2 mt-10" style={{ background: "#f1f3f4" }}>
              <button className="rounded-full p-1.5 text-gray-400 hover:bg-gray-200 transition">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M8.5 1.5L3.5 6l5 4.5"/></svg>
              </button>
              <button className="rounded-full p-1.5 text-gray-300 transition">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M3.5 1.5L8.5 6l-5 4.5"/></svg>
              </button>
              <button className="rounded-full p-1.5 text-gray-500 hover:bg-gray-200 transition">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 6a5 5 0 1 1-1-3.1L11 1.5"/><polyline points="11 1.5 11 4 8.5 4"/></svg>
              </button>
              {/* URL bar pill */}
              <div className="flex flex-1 items-center gap-2 rounded-full px-3 py-1.5" style={{ background: "white", border: "1px solid #dadce0", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#9aa0a6" strokeWidth="1.5"><circle cx="5.2" cy="5.2" r="4"/><path d="M8.5 8.5l2.5 2.5"/></svg>
                <span className="text-[11px] font-medium" style={{ color: "#202124" }}>palettelive.mckesav.in</span>
              </div>
              {/* Profile avatar */}
              <div className="h-6 w-6 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "#4285f4" }}>M</div>
              <button className="p-1">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="#80868b"><circle cx="7" cy="2.5" r="1.2"/><circle cx="7" cy="7" r="1.2"/><circle cx="7" cy="11.5" r="1.2"/></svg>
              </button>
            </div>

            {/* ── Bookmarks bar ── */}
            <div className="flex items-center gap-0 px-3 py-1" style={{ background: "#f1f3f4", borderBottom: "1px solid #e0e0e0" }}>
              <button className="flex items-center gap-1 mr-1 rounded px-2 py-0.5 hover:bg-gray-200 transition text-[10px]" style={{ color: "#3c4043" }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="#5f6368"><rect x=".5" y=".5" width="3.5" height="3.5" rx=".5"/><rect x="6" y=".5" width="3.5" height="3.5" rx=".5"/><rect x=".5" y="6" width="3.5" height="3.5" rx=".5"/><rect x="6" y="6" width="3.5" height="3.5" rx=".5"/></svg>
                Apps
              </button>
              <button className="flex items-center gap-1 mr-1 rounded px-2 py-0.5 hover:bg-gray-200 transition text-[10px] italic" style={{ color: "#888" }}>Reading list</button>
              <div className="ml-auto">
                <button className="flex items-center gap-1 rounded px-2 py-0.5 hover:bg-gray-200 transition text-[10px]" style={{ color: "#3c4043" }}>
                  Other Bookmarks
                  <svg width="7" height="7" viewBox="0 0 7 7" fill="none" stroke="#9aa0a6" strokeWidth="1.3"><path d="M1 2l2.5 2.5L6 2"/></svg>
                </button>
              </div>
            </div>

              {/* ── Website viewport — PaletteLive recolors this ── */}
            {(() => {
              const filterMap: Record<string, string> = {
                protanopia: "url(#vf-protanopia)",
                deuteranopia: "url(#vf-deuteranopia)",
                tritanopia: "url(#vf-tritanopia)",
                achromatopsia: "grayscale(100%)",
              };
              const visionFilter = filterMap[visionSim] ?? "none";
              const origPal: PaletteData = { name: "Original", bg: "#f3f4f6", surface: "#ffffff", accent: "#4f46e5", text: "#111827", primary: "#4f46e5", secondary: "#7c3aed" };
              return (
                <div
                  className="relative overflow-hidden"
                  style={{ filter: visionFilter, transition: "filter 0.35s", cursor: compareOn ? "col-resize" : undefined }}
                  onPointerMove={(e) => {
                    if (!isDraggingCompare.current) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
                    setCompareSplit(pct);
                  }}
                  onPointerUp={() => { isDraggingCompare.current = false; }}
                  onPointerLeave={() => { isDraggingCompare.current = false; }}
                >
                  <SitePreview pal={displayPal} heatmapOn={heatmapOn} onColorClick={handleSiteColorClick} />
                  {/* Compare mode: overlay left portion with "before" colors — draggable */}
                  {compareOn && (
                    <>
                      <div className="absolute inset-0 z-20 pointer-events-none" style={{ clipPath: `inset(0 ${100 - compareSplit}% 0 0)` }}>
                        <SitePreview pal={origPal} />
                      </div>
                      {/* Draggable divider */}
                      <div
                        className="absolute top-0 bottom-0 z-30 flex items-center justify-center"
                        style={{ left: `calc(${compareSplit}% - 12px)`, width: 24, cursor: "col-resize" }}
                        onPointerDown={(e) => {
                          isDraggingCompare.current = true;
                          e.currentTarget.setPointerCapture(e.pointerId);
                        }}
                        onPointerMove={(e) => {
                          if (!isDraggingCompare.current) return;
                          const viewport = e.currentTarget.closest(".relative.overflow-hidden") as HTMLElement;
                          if (!viewport) return;
                          const rect = viewport.getBoundingClientRect();
                          const pct = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
                          setCompareSplit(pct);
                        }}
                        onPointerUp={() => { isDraggingCompare.current = false; }}
                      >
                        <div style={{ position: "absolute", left: 11, top: 0, bottom: 0, width: 2, background: "rgba(255,255,255,0.92)", boxShadow: "0 0 8px rgba(0,0,0,0.45)" }} />
                        <div className="rounded-full shadow-lg flex items-center gap-1 px-2 py-0.5 select-none" style={{ background: "white", fontSize: 8, fontWeight: 700, color: "#374151", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.25)", zIndex: 1, position: "relative" }}>
                          <span style={{ color: "#9ca3af" }}>⠿</span>
                          <span style={{ opacity: 0.5 }}>Before</span>
                          <span style={{ color: "#9ca3af" }}>↔</span>
                          <span style={{ color: displayPal.accent }}>After</span>
                          <span style={{ color: "#9ca3af" }}>⠿</span>
                        </div>
                      </div>
                    </>
                  )}
                  {/* Heatmap floating tooltip */}
                  {heatmapOn && (
                    <div className="absolute right-3 top-10 z-20 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 shadow-xl" style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)" }}>
                      <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0 transition-colors duration-500" style={{ background: displayPal.accent }} />
                      <span style={{ fontFamily: "'SF Mono', 'Cascadia Code', monospace", fontSize: 10, color: "#fff" }}>{displayPal.accent.toUpperCase()}</span>
                    </div>
                  )}
                  {/* Scan animation overlay */}
                  <div
                    className="absolute inset-0 z-50 pointer-events-none transition-opacity duration-500"
                    style={{ opacity: scanAnim ? 1 : 0, background: `linear-gradient(180deg, transparent 0%, ${displayPal.accent}22 50%, transparent 100%)` }}
                  />
                  {scanAnim && (
                    <div
                      className="absolute left-0 right-0 z-[51] pointer-events-none"
                      style={{
                        height: 2,
                        background: displayPal.accent,
                        boxShadow: `0 0 8px ${displayPal.accent}, 0 0 16px ${displayPal.accent}88`,
                        animation: "plScanLine 0.6s linear",
                        top: 0,
                      }}
                    />
                  )}
                  {/* Selected element highlight tooltip */}
                  {selectedSwatch !== null && !compareOn && (
                    <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 shadow-xl" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}>
                      <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: activeColor, border: "1px solid rgba(255,255,255,0.2)" }} />
                      <span style={{ fontFamily: "'SF Mono', monospace", fontSize: 10, color: "#fff" }}>{activeColor.toUpperCase()}</span>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>· swatch #{selectedSwatch + 1}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── PaletteLive extension status bar ── */}
            <div className="flex items-center justify-between px-3 py-1.5" style={{ background: "#f1f3f4", borderTop: "1px solid #e0e0e0" }}>
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="h-2 w-2 flex-shrink-0 rounded-full transition-colors duration-500" style={{ background: pal.accent }} />
                <span className="text-[10px] font-medium truncate" style={{ color: "#5f6368" }}>
                  {heatmapOn ? "Heatmap active" : compareOn ? "Compare: Before ↔ After" : visionSim !== "none" ? `Vision: ${visionSim}` : "PaletteLive active"}
                </span>
                <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold transition-colors duration-500" style={{ background: pal.accent + "28", color: pal.accent }}>{pal.name}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#28C840" }} />
                <span className="text-[9px]" style={{ color: "#9aa0a6" }}>Watchdog</span>
              </div>
            </div>
          </div>

          {/* ══ PaletteLive Editor sidepanel card ══ */}
          <div
            id="pl-tour-editor"
            ref={editorRef}
            className="overflow-hidden rounded-2xl border shadow-lg"
            style={{
              borderColor: "var(--pl-border)",
              background: "var(--pl-bg)",
              color: "var(--pl-fg)",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              fontSize: 13,
              transition: "opacity 0.3s ease, transform 0.3s ease, max-height 0.35s ease",
              opacity: selectedSwatch !== null ? 1 : 1,
              maxHeight: selectedSwatch !== null ? 900 : 80,
              overflow: "hidden",
            }}
          >
            {/* Panel header */}
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: selectedSwatch !== null ? "1px solid var(--pl-border)" : "none", background: "var(--pl-surface)" }}>
              <img src="/logo.png" alt="PaletteLive Logo" className="h-5 w-5 rounded-md flex-shrink-0" />
              <span style={{ fontWeight: 600, fontSize: 14, color: "var(--pl-primary)", flex: 1 }}>PaletteLive Editor</span>
              {selectedSwatch === null && (
                <span style={{ fontSize: 11, color: "var(--pl-fg-muted)", fontStyle: "italic" }}>← click a color swatch</span>
              )}
            </div>

            {/* Waiting state — shown when no swatch selected */}
            {selectedSwatch === null && (
              <div className="flex items-center justify-center gap-2 py-3 px-3" style={{ color: "var(--pl-fg-muted)", borderTop: "1px solid var(--pl-border)" }}>
                <span style={{ fontSize: 16, opacity: 0.5 }}>🎨</span>
                <p style={{ fontSize: 11, lineHeight: 1.4 }}>Click any color swatch to start editing</p>
              </div>
            )}

            {/* Editor content — only shown when a swatch is selected */}
            {selectedSwatch !== null && (
            <div className="px-3 py-2 space-y-2">
            {/* Hex input + color picker + swatch bar in one row */}
            {tourStep === 4 && (
              <div style={{ fontSize: 11, fontWeight: 700, color: displayPal.accent, display: "flex", alignItems: "center", gap: 4, animation: "pulse 1.5s ease-in-out infinite" }}>
                <span>▼</span> Change color here
              </div>
            )}
            <div className="flex items-center gap-2" style={tourStep === 4 ? { boxShadow: `0 0 0 2px ${displayPal.accent}, 0 0 16px ${displayPal.accent}55`, borderRadius: 8, padding: 4, transition: "box-shadow 0.3s", animation: "pulse 1.5s ease-in-out infinite" } : undefined}>
              <input
                type="text"
                value={editingHex}
                onChange={(e) => {
                  setAutoPlay(false);
                  const v = e.target.value;
                  setEditingHex(v);
                  if (/^#[0-9a-fA-F]{6}$/.test(v) && selectedSwatch !== null) {
                    setCustomSwatches((s) => ({ ...s, [selectedSwatch]: v }));
                  }
                }}
                maxLength={7}
                spellCheck={false}
                className="flex-1 rounded-md px-2 py-1"
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: "'SF Mono', 'Cascadia Code', monospace",
                  color: "var(--pl-fg)",
                  border: "1px solid var(--pl-border)",
                  background: "var(--pl-surface)",
                  outline: "none",
                  textTransform: "uppercase",
                  minWidth: 0,
                }}
              />
              <label style={{ cursor: "pointer", position: "relative", flexShrink: 0 }} title="Open color picker">
                <input
                  id="pl-color-picker-input"
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(editingHex) ? editingHex : "#000000"}
                  onChange={(e) => {
                    setAutoPlay(false);
                    const v = e.target.value;
                    setEditingHex(v);
                    if (selectedSwatch !== null) {
                      setCustomSwatches((s) => ({ ...s, [selectedSwatch]: v }));
                    }
                  }}
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
                />
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: /^#[0-9a-fA-F]{6}$/.test(editingHex) ? editingHex : activeColor,
                    border: "2px solid var(--pl-border)",
                    transition: "background 0.1s",
                  }}
                />
              </label>
            </div>

            {/* Color swatch bar — clicking opens the color picker */}
            <label htmlFor="pl-color-picker-input" className="block rounded p-0.5 transition-colors duration-500" style={{ border: tourStep === 4 ? `2px solid ${displayPal.accent}` : "2px solid var(--pl-border)", height: 32, cursor: "pointer", boxShadow: tourStep === 4 ? `0 0 12px ${displayPal.accent}55` : "none", transition: "border-color 0.3s, box-shadow 0.3s" }} title="Open color picker">
              <div className="h-full w-full rounded transition-colors duration-150" style={{ background: /^#[0-9a-fA-F]{6}$/.test(editingHex) ? editingHex : activeColor }} />
            </label>

            {/* Real-time toggle + export select on one row */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize: 12, color: "var(--pl-fg)" }}>
                <input type="checkbox" checked={realtimeOn} onChange={() => { setAutoPlay(false); setRealtimeOn((v) => !v); }} style={{ width: 13, height: 13, accentColor: "var(--pl-primary)" }} />
                Real-time preview
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize: 12, color: "var(--pl-fg)" }}>
                <input type="checkbox" checked={exportSelectOn} onChange={() => { setAutoPlay(false); setExportSelectOn((v) => !v); }} style={{ width: 13, height: 13, accentColor: "var(--pl-primary)" }} />
                Include in export
              </label>
            </div>

            {/* Variable info */}
            <div className="rounded px-2 py-1" style={{ background: "var(--pl-surface)", border: "1px solid var(--pl-border)", fontSize: 11, color: "var(--pl-fg-muted)" }}>
              CSS variable: <span style={{ fontFamily: "monospace", color: "var(--pl-fg)" }}>--accent-primary</span> (used 14x)
            </div>

            <button
              onClick={() => {
                if (selectedSwatch !== null && /^#[0-9a-fA-F]{6}$/.test(editingHex)) {
                  setCustomSwatches((s) => ({ ...s, [selectedSwatch]: editingHex }));
                }
              }}
              className="w-full rounded py-1.5 text-xs font-medium transition" style={{ background: "var(--pl-surface)", border: "1px solid var(--pl-border)", color: "var(--pl-fg)", opacity: selectedSwatch !== null ? 1 : 0.45, cursor: selectedSwatch !== null ? "pointer" : "not-allowed" }}
            >
              Apply Color To Export Set
            </button>

            {/* WCAG Contrast Checker */}
            <div style={{ borderTop: "1px solid var(--pl-border)", paddingTop: 8 }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span style={{ textTransform: "uppercase", fontSize: 9, letterSpacing: 1, color: "var(--pl-fg-muted)", fontWeight: 600 }}>Contrast</span>
                <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "'SF Mono', 'Cascadia Code', monospace", color: "var(--pl-fg)" }}>{ratio.toFixed(2)}:1</span>
                <span className="rounded px-2 py-0.5" style={{ fontSize: 10, fontWeight: 600, background: passAANorm ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: passAANorm ? "#22c55e" : "#ef4444" }}>
                  {passAAANorm ? "AAA" : passAANorm ? "AA" : "Fail"}
                </span>
                <span style={{ fontSize: 10, color: "var(--pl-fg-muted)" }}>vs target</span>
              </div>
              {/* WCAG grid — 2×2 */}
              <div className="grid grid-cols-2 gap-1">
                {[
                  { label: "AA normal", pass: passAANorm },
                  { label: "AAA normal", pass: passAAANorm },
                  { label: "AA large", pass: passAALarge },
                  { label: "AAA large", pass: passAAALarge },
                ].map((row) => (
                  <div key={row.label} className="rounded px-2 py-0.5" style={{ fontSize: 11, color: row.pass ? "#22c55e" : "#ef4444", background: row.pass ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)" }}>
                    {row.label}: {row.pass ? "Pass" : "Fail"}
                  </div>
                ))}
              </div>
            </div>
            </div>)}{/* end editor content */}
          </div>{/* end editor card */}
        </div>

        {/* ═════════════════════════════════════════
            RIGHT: Real PaletteLive Popup Replica
           ═════════════════════════════════════════ */}
        <div className="p-2 sm:p-3 flex flex-col gap-2" style={pv as React.CSSProperties}>
          <div className="overflow-hidden rounded-2xl border shadow-lg" style={{ borderColor: "var(--pl-border)", background: "var(--pl-bg)", color: "var(--pl-fg)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: 13 }}>

            {/* Popup header */}
            <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid var(--pl-border)", background: "var(--pl-bg)", position: "sticky", top: 0, zIndex: 10 }}>
              <div className="flex items-center gap-2" style={{ fontWeight: 700, fontSize: 15, color: "var(--pl-primary)" }}>
                <div className="h-6 w-6 rounded-md bg-white p-0.5 flex items-center justify-center">
                  <img src="/logo.png" alt="PaletteLive Logo" className="h-full w-full object-contain rounded-md" />
                </div>
                <a href="https://palettelive.mckesav.in" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>PaletteLive</a>
              </div>
              <div className="flex items-center gap-1">
                {/* Power toggle */}
                <button onClick={() => { setAutoPlay(false); setExtensionPaused((v) => !v); }} className="rounded p-1 transition" style={{ border: `1px solid ${extensionPaused ? "#ef4444" : "#22c55e"}`, color: extensionPaused ? "#ef4444" : "#22c55e", background: extensionPaused ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)" }} title={extensionPaused ? "Extension paused — click to resume" : "Extension enabled — click to pause"} aria-label="Toggle extension" aria-pressed={!extensionPaused}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                </button>
                {/* Undo */}
                <button className="rounded p-1 transition" style={{ border: "1px solid var(--pl-border)", color: "var(--pl-fg-muted)", opacity: 0.4, cursor: "not-allowed" }} disabled title="Undo Last Change" aria-label="Undo Last Change">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-1"/></svg>
                </button>
                {/* Redo */}
                <button className="rounded p-1 transition" style={{ border: "1px solid var(--pl-border)", color: "var(--pl-fg-muted)", opacity: 0.4, cursor: "not-allowed" }} disabled title="Redo Last Undone Change" aria-label="Redo Last Undone Change">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h1"/></svg>
                </button>
                {/* Reset */}
                <button
                  className="rounded p-1 transition"
                  style={{ border: "1px solid " + (resetAnim ? "#ef4444" : "var(--pl-border)"), color: resetAnim ? "#ef4444" : "var(--pl-fg-muted)", background: resetAnim ? "rgba(239,68,68,0.08)" : "transparent" }}
                  title="Reset All Overrides"
                  aria-label="Reset All Overrides"
                  onClick={() => {
                    setCustomSwatches({});
                    setResetAnim(true);
                    setTimeout(() => setResetAnim(false), 1200);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                </button>
              </div>
            </div>

            {/* Disabled banner */}
            {extensionPaused && (
              <div className="flex items-center gap-2 px-3 py-2" style={{ background: "#fef2f2", borderBottom: "1px solid #fecaca", color: "#991b1b", fontSize: 12 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                <span>PaletteLive is <strong>paused</strong> on this site. Click the power button to resume.</span>
              </div>
            )}

            {/* Palette mode selector */}
            <section className="px-3 py-2" style={{ borderBottom: "1px solid var(--pl-border)", opacity: extensionPaused ? 0.35 : 1, pointerEvents: extensionPaused ? "none" : "auto" }} aria-label="Palette view mode">
              <div className="flex items-center gap-2">
                <label htmlFor="pl-palette-mode" style={{ fontSize: 12, fontWeight: 600, color: "var(--pl-fg)", whiteSpace: "nowrap" }}>Palette</label>
                <select
                  id="pl-palette-mode"
                  value={paletteMode}
                  onChange={(e) => setPaletteMode(e.target.value)}
                  className="flex-1 rounded-md px-2 py-1 text-xs"
                  style={{ border: "1px solid var(--pl-border)", background: "var(--pl-surface)", color: "var(--pl-fg)", fontSize: 12, outline: "none" }}
                >
                  <option value="apply-palette" title="Paste custom hex colors or a Coolors URL to apply your own palette to the page">Apply Palette (Default)</option>
                  <option value="60-30-10" title="Groups scanned colors by visual weight: 60% dominant, 30% secondary, 10% accent">60-30-10 Rule</option>
                  <option value="monochromatic" title="Shows shades and tints of a single base hue found on the page">Monochromatic</option>
                  <option value="analogous" title="Displays colors that sit next to each other on the color wheel for a harmonious look">Analogous</option>
                  <option value="complementary" title="Pairs colors from opposite sides of the color wheel for high contrast">Complementary</option>
                  <option value="split-complementary" title="Uses one base color plus two colors adjacent to its complement">Split-Complementary</option>
                  <option value="triadic" title="Three colors evenly spaced around the color wheel for balanced, vibrant variety">Triadic</option>
                  <option value="advanced" title="Shows every detected color on the page without grouping — useful for full audits">Advanced (All Colors)</option>
                </select>
              </div>
            </section>

            {/* Apply palette controls */}
            <section className="px-3 py-2 space-y-2" style={{ borderBottom: "1px solid var(--pl-border)", opacity: extensionPaused ? 0.35 : 1, pointerEvents: extensionPaused ? "none" : "auto" }} aria-label="Apply custom palette">
              <div className="flex items-center gap-1">
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--pl-fg-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Mapping</span>
                <button onClick={() => setMappingMode("auto")} className="rounded-full px-2.5 py-0.5 transition" style={{ fontSize: 11, fontWeight: 500, border: "1px solid " + (mappingMode === "auto" ? "var(--pl-primary)" : "var(--pl-border)"), background: mappingMode === "auto" ? "var(--pl-primary)" : "var(--pl-surface)", color: mappingMode === "auto" ? "#fff" : "var(--pl-fg-muted)" }}>Auto</button>
                <button onClick={() => setMappingMode("manual")} className="rounded-full px-2.5 py-0.5 transition" style={{ fontSize: 11, fontWeight: 500, border: "1px solid " + (mappingMode === "manual" ? "var(--pl-primary)" : "var(--pl-border)"), background: mappingMode === "manual" ? "var(--pl-primary)" : "var(--pl-surface)", color: mappingMode === "manual" ? "#fff" : "var(--pl-fg-muted)" }}>Manual</button>
              </div>
              {mappingMode === "auto" ? (
                <div style={{ fontSize: 11, color: "var(--pl-fg-muted)", lineHeight: 1.3 }}>
                  Paste 3–8 hex colors (e.g. <code style={{ fontSize: 10, background: "var(--pl-surface)", padding: "1px 3px", borderRadius: 3 }}>#264653, #2a9d8f, #e9c46a</code>) or a Coolors URL.
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "var(--pl-fg-muted)", lineHeight: 1.3 }}>
                  Drag the color chips to assign roles: <strong>1=Primary · 2=Secondary · 3=Bg · 4=Text · 5=Accent</strong>
                </div>
              )}

              {/* Harmony generator panels (shown when a harmony mode is selected) */}
              {paletteMode !== "apply-palette" && paletteMode !== "advanced" && (
                <div className="space-y-2 rounded-md p-2" style={{ background: "var(--pl-hover)", border: "1px solid var(--pl-border)" }}>
                  {paletteMode === "monochromatic" && (
                    <div className="flex items-center gap-2">
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--pl-fg-muted)", marginBottom: 2 }}>Base Color</div>
                        <input type="color" value={genBaseColor} onChange={(e) => setGenBaseColor(e.target.value)} style={{ width: 32, height: 24, border: "1px solid var(--pl-border)", borderRadius: 4, cursor: "pointer" }} />
                      </div>
                      <div className="flex-1">
                        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--pl-fg-muted)", marginBottom: 2 }}>Variants: <span style={{ color: "var(--pl-fg)" }}>{genMonoCount}</span></div>
                        <input type="range" min={3} max={6} value={genMonoCount} onChange={(e) => setGenMonoCount(+e.target.value)} className="w-full" style={{ accentColor: "var(--pl-primary)" }} />
                      </div>
                    </div>
                  )}
                  {paletteMode === "60-30-10" && (
                    <div className="flex items-center gap-2">
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--pl-fg-muted)", marginBottom: 2 }}>60% Dominant</div>
                        <input type="color" value={gen60Color} onChange={(e) => setGen60Color(e.target.value)} style={{ width: 32, height: 24, border: "1px solid var(--pl-border)", borderRadius: 4, cursor: "pointer" }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--pl-fg-muted)", marginBottom: 2 }}>30% Secondary</div>
                        <input type="color" value={gen30Color} onChange={(e) => setGen30Color(e.target.value)} style={{ width: 32, height: 24, border: "1px solid var(--pl-border)", borderRadius: 4, cursor: "pointer" }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--pl-fg-muted)", marginBottom: 2 }}>10% Accent</div>
                        <input type="color" value={gen10Color} onChange={(e) => setGen10Color(e.target.value)} style={{ width: 32, height: 24, border: "1px solid var(--pl-border)", borderRadius: 4, cursor: "pointer" }} />
                      </div>
                    </div>
                  )}
                  {paletteMode === "analogous" && (
                    <div className="flex items-center gap-2">
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--pl-fg-muted)", marginBottom: 2 }}>Base Color</div>
                        <input type="color" value={genBaseColor} onChange={(e) => setGenBaseColor(e.target.value)} style={{ width: 32, height: 24, border: "1px solid var(--pl-border)", borderRadius: 4, cursor: "pointer" }} />
                      </div>
                      <div className="flex-1">
                        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--pl-fg-muted)", marginBottom: 2 }}>Spread Angle: <span style={{ color: "var(--pl-fg)" }}>{genAnalogSpread}°</span></div>
                        <input type="range" min={10} max={60} value={genAnalogSpread} onChange={(e) => setGenAnalogSpread(+e.target.value)} className="w-full" style={{ accentColor: "var(--pl-primary)" }} />
                      </div>
                    </div>
                  )}
                  {paletteMode === "complementary" && (
                    <div>
                      <div className="flex items-center gap-2">
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--pl-fg-muted)", marginBottom: 2 }}>Base Color</div>
                          <input type="color" value={genBaseColor} onChange={(e) => setGenBaseColor(e.target.value)} style={{ width: 32, height: 24, border: "1px solid var(--pl-border)", borderRadius: 4, cursor: "pointer" }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--pl-fg-muted)", marginBottom: 2 }}>Complementary</div>
                          <input type="color" value={gen30Color} onChange={(e) => setGen30Color(e.target.value)} style={{ width: 32, height: 24, border: "1px solid var(--pl-border)", borderRadius: 4, cursor: "pointer" }} />
                        </div>
                      </div>
                      <p style={{ fontSize: 10, color: "var(--pl-fg-muted)", marginTop: 4 }}>Generates 5 variants (shades and tints) automatically.</p>
                    </div>
                  )}
                  {paletteMode === "split-complementary" && (
                    <div className="flex items-center gap-2">
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--pl-fg-muted)", marginBottom: 2 }}>Base Color</div>
                        <input type="color" value={genBaseColor} onChange={(e) => setGenBaseColor(e.target.value)} style={{ width: 32, height: 24, border: "1px solid var(--pl-border)", borderRadius: 4, cursor: "pointer" }} />
                      </div>
                      <div className="flex-1">
                        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--pl-fg-muted)", marginBottom: 2 }}>Gap Angle: <span style={{ color: "var(--pl-fg)" }}>{genSplitGap}°</span></div>
                        <input type="range" min={15} max={60} step={5} value={genSplitGap} onChange={(e) => setGenSplitGap(+e.target.value)} className="w-full" style={{ accentColor: "var(--pl-primary)" }} />
                      </div>
                    </div>
                  )}
                  {paletteMode === "triadic" && (
                    <div>
                      <div className="flex items-center gap-2">
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--pl-fg-muted)", marginBottom: 2 }}>Base Color (Triangle Anchor)</div>
                          <input type="color" value={genBaseColor} onChange={(e) => setGenBaseColor(e.target.value)} style={{ width: 32, height: 24, border: "1px solid var(--pl-border)", borderRadius: 4, cursor: "pointer" }} />
                        </div>
                      </div>
                      <p style={{ fontSize: 10, color: "var(--pl-fg-muted)", marginTop: 4 }}>Generates three vibrant colors evenly spaced at 120° apart, along with 2 neutrals.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Custom palette paste input */}
              <textarea
                value={customPaletteInput}
                onChange={(e) => setCustomPaletteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    const hexes = customPaletteInput.match(/#[0-9a-fA-F]{6}/gi);
                    if (hexes && hexes.length >= 2) {
                      const next: Record<number, string> = {};
                      hexes.slice(0, 6).forEach((h, i) => { next[i] = h; });
                      setCustomSwatches(next);
                      setAutoPlay(false);
                      setEditingHex(hexes[2] ?? hexes[0]);
                    }
                  }
                }}
                rows={2}
                placeholder="#264653, #2a9d8f, #e9c46a, #f4a261, #e76f51"
                aria-label="Palette colors"
                className="w-full rounded-md px-2 py-1.5 text-xs resize-none"
                style={{ border: "1px solid var(--pl-border)", background: "var(--pl-surface)", color: "var(--pl-fg)", outline: "none", fontFamily: "inherit" }}
              />
              {/* Preview chips */}
              <div className="flex gap-1" id="apply-palette-preview">
                {[displayPal.bg, displayPal.surface, displayPal.accent, displayPal.text, displayPal.primary].map((c, i) => (
                  <div key={i} className="flex-1 rounded transition-colors duration-500" style={{ height: 28, background: c, border: "1px solid rgba(0,0,0,0.1)" }} />
                ))}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--pl-fg-muted)" }}>Presets:</span>
                {PALETTES.map((p, i) => (
                  <button key={p.name} onClick={() => pick(i)} className="rounded-full px-2 py-0.5 transition" style={{ fontSize: 10, border: "1px solid " + (i === paletteIdx ? "var(--pl-primary)" : "var(--pl-border)"), background: i === paletteIdx ? "var(--pl-primary)" : "var(--pl-surface)", color: i === paletteIdx ? "#fff" : "var(--pl-fg)" }} title={["Dark mode colors", "Deep blue → teal → sand", "Warm oranges & reds", "Earthy greens", "Clean neutrals", "Vibrant pastels"][i]}>{p.name}</button>
                ))}
              </div>
              <div className="flex gap-1.5" style={{ alignItems: "stretch" }}>
                <button
                  onClick={() => {
                    setApplyAnim(true);
                    setScanAnim(true);
                    setTimeout(() => setApplyAnim(false), 1200);
                    setTimeout(() => setScanAnim(false), 650);
                  }}
                  style={{ flex: 1, padding: "7px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, background: applyAnim ? "#22c55e" : "var(--pl-primary)", color: "#fff", cursor: "pointer", transition: "all 0.15s" }}
                >
                  {applyAnim ? "✓ Applied to Page!" : "Apply to Page"}
                </button>
                <button
                  onClick={() => {
                    setCustomSwatches({});
                    setCustomPaletteInput("");
                    setAutoPlay(false);
                    setResetAnim(true);
                    setScanAnim(true);
                    setTimeout(() => setResetAnim(false), 1200);
                    setTimeout(() => setScanAnim(false), 650);
                  }}
                  style={{ flex: "0 0 auto", padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: resetAnim ? "rgba(239,68,68,0.1)" : "var(--pl-surface)", border: "1px solid " + (resetAnim ? "#ef4444" : "var(--pl-border)"), color: resetAnim ? "#ef4444" : "var(--pl-fg)", cursor: "pointer", transition: "all 0.15s" }}
                  title="Remove palette overrides"
                >{resetAnim ? "✓ Reset!" : "Reset"}</button>
              </div>
              {/* Apply palette status */}
              {applyAnim && (
                <div style={{ fontSize: 11, color: "#22c55e", fontWeight: 500 }} aria-live="polite">Palette applied successfully — 18 colors mapped.</div>
              )}
            </section>

            {/* Palette summary */}
            <div className="px-3 py-1.5 flex items-center gap-1.5" style={{ borderBottom: "1px solid var(--pl-border)", background: "var(--pl-hover)", opacity: extensionPaused ? 0.35 : 1 }} aria-live="polite">
              <span style={{ fontSize: 11, color: "var(--pl-fg-muted)" }}>{swatches.length} colors found</span>
              <span style={{ fontSize: 10, color: "var(--pl-fg-muted)" }}>·</span>
              <span style={{ fontSize: 11, color: "var(--pl-primary)", fontWeight: 500 }}>{paletteMode === "apply-palette" ? "Apply Palette" : paletteMode === "advanced" ? "All Colors" : paletteMode}</span>
            </div>

            {/* Cluster controls (only shown in Advanced mode) */}
            {paletteMode === "advanced" && (
              <section className="px-3 py-2" style={{ borderBottom: "1px solid var(--pl-border)", opacity: extensionPaused ? 0.35 : 1, pointerEvents: extensionPaused ? "none" : "auto" }} aria-label="Palette clustering controls">
                <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 12, fontWeight: 500, color: "var(--pl-fg)" }}>
                  <input type="checkbox" checked={clusterOn} onChange={() => setClusterOn((v) => !v)} style={{ accentColor: "var(--pl-primary)" }} />
                  Merge similar shades
                </label>
                {clusterOn && (
                  <>
                    <div className="mt-1.5 flex items-center gap-2" style={{ fontSize: 11, color: "var(--pl-fg-muted)" }}>
                      <span style={{ fontWeight: 600 }}>{"\u0394"}E{"\u2080\u2080"}</span>
                      <input type="range" min={1} max={20} value={clusterThreshold} onChange={(e) => setClusterThreshold(+e.target.value)} className="flex-1" style={{ accentColor: "var(--pl-primary)" }} />
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--pl-fg)", minWidth: 16, textAlign: "right" }}>{clusterThreshold}</span>
                    </div>
                    <div className="mt-1" style={{ fontSize: 10, color: "var(--pl-fg-muted)" }} aria-live="polite">{swatches.length} colors merged into {Math.max(3, swatches.length - clusterThreshold)} clusters</div>
                  </>
                )}
              </section>
            )}

            {/* Swatch grid */}
            <div className="px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--pl-fg)" }}>Extracted</span>
                <span className="rounded-full px-1.5 py-0" style={{ fontSize: 10, fontWeight: 600, color: "var(--pl-fg-muted)", background: "var(--pl-hover)" }}>{swatches.length}</span>
                <span style={{ fontSize: 9, color: "var(--pl-fg-muted)", fontStyle: "italic", marginLeft: 2 }}>· click to edit</span>
              </div>
              <div id="pl-tour-swatches" className="grid grid-cols-9 gap-1">
                {swatches.map((c, i) => {
                  const swatchColor = customSwatches[i] ?? c;
                  const isEdited = !!customSwatches[i];
                  return (
                    <button
                      key={i}
                      onClick={() => { setAutoPlay(false); setSelectedSwatch(i); setEditingHex(swatchColor); setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60); }}
                      className="rounded-lg transition-all duration-200 relative"
                      style={{
                        aspectRatio: "1", background: swatchColor,
                        border: selectedSwatch === i ? "3px solid var(--pl-primary)" : `2px solid ${popupTheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                        transform: selectedSwatch === i ? "scale(1.08)" : "scale(1)",
                        boxShadow: selectedSwatch === i ? "0 0 0 3px rgba(99,102,241,0.25)" : "none",
                        cursor: "pointer",
                      }}
                      title={swatchColor.toUpperCase()}
                    >
                      {isEdited && (
                        <span style={{ position: "absolute", top: 1, right: 1, width: 5, height: 5, borderRadius: "50%", background: "#fff", boxShadow: "0 0 0 1px rgba(0,0,0,0.2)" }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-3 py-2 space-y-2" style={{ borderTop: "1px solid var(--pl-border)", background: "var(--pl-surface)" }}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => {
                    setAutoPlay(false);
                    setScanAnim(true);
                    setTimeout(() => setScanAnim(false), 650);
                    // Re-derive swatches by resetting custom overrides for non-edited swatches
                    setCustomSwatches((prev) => {
                      // keep only explicitly edited ones, remove generated extras
                      const kept: Record<number,string> = {};
                      Object.entries(prev).forEach(([k, v]) => { if (Number(k) < 6) kept[Number(k)] = v; });
                      return kept;
                    });
                  }}
                  className="rounded-md px-2.5 py-1 text-xs font-semibold transition-all duration-300"
                  style={{ background: "var(--pl-primary)", color: "#fff", border: "none" }}
                  title="Re-scan and refresh extracted color palette"
                >
                  Rescan
                </button>
                <button
                  onClick={() => {
                    setAutoPlay(false);
                    setFixTextAnim(true);
                    setTimeout(() => setFixTextAnim(false), 1400);
                    setCustomSwatches((prev) => fixTextContrast(swatches, prev));
                  }}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all duration-300"
                  style={{ border: "1px solid " + (fixTextAnim ? "#22c55e" : "var(--pl-border)"), background: fixTextAnim ? "rgba(34,197,94,0.1)" : "var(--pl-card)", color: fixTextAnim ? "#22c55e" : "var(--pl-fg)" }}
                  title="Auto-fix all low-contrast text colors to pass WCAG AA (4.5:1)"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/></svg>
                  {fixTextAnim ? "✓ Fixed!" : "Fix Text"}
                </button>
                {/* Force Reapply button */}
                <button
                  onClick={() => {
                    setAutoPlay(false);
                    setReapplyAnim(true);
                    setScanAnim(true);
                    setTimeout(() => setReapplyAnim(false), 1200);
                    setTimeout(() => setScanAnim(false), 650);
                  }}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all duration-300"
                  style={{ border: "1px solid " + (reapplyAnim ? "#22c55e" : "var(--pl-border)"), background: reapplyAnim ? "rgba(34,197,94,0.1)" : "var(--pl-card)", color: reapplyAnim ? "#22c55e" : "var(--pl-fg)" }}
                  title="Force re-apply all color overrides"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/><path d="M2.5 12a10 10 0 0 1 16.4-6.2L21.5 8"/><path d="M21.5 12a10 10 0 0 1-16.4 6.2L2.5 16"/></svg>
                  {reapplyAnim ? "✓ Applied!" : "Reapply"}
                </button>
                <button className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium" style={{ border: "1px solid var(--pl-border)", background: "var(--pl-card)", color: "var(--pl-fg)" }} title="Pick a color from the page">
                  <Icon name="pipette" className="h-3 w-3" />
                  Pick
                </button>
                {/* Export with dropdown */}
                <div id="pl-tour-export" className="relative">
                  <button
                    onClick={() => { setExportOpen((v) => !v); setImportOpen(false); }}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition"
                    style={{ border: "1px solid " + (exportOpen ? "var(--pl-primary)" : "var(--pl-border)"), background: exportOpen ? "var(--pl-primary)" : "var(--pl-card)", color: exportOpen ? "#fff" : "var(--pl-fg)" }}
                    aria-haspopup="true"
                    aria-expanded={exportOpen}
                  >
                    Export
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 2.5l3 2.5 3-2.5"/></svg>
                  </button>
                  {exportOpen && (
                    <div className="absolute bottom-full mb-1 left-0 z-50 rounded-lg overflow-hidden shadow-xl" style={{ background: "var(--pl-bg)", border: "1px solid var(--pl-border)", minWidth: 240 }} role="menu">
                      {/* Copy to clipboard section */}
                      <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--pl-fg-muted)", borderBottom: "1px solid var(--pl-border)", background: "var(--pl-hover)" }}>Copy to Clipboard</div>
                      {(["palettelive","css","json","tailwind","cmyk","lab","oklch"] as const).map(f => {
                        const isCopied = copiedFmt === f;
                        const label = f === "css" ? "CSS Variables" : f === "json" ? "JSON Tokens" : f === "tailwind" ? "Tailwind Config" : f === "palettelive" ? "PaletteLive Palette ↺" : f.toUpperCase();
                        return (
                          <button key={f} onClick={() => copyFmt(f)}
                            className="w-full text-left px-3 py-1.5 text-[11px] font-medium transition hover:opacity-80 flex items-center justify-between"
                            style={{ background: isCopied ? "rgba(34,197,94,0.12)" : "transparent", color: isCopied ? "#22c55e" : "var(--pl-fg)" }}
                            role="menuitem">
                            <span>{label}</span>
                            {isCopied && <span style={{ fontSize: 9, fontWeight: 700 }}>✓ Copied!</span>}
                          </button>
                        );
                      })}
                      {/* Export as file section */}
                      <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--pl-fg-muted)", borderTop: "1px solid var(--pl-border)", borderBottom: "1px solid var(--pl-border)", background: "var(--pl-hover)" }}>Download as File</div>
                      {(["palettelive","css","json","tailwind","cmyk","lab","oklch"] as const).map(f => (
                        <button key={"file-"+f} onClick={() => downloadFmt(f)}
                          className="w-full text-left px-3 py-1.5 text-[11px] font-medium transition hover:opacity-80 flex items-center gap-1"
                          style={{ color: "var(--pl-fg)" }} role="menuitem">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          {f === "palettelive" ? "PaletteLive Palette ↺" : f === "css" ? "CSS Variables" : f === "json" ? "JSON Tokens" : f === "tailwind" ? "Tailwind Config" : f.toUpperCase()}
                        </button>
                      ))}
                      {/* Export preview */}
                      <pre className="p-2.5 text-[10px] leading-relaxed overflow-auto select-all" style={{ fontFamily: "'SF Mono', monospace", color: "var(--pl-fg)", maxHeight: 110, background: "var(--pl-surface)", borderTop: "1px solid var(--pl-border)", whiteSpace: "pre" }}>
                        {getExportText(exportFmt)}
                      </pre>
                    </div>
                  )}
                </div>
                {/* Import with dropdown */}
                <div className="relative">
                  <button
                    onClick={() => { setImportOpen((v) => !v); setExportOpen(false); }}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition"
                    style={{ border: "1px solid " + (importOpen ? "var(--pl-primary)" : "var(--pl-border)"), background: importOpen ? "var(--pl-primary)" : "var(--pl-card)", color: importOpen ? "#fff" : "var(--pl-fg)" }}
                    aria-haspopup="true"
                    aria-expanded={importOpen}
                  >
                    Import
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 2.5l3 2.5 3-2.5"/></svg>
                  </button>
                  {importOpen && (
                    <div className="absolute bottom-full mb-1 left-0 z-50 rounded-lg shadow-xl" style={{ background: "var(--pl-bg)", border: "1px solid var(--pl-border)", minWidth: 220, overflow: "visible" }} role="menu">
                      {importMode === "menu" ? (
                        <>
                          <button
                            onClick={() => {
                              const text = customPaletteInput || "";
                              if (text) { applyImportText(text); } else { setImportMode("clipboard"); }
                            }}
                            className="w-full text-left px-3 py-2 text-[11px] font-medium transition hover:opacity-80"
                            style={{ color: "var(--pl-fg)", borderBottom: "1px solid var(--pl-border)" }} role="menuitem"
                          >Paste from Clipboard</button>
                          <label className="flex items-center gap-2 px-3 py-2 text-[11px] font-medium cursor-pointer hover:opacity-80" style={{ color: "var(--pl-fg)" }} role="menuitem">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Import from File (.plpalette / .json)
                            <input type="file" accept=".json,.plpalette,.txt" className="hidden" onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = (ev) => { applyImportText(String(ev.target?.result ?? "")); };
                              reader.readAsText(file);
                            }} />
                          </label>
                        </>
                      ) : (
                        <div className="p-2 space-y-1.5">
                          <div style={{ fontSize: 10, color: "var(--pl-fg-muted)", fontWeight: 600 }}>Paste hex codes or Coolors URL</div>
                          <textarea
                            value={importText}
                            onChange={(e) => setImportText(e.target.value)}
                            rows={3}
                            placeholder="#264653, #2a9d8f, #e9c46a ..."
                            className="w-full rounded px-2 py-1 text-[11px] resize-none"
                            style={{ border: "1px solid var(--pl-border)", background: "var(--pl-surface)", color: "var(--pl-fg)", outline: "none", fontFamily: "monospace" }}
                            autoFocus
                          />
                          <div className="flex gap-1">
                            <button onClick={() => applyImportText(importText)} disabled={!importText.match(/#[0-9a-fA-F]{6}/gi)} className="flex-1 rounded py-1 text-[11px] font-semibold" style={{ background: "var(--pl-primary)", color: "#fff", border: "none", opacity: importText.match(/#[0-9a-fA-F]{6}/gi) ? 1 : 0.4 }}>Apply</button>
                            <button onClick={() => { setImportMode("menu"); setImportText(""); }} className="rounded px-2 py-1 text-[11px]" style={{ border: "1px solid var(--pl-border)", color: "var(--pl-fg-muted)", background: "var(--pl-surface)" }}>Back</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div id="pl-tour-toggles" className="flex items-center gap-2.5">
                <button
                  onClick={() => { setAutoPlay(false); setHeatmapOn((v) => !v); }}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all"
                  style={{
                    background: heatmapOn ? "var(--pl-primary)" : "var(--pl-surface)",
                    border: "1px solid " + (heatmapOn ? "var(--pl-primary)" : "var(--pl-border)"),
                    color: heatmapOn ? "#fff" : "var(--pl-fg-muted)",
                  }}
                  title="Color Frequency Analysis"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="10" width="3" height="4" fill="currentColor" opacity="0.4"/>
                    <rect x="6" y="7" width="3" height="7" fill="currentColor" opacity="0.6"/>
                    <rect x="10" y="4" width="3" height="10" fill="currentColor" opacity="0.8"/>
                  </svg>
                  Heatmap
                </button>
                <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 12, color: "var(--pl-fg-muted)", userSelect: "none" }}>
                  <div className="relative" style={{ width: 36, height: 20 }}>
                    <input type="checkbox" checked={compareOn} onChange={() => { setAutoPlay(false); setCompareOn((v) => !v); }} className="sr-only peer" />
                    <div className="absolute inset-0 rounded-full transition-colors" style={{ background: compareOn ? "var(--pl-primary)" : "var(--pl-border)" }} />
                    <div className="absolute rounded-full bg-white shadow transition-transform" style={{ width: 16, height: 16, top: 2, left: 2, transform: compareOn ? "translateX(16px)" : "translateX(0)", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </div>
                  <span style={{ fontWeight: 500 }}>Compare</span>
                  {compareOn && <span style={{ fontSize: 9, opacity: 0.55, fontStyle: "italic" }} aria-live="polite">drag to split</span>}
                </label>
              </div>
              <div id="pl-tour-vision" className="flex items-center gap-2">
                <label htmlFor="pl-vision-sim" style={{ fontSize: 12, color: "var(--pl-fg-muted)" }}>Vision</label>
                <select id="pl-vision-sim" value={visionSim} onChange={(e) => { setAutoPlay(false); setVisionSim(e.target.value); }} className="rounded-md px-1.5 py-0.5" style={{ height: 24, border: "1px solid var(--pl-border)", background: "var(--pl-surface)", color: "var(--pl-fg)", fontSize: 12 }}>
                  <option value="none">Off</option>
                  <option value="protanopia">Protanopia</option>
                  <option value="deuteranopia">Deuteranopia</option>
                  <option value="tritanopia">Tritanopia</option>
                  <option value="achromatopsia">Achromatopsia</option>
                </select>
              </div>
              {/* Footer links */}
              <div className="flex items-center justify-center gap-2 pt-1" style={{ borderTop: "1px solid var(--pl-border)" }}>
                <a href="https://palettelive.mckesav.in/how-to-use" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--pl-fg-muted)", textDecoration: "none" }} className="hover:underline">How to use</a>
                <span style={{ fontSize: 11, color: "var(--pl-fg-muted)" }}>·</span>
                <a href="https://palettelive.mckesav.in/privacypolicy" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--pl-fg-muted)", textDecoration: "none" }} className="hover:underline">Privacy Policy</a>
              </div>
            </div>
          </div>

          {/* ── CTA card — fills empty space below popup ── */}
          <div style={{ flex: 1, borderRadius: 16, padding: "18px 16px", background: "#1b263b", border: "1.5px solid #415a77", display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, textTransform: "uppercase", letterSpacing: "normal", color: "#e0e1dd", marginBottom: 6 }}>Interactive Demo</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#e0e1dd", lineHeight: 1.35, marginBottom: 8 }}>You're seeing just a glimpse of what PaletteLive can do.</div>
              <div style={{ fontSize: 11, color: "#778da9", lineHeight: 1.65, marginBottom: 14 }}>Download the <strong style={{ color: "#e0e1dd", fontWeight: 700 }}>free extension</strong> to unlock all 18+ features — real-time recoloring, WCAG contrast checker, 6 export formats & more.</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <a href="https://microsoftedge.microsoft.com/addons/detail/palettelive/dglieojmcknbngkffpephfdphbdfbcam" target="_blank" rel="noopener noreferrer" onClick={openEdgeLink}
                style={{ display: "block", textAlign: "center", borderRadius: 11, padding: "11px 16px", fontSize: 12, fontWeight: 800, background: "linear-gradient(135deg, #415a77 0%, #778da9 100%)", color: "#e0e1dd", textDecoration: "none", border: "none", letterSpacing: "0.02em" }}>Get Full Extension →</a>
              <a href="https://microsoftedge.microsoft.com/addons/detail/palettelive/dglieojmcknbngkffpephfdphbdfbcam" target="_blank" rel="noopener noreferrer" onClick={openEdgeLink}
                style={{ display: "block", textAlign: "center", borderRadius: 11, padding: "11px 16px", fontSize: 12, fontWeight: 800, background: "#0d1b2a", color: "#778da9", textDecoration: "none", border: "1.5px solid #415a77" }}>View Full Feature List</a>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {[["18+ Features", "#e0e1dd"], ["100% Free", "#778da9"], ["MV3 Secure", "#415a77"], ["Open Source", "#778da9"]].map(([tag, color]) => (
                <span key={tag} style={{ fontSize: 9, fontWeight: 700, borderRadius: 6, padding: "4px 10px", background: "#0d1b2a", color: color, border: `1px solid ${color}40` }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Apple-style info bar ── */}
      <div className="flex items-center justify-center gap-4 px-4 py-2.5" style={{ borderTop: theme === "dark" ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)", background: theme === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)" }}>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full transition-colors duration-500" style={{ background: displayPal.accent, boxShadow: `0 0 6px ${displayPal.accent}80` }} />
          <span className={"text-[11px] font-semibold " + (theme === "dark" ? "text-white/80" : "text-slate-800")}>{displayPal.name}</span>
        </div>
        <span className={theme === "dark" ? "text-white/15" : "text-slate-300"}>|</span>
        <span className={"text-[11px] " + (theme === "dark" ? "text-white/35" : "text-slate-500")}>{autoPlay ? "⟳ Auto-cycling" : "Manual"}</span>
        <span className={theme === "dark" ? "text-white/15" : "text-slate-300"}>|</span>
        <span className={"text-[11px] " + (theme === "dark" ? "text-white/35" : "text-slate-500")}>Contrast {ratio.toFixed(1)}:1</span>
        {visionSim !== "none" && (
          <>
            <span className={theme === "dark" ? "text-white/15" : "text-slate-300"}>|</span>
            <span className={"text-[11px] " + (theme === "dark" ? "text-amber-400/70" : "text-amber-600")}>{visionSim}</span>
          </>
        )}
      </div>

      {/* ─── Guided Tour Overlay ─── */}
      {tourStep !== null && spotlightRect && tourVisible && (() => {
        const step = TOUR_STEPS[tourStep];
        const pad = 10;
        const tipW = 292;
        const tipH = 260; // estimated tooltip height
        const gap = 14;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Available space in each direction from the spotlight box (incl. pad)
        const sTop = spotlightRect.top - pad;
        const sBottom = vh - (spotlightRect.top + spotlightRect.height + pad);
        const sLeft = spotlightRect.left - pad;
        const sRight = vw - (spotlightRect.left + spotlightRect.width + pad);

        // Decide placement: prefer below, then above, then right, then left, whichever fits
        type Placement = "below" | "above" | "right" | "left";
        let placement: Placement = "below";
        if (sBottom >= tipH + gap) {
          placement = "below";
        } else if (sTop >= tipH + gap) {
          placement = "above";
        } else if (sRight >= tipW + gap) {
          placement = "right";
        } else if (sLeft >= tipW + gap) {
          placement = "left";
        } else {
          // Nothing fully fits; pick the direction with the most space
          const best = Math.max(sBottom, sTop, sRight, sLeft);
          if (best === sBottom) placement = "below";
          else if (best === sTop) placement = "above";
          else if (best === sRight) placement = "right";
          else placement = "left";
        }

        let tipTop = 0;
        let tipLeft = 0;
        if (placement === "below") {
          tipTop = spotlightRect.top + spotlightRect.height + pad + gap;
          tipLeft = spotlightRect.left + spotlightRect.width / 2 - tipW / 2;
        } else if (placement === "above") {
          tipTop = spotlightRect.top - pad - gap - tipH;
          tipLeft = spotlightRect.left + spotlightRect.width / 2 - tipW / 2;
        } else if (placement === "right") {
          tipLeft = spotlightRect.left + spotlightRect.width + pad + gap;
          tipTop = spotlightRect.top + spotlightRect.height / 2 - tipH / 2;
        } else {
          tipLeft = spotlightRect.left - pad - gap - tipW;
          tipTop = spotlightRect.top + spotlightRect.height / 2 - tipH / 2;
        }

        // Clamp so the tooltip is always fully visible inside the viewport
        tipTop = Math.max(8, Math.min(tipTop, vh - tipH - 8));
        tipLeft = Math.max(8, Math.min(tipLeft, vw - tipW - 8));

        const isDark = theme === "dark";
        return (
          <>
            <div onClick={tourEnd} style={{ position: "fixed", inset: 0, zIndex: 10000, cursor: "default" }} />
            <div style={{
              position: "fixed", zIndex: 10001,
              top: spotlightRect.top - pad, left: spotlightRect.left - pad,
              width: spotlightRect.width + pad * 2, height: spotlightRect.height + pad * 2,
              borderRadius: 14, pointerEvents: "none",
              boxShadow: `0 0 0 9999px rgba(0,0,0,0.82), 0 0 0 2.5px ${displayPal.accent}, 0 0 28px 6px ${displayPal.accent}55`,
              transition: "top 0.38s cubic-bezier(.4,0,.2,1), left 0.38s cubic-bezier(.4,0,.2,1), width 0.38s cubic-bezier(.4,0,.2,1), height 0.38s cubic-bezier(.4,0,.2,1)",
            }} />
            <div style={{
              position: "fixed", zIndex: 10002,
              top: tipTop, left: tipLeft, width: tipW,
              background: isDark ? "#0d1117" : "#ffffff",
              border: `1.5px solid ${displayPal.accent}50`,
              borderRadius: 18, padding: "16px 18px 14px",
              boxShadow: "0 24px 72px rgba(0,0,0,0.58), 0 0 0 1px rgba(255,255,255,0.04)",
              transition: "top 0.38s cubic-bezier(.4,0,.2,1), left 0.38s cubic-bezier(.4,0,.2,1)",
              pointerEvents: "all",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: `${displayPal.accent}20`, border: `1.5px solid ${displayPal.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{step.icon}</div>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: displayPal.accent }}>{step.tip}</span>
                </div>
                <button onClick={tourEnd} style={{ background: "none", border: "none", cursor: "pointer", color: isDark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.28)", fontSize: 19, lineHeight: 1, padding: "2px 5px", borderRadius: 6 }} aria-label="Close tour">×</button>
              </div>
              <div style={{ fontWeight: 800, fontSize: 15.5, color: isDark ? "#f1f5f9" : "#0f172a", marginBottom: 7, lineHeight: 1.25 }}>{step.title}</div>
              <div style={{ fontSize: 12.5, color: isDark ? "#94a3b8" : "#475569", lineHeight: 1.65, marginBottom: 15 }}>{step.body}</div>
              {/* Progress dots */}
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 14 }}>
                {TOUR_STEPS.map((_, i) => (
                  <button key={i} onClick={() => setTourStep(i)} style={{
                    width: i === tourStep ? 22 : 6, height: 6, borderRadius: 99, border: "none",
                    background: i === tourStep ? displayPal.accent : (isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.13)"),
                    cursor: "pointer", transition: "all 0.3s", padding: 0,
                  }} />
                ))}
              </div>
              {/* Buttons row */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {tourStep > 0 && (
                  <button onClick={() => setTourStep((s) => (s ?? 1) - 1)} style={{
                    padding: "7px 14px", borderRadius: 9, fontSize: 11.5, fontWeight: 700,
                    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                    color: isDark ? "#94a3b8" : "#64748b",
                    border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
                    cursor: "pointer", whiteSpace: "nowrap",
                  }}>← Back</button>
                )}
                <button onClick={tourEnd} style={{
                  padding: "7px 14px", borderRadius: 9, fontSize: 11.5, fontWeight: 700,
                  background: "transparent",
                  color: isDark ? "rgba(255,255,255,0.32)" : "rgba(0,0,0,0.32)",
                  border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)",
                  cursor: "pointer", whiteSpace: "nowrap",
                }}>Skip</button>
                <button onClick={tourNext} style={{
                  flex: 1, borderRadius: 9, padding: "8px 16px", fontSize: 12, fontWeight: 800,
                  background: `linear-gradient(135deg, ${displayPal.accent}, ${displayPal.primary})`,
                  color: luminance(displayPal.accent) > 0.4 ? "#000" : "#fff",
                  border: "none", cursor: "pointer", letterSpacing: "0.02em",
                  boxShadow: `0 3px 12px ${displayPal.accent}40`,
                  whiteSpace: "nowrap",
                }}>
                  {tourStep < TOUR_STEPS.length - 1 ? "Next →" : "Start Exploring! ✨"}
                </button>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

function CanvasImage({ side }: { side: "left" | "right" }) {
  const ref = useRef<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState(side === "left" ? -20 : 20);

  useEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = 1 - rect.bottom / (vh + rect.height);
      const clamped = Math.max(0, Math.min(1, progress));
      const angle = side === "left" ? -(clamped * 40) : clamped * 40;
      setRotation(angle);
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, [side]);

  return (
    <img
      ref={ref}
      src={`/images/${side} canvas.png`}
      alt=""
      aria-hidden="true"
      className={`pointer-events-none absolute ${side}-0 top-1/2 w-[300px] xl:w-[400px] select-none`}
      style={{ transform: `translateY(-50%) rotate(${rotation}deg)`, transition: "transform 0.15s linear" }}
    />
  );
}
function BeforeAfter() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const [pct, setPct] = useState(50);
  const dragging = useRef(false);

  const calcPct = (clientX: number) => {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.min(Math.max(0, clientX - r.left), r.width);
    setPct(Math.round((x / r.width) * 100));
  };

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;

    const onDown = (e: PointerEvent) => {
      dragging.current = true;
      handle.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      calcPct(e.clientX);
    };
    const onUp = () => { dragging.current = false; };

    handle.addEventListener("pointerdown", onDown);
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
    return () => {
      handle.removeEventListener("pointerdown", onDown);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <SoftBadge>Before</SoftBadge>
          <span className="text-xs text-slate-500">Original colors</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Accessibility-optimized</span>
          <SoftBadge>After</SoftBadge>
        </div>
      </div>

      <div ref={containerRef} className="relative w-full select-none" style={{ aspectRatio: "1920 / 1200" }}>
        {/* Before */}
        <div className="absolute inset-0">
          <img
            src="/images/before image.png"
            alt="Before – original colors"
            className="h-full w-full object-cover object-top"
          />
        </div>

        {/* After (clipped) */}
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pct}%)` }}>
          <img
            src="/images/after image.png"
            alt="After – accessibility-optimized"
            className="h-full w-full object-cover object-top"
          />
        </div>

        {/* Divider */}
        <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pct}%` }}>
          <div className="relative h-full w-[2px] bg-white shadow-[0_0_8px_rgba(0,0,0,0.3)]" />
          {/* Before label – left of divider */}
          <div className="absolute right-3 top-4">
            <span className="rounded-full border border-white/30 bg-black/40 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">Before</span>
          </div>
          {/* After label – right of divider */}
          <div className="absolute left-3 top-4">
            <span className="rounded-full border border-white/30 bg-black/40 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">After</span>
          </div>
          {/* Drag handle */}
          <div
            ref={handleRef}
            className="pointer-events-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-10 w-10 cursor-ew-resize items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/10 select-none"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M6 4L2 9l4 5M12 4l4 5-4 5" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">Before / After</div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>Palette mapping</span>
            <span className="text-slate-300">•</span>
            <span>WCAG enforcement</span>
            <span className="text-slate-300">•</span>
            <span>Force dark mode</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <button
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="text-sm font-semibold text-slate-900">{q}</div>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
          <span className="text-lg leading-none">{open ? "−" : "+"}</span>
        </span>
      </button>
      {open ? <div className="px-5 pb-5 text-sm leading-relaxed text-slate-600">{a}</div> : null}
    </div>
  );
}

export function App() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [showDemoPopup, setShowDemoPopup] = useState(false);
  const [demoPopupDismissed, setDemoPopupDismissed] = useState(false);
  const [tourRequested, setTourRequested] = useState(false);

  useEffect(() => {
    // Keep body background consistent for the hero feel.
    document.body.classList.add("bg-slate-950");
    return () => {
      document.body.classList.remove("bg-slate-950");
    };
  }, []);

  // Show popup when user scrolls to the demo section (fires only once)
  useEffect(() => {
    const el = document.getElementById("demo");
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !demoPopupDismissed) {
          setShowDemoPopup(true);
          observer.disconnect();
          // Auto-dismiss after 7 seconds
          setTimeout(() => setShowDemoPopup(false), 7000);
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [demoPopupDismissed]);

  // Custom paint-brush cursor: switches brush based on background luminance
  useEffect(() => {
    // Hotspot = bristle tip. Image is 99×72px, rotated 180°.
    // Bristles now at top-left. Tip at (8, 7)
    const DARK_CURSOR  = "url('/brush-dark.png') 8 7, crosshair";  // dark brush on dark bg
    const LIGHT_CURSOR = "url('/brush-light.png') 8 7, crosshair"; // light brush on light bg

    function getLuminance(el: Element | null): number {
      while (el && el !== document.documentElement) {
        const bg = window.getComputedStyle(el).backgroundColor;
        if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
          const m = bg.match(/[\d.]+/g);
          if (m && m.length >= 3) {
            const [r, g, b] = m.map(Number);
            // Relative luminance (0 = black, 1 = white)
            return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          }
        }
        el = el.parentElement;
      }
      return 0; // default dark
    }

    let lastCursor = "";
    function onMouseMove(e: MouseEvent) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const lum = getLuminance(el);
      const next = lum > 0.45 ? LIGHT_CURSOR : DARK_CURSOR;
      if (next !== lastCursor) {
        document.body.style.cursor = next;
        lastCursor = next;
      }
    }

    // Set initial cursor
    document.body.style.cursor = DARK_CURSOR;
    window.addEventListener("mousemove", onMouseMove);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      document.body.style.cursor = "";
    };
  }, []);

  const cwsUrl = "https://microsoftedge.microsoft.com/addons/detail/palettelive/dglieojmcknbngkffpephfdphbdfbcam";
  const docsUrl = "/how-to-use";
  const demoUrl = "#demo";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <a href="#" className="flex items-center gap-3">
            <img src="/logo.png" alt="PaletteLive Logo" className="h-10 w-10 rounded-2xl shadow-lg shadow-indigo-500/20" />
            <div>
              <div className="text-sm font-semibold tracking-tight">PaletteLive</div>
              <div className="text-xs text-white/60">Live website palette engine</div>
            </div>
          </a>

          <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex" aria-label="Main navigation">
            <a className="hover:text-white" href="#features">Features</a>
            <a className="hover:text-white" href="#showcase">Before/After</a>
            <a className="hover:text-white" href="#compare">Compare</a>
            <a className="hover:text-white" href="/privacypolicy">Privacy</a>
            <a className="hover:text-white" href="#faq">FAQ</a>
            <a className="hover:text-white" href="#contact">Contact</a>
            <a className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition-colors" href="/supportdev">☕ Support</a>
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={cwsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={openEdgeLink}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-white/90"
            >
              Add to Edge
              <Icon name="bolt" className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden" aria-label="Hero">
        <div className="absolute inset-0">
          <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-violet-500/20 blur-3xl" />
          <div className="absolute -right-40 top-20 h-[520px] w-[520px] rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute bottom-[-260px] left-1/2 h-[520px] w-[980px] -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 pb-12 pt-12 sm:pt-16">
          <div className="mx-auto max-w-3xl text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Badge>Manifest V3</Badge>
              <Badge>Shadow DOM</Badge>
              <Badge>CSS Variables</Badge>
              <Badge>WCAG Enforcement</Badge>
              <Badge>Per-domain Persistence</Badge>
            </div>

            <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
              The Live Website Palette Engine.
            </h1>
            <p className="mt-5 text-pretty text-base leading-relaxed text-white/75 sm:text-lg">
              Scan the full DOM (including Shadow DOM), override colors in real time, enforce WCAG accessibility,
              and persist changes per domain — across reloads, SPA routes, and BFCache — without touching source code.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={cwsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={openEdgeLink}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-white/10 hover:bg-white/90 sm:w-auto"
              >
                Add to Edge (MV3)
                <Icon name="bolt" className="h-4 w-4" />
              </a>
              <a
                href={demoUrl}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 sm:w-auto"
              >
                Watch 60s Demo
                <Icon name="eye" className="h-4 w-4" />
              </a>
              <a
                href={docsUrl}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/0 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/5 sm:w-auto"
              >
                View Documentation
                <Icon name="code" className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3 text-xs text-white/60">
              <span className="inline-flex items-center gap-2">
                <Icon name="shield" className="h-4 w-4" />
                Fully client-side. No page tracking.
              </span>
              <span className="text-white/25">•</span>
              <span>Overrides are non-destructive (no source edits)</span>
            </div>
          </div>

          <div id="demo" className="mt-10 sm:mt-12">
            <InteractiveDemo theme={theme} tourStarted={tourRequested} onTourEnd={() => setTourRequested(false)} />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                k: "Unbreakable persistence",
                v: "Watchdog + mutation observer keeps overrides sticky across reloads + SPA route changes.",
                i: "bolt",
              },
              {
                k: "Deep extraction",
                v: "Full DOM scan, Shadow DOM support, CSS variables, stylesheets, and pseudo-states.",
                i: "eye",
              },
              {
                k: "Accessibility intelligence",
                v: "Contrast checks with AA/AAA indicators and optional auto text contrast enforcement.",
                i: "shield",
              },
            ].map((x) => (
              <div key={x.k} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5">
                    <Icon name={x.i} className="h-5 w-5 text-white" />
                  </span>
                  <div className="text-sm font-semibold">{x.k}</div>
                </div>
                <div className="mt-2 text-sm leading-relaxed text-white/70">{x.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main */}
      <main className="bg-white text-slate-900">
        {/* Live demo clips (simulated) */}
        <section className="relative overflow-hidden px-5 py-16" aria-label="Live demo">
          {/* Left canvas decoration */}
          <CanvasImage side="left" />

          <div className="relative z-10 mx-auto max-w-6xl">
          <SectionTitle
            eyebrow="VISUAL PROOF"
            title="See PaletteLive in action"
            desc="Short, loopable moments that show what makes PaletteLive different: deep extraction, real-time overrides, and persistence that doesn’t break on modern SPAs."
          />

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {[
              {
                t: "Heatmap overlay",
                d: "Visualize every colored element with hex tooltips.",
                chips: ["Overlay", "Tooltips", "Counts"],
              },
              {
                t: "Color dropper",
                d: "Click any element and jump straight into inline editing.",
                chips: ["Crosshair", "Inspect", "Edit"],
              },
              {
                t: "SPA persistence",
                d: "Overrides survive route changes, reloads, and BFCache restores.",
                chips: ["Watchdog", "Observer", "Per-domain"],
              },
            ].map((x) => (
              <div key={x.t} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{x.t}</div>
                    <div className="mt-2 text-sm text-slate-600">{x.d}</div>
                  </div>
                  <div className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-slate-50">
                    <Icon name="eye" className="h-5 w-5 text-slate-700" />
                  </div>
                </div>
                <div className="mt-5 grid h-36 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50">
                  <div className="text-xs font-semibold text-slate-600">Looping clip placeholder</div>
                  <div className="text-[11px] text-slate-500">(Drop in GIF/MP4 later)</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {x.chips.map((c) => (
                    <SoftBadge key={c}>{c}</SoftBadge>
                  ))}
                </div>
              </div>
            ))}
          </div>
          </div>
        </section>

        {/* Power pillars */}
        <section id="features" className="relative overflow-hidden border-t border-slate-200 bg-slate-50/60" aria-label="Core features">
          <CanvasImage side="right" />

          <div className="relative z-10 mx-auto max-w-6xl px-5 py-16">
            <SectionTitle
              eyebrow="CORE FEATURES"
              title="The four power pillars"
              desc="PaletteLive is built like a professional dev tool: extraction depth, override durability, palette intelligence, and accessibility as a first-class feature."
            />

            <div className="mt-10 grid gap-4 lg:grid-cols-2">
              <Pill title="Deep color extraction" icon={<Icon name="eye" className="h-5 w-5 text-slate-800" />}>
                <ul className="mt-1 list-inside list-disc space-y-1">
                  <li>Full DOM scan (including Shadow DOM)</li>
                  <li>CSS variables + stylesheets parsing</li>
                  <li>Pseudo-state colors (:hover, :focus)</li>
                  <li>Heatmap overlay with hex tooltips</li>
                  <li>Perceptual clustering (CIEDE2000) + threshold control</li>
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  <SoftBadge>CSS Variables</SoftBadge>
                  <SoftBadge>Shadow DOM</SoftBadge>
                  <SoftBadge>Pseudo-States</SoftBadge>
                </div>
              </Pill>

              <Pill title="Non-destructive real-time override engine" icon={<Icon name="bolt" className="h-5 w-5 text-slate-800" />}>
                <ul className="mt-1 list-inside list-disc space-y-1">
                  <li>Live inline CSS patching (no source edits)</li>
                  <li>Mutation observer watchdog for sticky overrides</li>
                  <li>SPA route resilience + BFCache resilience</li>
                  <li>Per-domain persistence across tabs</li>
                  <li>Undo/redo history (per-color + batch)</li>
                </ul>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <span className="font-semibold">Key differentiator:</span> overrides keep applying even when the page tries to repaint.
                </div>
              </Pill>

              <Pill title="Smart palette intelligence" icon={<Icon name="sparkles" className="h-5 w-5 text-slate-800" />}>
                <ul className="mt-1 list-inside list-disc space-y-1">
                  <li>6 harmony generators (mono, 60-30-10, analogous, complementary, split, triadic)</li>
                  <li>Harmony scoring against the current page</li>
                  <li>Import & auto-apply with contrast-relationship preservation</li>
                  <li>Export to tokens: JSON, CSS vars, Tailwind config, OKLCH/LAB/CMYK</li>
                  <li>Export history so work is never lost</li>
                </ul>
              </Pill>

              <Pill title="Accessibility-first" icon={<Icon name="shield" className="h-5 w-5 text-slate-800" />}>
                <ul className="mt-1 list-inside list-disc space-y-1">
                  <li>WCAG contrast checker with AA/AAA indicators</li>
                  <li>Auto text contrast enforcement after overrides</li>
                  <li>Vision simulation overlays (color blindness modes)</li>
                  <li>Force light/dark mode override on any page</li>
                  <li>Accessibility diagnostics to spot regressions fast</li>
                </ul>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <ContrastBadge level="AA" pass={true} />
                  <ContrastBadge level="AAA" pass={true} />
                </div>
              </Pill>
            </div>
          </div>
        </section>

        {/* Before/After */}
        <section id="showcase" className="relative overflow-hidden px-5 py-16" aria-label="Before and after showcase">
          <CanvasImage side="left" />
          <div className="relative z-10 mx-auto max-w-6xl">
          <SectionTitle
            eyebrow="SHOWCASE"
            title="Before / After transformation"
            desc="Drag the slider to see what PaletteLive enables: full-theme remaps, contrast enforcement, and a production-ready token output — all on a live website."
          />

          <div className="mt-10">
            <BeforeAfter />
          </div>
          </div>
        </section>

        {/* Use cases */}
        <section className="relative overflow-hidden border-t border-slate-200 bg-slate-50/60" aria-label="Use cases">
          <CanvasImage side="right" />

          <div className="relative z-10 mx-auto max-w-6xl px-5 py-16">
            <SectionTitle
              eyebrow="WHO IT’S FOR"
              title="Use cases that convert"
              desc="PaletteLive is positioned as a dev tool, a designer playground, and an accessibility engine — in one workflow."
            />

            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                { t: "UI/UX Designers", d: "Rapid brand exploration on live sites." },
                { t: "Frontend Developers", d: "Inspect and refactor real-world color systems." },
                { t: "Accessibility Auditors", d: "Test contrast compliance instantly." },
                { t: "Design System Teams", d: "Extract and export structured tokens." },
                { t: "Brand Designers", d: "Re-skin competitor layouts for pitch decks." },
                { t: "QA Teams", d: "Validate dark mode and theme consistency." },
              ].map((x) => (
                <div key={x.t} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">{x.t}</div>
                  <div className="mt-2 text-sm text-slate-600">{x.d}</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <SoftBadge>Scan</SoftBadge>
                    <SoftBadge>Edit</SoftBadge>
                    <SoftBadge>Persist</SoftBadge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Export workflow */}
        <section className="mx-auto max-w-6xl px-5 py-16" id="docs" aria-label="Export workflow">
          <SectionTitle
            eyebrow="WORKFLOW"
            title="Import → Map → Apply → Export"
            desc="From exploration to production: generate or import a palette, map it onto the site’s colors while preserving contrast relationships, then export in the format your pipeline expects."
          />

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold">Pro export formats</div>
              <p className="mt-2 text-sm text-slate-600">
                Export-ready for design systems and production pipelines.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  "CSS Variables",
                  "JSON Tokens",
                  "Tailwind Config",
                  "OKLCH",
                  "CIE LAB",
                  "CMYK",
                ].map((x) => (
                  <div key={x} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                    {x}
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold text-slate-700">Export history</div>
                <div className="mt-2 text-sm text-slate-600">
                  Every export is tracked so you can backtrack and reproduce outputs.
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold">3-step “How it works”</div>
              <div className="mt-5 space-y-3">
                {[
                  { n: "01", t: "Scan", d: "Extract every color from DOM + Shadow DOM + CSS variables." },
                  { n: "02", t: "Edit", d: "Override any color live with sticky patching + undo/redo." },
                  { n: "03", t: "Persist", d: "Auto-resume per domain across reloads, routes, BFCache, and tabs." },
                ].map((x) => (
                  <div key={x.n} className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
                      {x.n}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{x.t}</div>
                      <div className="mt-1 text-sm text-slate-600">{x.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Built for modern web / trust */}
        <section className="border-t border-slate-200 bg-slate-50/60" aria-label="Trust and technology">
          <div className="relative z-10 mx-auto max-w-6xl px-5 py-16">
            <SectionTitle
              eyebrow="TRUST & TECH"
              title="Built for designers. Engineered for developers."
              desc="PaletteLive is designed for modern web architecture, and it’s explicit about security and permissions."
            />

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {[
                { t: "Manifest V3 compliant", d: "Works with Chrome’s modern extension architecture." },
                { t: "Typed infrastructure", d: "Message constants + utilities designed for scale." },
                { t: "185+ unit tests", d: "Confidence in complex DOM + color edge cases." },
              ].map((x) => (
                <div key={x.t} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="text-sm font-semibold">{x.t}</div>
                  <div className="mt-2 text-sm text-slate-600">{x.d}</div>
                </div>
              ))}
            </div>

            <div id="security" className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="text-sm font-semibold">Privacy & security</div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    PaletteLive requests “Access data on all websites” only to scan DOM/CSS and apply your overrides.
                    All processing is fully client-side. No analytics on visited pages. No data leaves your browser.
                    The extension does not modify website source code.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <SoftBadge>No tracking</SoftBadge>
                    <SoftBadge>Client-side only</SoftBadge>
                    <SoftBadge>No source edits</SoftBadge>
                    <SoftBadge>Per-domain storage</SoftBadge>
                  </div>
                </div>
                <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 lg:flex">
                  <Icon name="shield" className="h-6 w-6 text-slate-700" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section id="compare" className="relative z-10 mx-auto max-w-6xl px-5 py-16" aria-label="Feature comparison">
          <SectionTitle
            eyebrow="POSITIONING"
            title="PaletteLive vs basic color pickers"
            desc="This is not a screenshot picker. It’s a persistence-first palette system for real websites."
          />

          <div className="mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-3 bg-slate-50 px-5 py-4 text-xs font-semibold text-slate-700">
              <div>Capability</div>
              <div className="text-center">PaletteLive</div>
              <div className="text-center">Basic pickers</div>
            </div>
            {[
              "Shadow DOM support",
              "Real-time override persistence",
              "SPA route resilience",
              "Harmony generation + scoring",
              "WCAG auto-fix for text",
              "Export: Tailwind/OKLCH/LAB/CMYK",
              "Per-domain persistence across tabs",
            ].map((cap) => (
              <div key={cap} className="grid grid-cols-3 items-center border-t border-slate-200 px-5 py-4">
                <div className="text-sm font-medium text-slate-800">{cap}</div>
                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <Icon name="check" className="h-4 w-4" />
                    Yes
                  </span>
                </div>
                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                    <Icon name="x" className="h-4 w-4" />
                    Usually no
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section className="border-t border-slate-200 bg-slate-50/60" aria-label="Testimonials">
          <div className="relative z-10 mx-auto max-w-6xl px-5 py-16">
            <SectionTitle
              eyebrow="EARLY FEEDBACK"
              title="Feels like a dev tool — and a designer playground"
              desc="Swap these with real quotes anytime. The layout is ready for Chrome Web Store screenshots and social proof."
            />

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {[
                {
                  q: "The persistence is the killer feature. It survives every navigation I throw at it.",
                  r: "Frontend Engineer",
                },
                {
                  q: "Heatmap + clustering turned a chaotic site into an editable token system in minutes.",
                  r: "Design Systems Lead",
                },
                {
                  q: "WCAG checks while I edit colors live is huge for audit workflows.",
                  r: "Accessibility Specialist",
                },
              ].map((x, i) => (
                <div key={i} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="text-sm leading-relaxed text-slate-700">“{x.q}”</div>
                  <div className="mt-4 text-xs font-semibold text-slate-900">{x.r}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="relative z-10 mx-auto max-w-6xl px-5 py-16" aria-label="Frequently asked questions">
          <SectionTitle
            eyebrow="FAQ"
            title="Answers to common objections"
            desc="Security, performance, modern frameworks, and why this isn’t “just DevTools.”"
          />

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <FAQItem
              q="Does PaletteLive modify the website’s source code?"
              a="No. Overrides are applied at runtime (non-destructive) via inline CSS patching—your changes live in the browser and can be persisted per domain without editing the site’s codebase."
            />
            <FAQItem
              q="Will it slow down pages?"
              a="PaletteLive is designed to scan efficiently and re-apply overrides only when needed. The watchdog/mutation observer focuses on staying sticky without constant heavy reprocessing."
            />
            <FAQItem
              q="Does it work with React / Vue / Next.js / SPAs?"
              a="Yes—persistence across SPA route changes is a core feature. Overrides can survive re-renders and route transitions."
            />
            <FAQItem
              q="Is it safe? Does data leave my browser?"
              a="All processing is client-side. No tracking and no analytics on visited pages. Permissions are used solely for scanning and applying your own overrides."
            />
            <FAQItem
              q="Why not just use DevTools?"
              a="DevTools is great for debugging, but it doesn’t give you a persistent per-domain override engine, palette clustering, harmony generation/scoring, WCAG auto-fix, or multi-format export workflow."
            />
            <FAQItem
              q="Can I export to Tailwind and tokens?"
              a="Yes—export formats are designed for real workflows: CSS variables, JSON tokens, Tailwind config, plus OKLCH/LAB/CMYK and export history."
            />
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="border-t border-slate-200 bg-slate-950 text-white" aria-label="Call to action">
          <div className="relative z-10 mx-auto max-w-6xl px-5 py-16">
            <div className="grid gap-8 lg:grid-cols-[1.3fr_.7fr] lg:items-center">
              <div>
                <div className="text-xs font-semibold tracking-[0.25em] text-indigo-300">READY WHEN YOU ARE</div>
                <h3 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                  Extract. Edit. Persist. Export.
                </h3>
                <p className="mt-3 text-pretty text-base text-white/75">
                  PaletteLive brings production-grade palette control to live websites — with accessibility intelligence and persistence you can trust.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <a
                    href={cwsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={openEdgeLink}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-white/90"
                  >
                    Add to Edge
                    <Icon name="bolt" className="h-4 w-4" />
                  </a>
                  <a
                    href="#features"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    Explore features
                    <Icon name="sparkles" className="h-4 w-4" />
                  </a>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="text-sm font-semibold">Trust snapshot</div>
                <div className="mt-4 space-y-3 text-sm text-white/75">
                  <div className="flex items-center gap-2">
                    <Icon name="check" className="h-4 w-4 text-emerald-300" />
                    Manifest V3 compliant
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="check" className="h-4 w-4 text-emerald-300" />
                    Client-side only processing
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="check" className="h-4 w-4 text-emerald-300" />
                    No tracking / no page analytics
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="check" className="h-4 w-4 text-emerald-300" />
                    Per-domain persistence
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="bg-gradient-to-br from-slate-900 to-slate-950 text-white py-16">
          <div className="mx-auto max-w-3xl px-5">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-3">Get in Touch</h2>
              <p className="text-lg text-white/70 max-w-2xl mx-auto">
                Have questions about PaletteLive? Need assistance or want to report an issue? We're here to help.
              </p>
            </div>
            
            <div className="max-w-xl mx-auto">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                <h3 className="text-xl font-semibold mb-3">Support & Inquiries</h3>
                <p className="text-sm text-white/70 mb-6">
                  For technical support, bug reports, feature requests, or general questions about PaletteLive, please don't hesitate to reach out.
                </p>
                <div className="flex flex-col items-center gap-4">
                  <a 
                    href="mailto:mckesavdev+support@gmail.com" 
                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-lg font-medium"
                  >
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                    mckesavdev+support@gmail.com
                  </a>
                  <a
                    href="https://www.linkedin.com/in/mckesav"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-lg font-medium"
                  >
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    linkedin.com/in/mckesav
                  </a>
                  <a
                    href="tel:+919490251635"
                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-lg font-medium"
                  >
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z"/>
                    </svg>
                    +91 94902 51635
                  </a>
                </div>
              </div>
            </div>
            
            <div className="mt-8 text-center">
              <p className="text-sm text-white/60">
                Response time: Typically within 24-48 hours during business days
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-slate-950 text-white" role="contentinfo">
          <div className="mx-auto max-w-6xl px-5 py-10">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <img src="/logo.png" alt="PaletteLive Logo" className="h-10 w-10 rounded-2xl shadow-lg" />
                  <div>
                    <div className="text-sm font-semibold">PaletteLive</div>
                    <div className="text-xs text-white/60">Professional palette tooling for live websites</div>
                  </div>
                </div>
                <div className="mt-4 text-xs text-white/55">Version 0.1 • Manifest V3</div>
              </div>

              <div className="grid gap-6 sm:grid-cols-3">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-white/80">Product</div>
                  <a className="block text-sm text-white/65 hover:text-white" href="#features">Features</a>
                  <a className="block text-sm text-white/65 hover:text-white" href="#showcase">Before/After</a>
                  <a className="block text-sm text-white/65 hover:text-white" href="#compare">Comparison</a>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-white/80">Resources</div>
                  <a className="block text-sm text-white/65 hover:text-white" href={docsUrl}>Documentation</a>
                  <a className="block text-sm text-white/65 hover:text-white" href="/privacypolicy">Privacy Policy</a>
                  <a className="block text-sm text-white/65 hover:text-white" href="#faq">FAQ</a>
                  <a className="block text-sm text-white/65 hover:text-white" href="#contact">Contact</a>
                  <a className="block text-sm font-semibold text-violet-400 hover:text-violet-300" href="/supportdev">☕ Support Dev</a>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-white/80">Links</div>
                  <a className="block text-sm text-white/65 hover:text-white" href={cwsUrl} target="_blank" rel="noopener noreferrer" onClick={openEdgeLink}>Edge Add-ons Store</a>
                  <a className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-white" href="#">
                    <Icon name="github" className="h-4 w-4" />
                    GitHub
                  </a>
                  <a className="block text-sm text-white/65 hover:text-white" href="mailto:mckesavdev+support@gmail.com">Support / Bug report</a>
                </div>
              </div>
            </div>

            <div className="mt-10 border-t border-white/10 pt-6 text-xs text-white/55">
              © {new Date().getFullYear()} PaletteLive. All rights reserved.
            </div>
          </div>
        </footer>
      </main>

      {/* ── Demo popup toast ── */}
      <div
        style={{
          position: "fixed",
          bottom: 28,
          left: "50%",
          transform: showDemoPopup ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(120px)",
          opacity: showDemoPopup ? 1 : 0,
          pointerEvents: showDemoPopup ? "auto" : "none",
          transition: "transform 0.45s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease",
          zIndex: 9999,
          width: "min(420px, calc(100vw - 32px))",
          background: "linear-gradient(135deg, #1b263b 0%, #0d1b2a 100%)",
          border: "1.5px solid #415a77",
          borderRadius: 16,
          boxShadow: "0 8px 40px 0 rgba(0,0,0,0.55), 0 0 0 1px #778da922",
          padding: "18px 20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#778da9", marginBottom: 4 }}>Live Demo</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#e0e1dd", lineHeight: 1.3 }}>Try the extension right here!</div>
          </div>
          <button
            onClick={() => { setShowDemoPopup(false); setDemoPopupDismissed(true); }}
            style={{ flexShrink: 0, background: "none", border: "none", color: "#778da9", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "2px 4px", borderRadius: 6 }}
            aria-label="Dismiss"
          >×</button>
        </div>
        {/* Body */}
        <div style={{ fontSize: 12.5, color: "#a0b0c0", lineHeight: 1.6 }}>
          Scroll down and interact with the <strong style={{ color: "#e0e1dd" }}>PaletteLive demo</strong> — switch palettes, toggle heatmaps, simulate vision modes and more, all without installing anything.
        </div>
        {/* CTA */}
        <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
          <a
            href={cwsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={openEdgeLink}
            style={{ flex: 1, textAlign: "center", borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg, #415a77 0%, #778da9 100%)", color: "#e0e1dd", textDecoration: "none", letterSpacing: "0.02em" }}
          >
            Add to Edge →
          </a>
          <button
            onClick={() => {
              setShowDemoPopup(false);
              setDemoPopupDismissed(true);
              document.getElementById("demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
              setTimeout(() => setTourRequested(true), 800);
              setTimeout(() => setTourRequested(false), 850);
            }}
            style={{ flex: 1, borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 700, background: "#0d1b2a", color: "#e0e1dd", border: "1.5px solid #415a77", cursor: "pointer" }}
          >
            Try Demo →
          </button>
        </div>
      </div>
    </div>
  );
}
