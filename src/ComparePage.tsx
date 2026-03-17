import { useEffect, useState } from "react";
import { AddExtensionButton } from "./components/AddExtensionButton";

// ─── Types ───────────────────────────────────────────────────────────────────
type CellVal = "yes" | "partial" | "no" | "basic";

const COLS = ["ColorZilla", "Peek", "Site Palette", "Eye Dropper"] as const;
type Col = typeof COLS[number];

interface TableRow {
  feature: string;
  desc: string;
  pl: CellVal;
  vals: Record<Col, CellVal>;
}

interface Group {
  label: string;
  rows: TableRow[];
}

// ─── Table data ──────────────────────────────────────────────────────────────
const TABLE: Group[] = [
  {
    label: "Extraction",
    rows: [
      {
        feature: "Full DOM extraction depth",
        desc: "How thoroughly colors are read from the page — surface vs. computed styles, iframes, and dynamic elements.",
        pl: "yes",
        vals: { ColorZilla: "basic", Peek: "partial", "Site Palette": "partial", "Eye Dropper": "basic" },
      },
      {
        feature: "Shadow DOM & Web Components",
        desc: "Explicitly traverses shadowRoot trees to read colors inside Web Components — critical on modern React/Vue/Angular apps.",
        pl: "yes",
        vals: { ColorZilla: "no", Peek: "no", "Site Palette": "no", "Eye Dropper": "no" },
      },
      {
        feature: "CSS custom properties (variables)",
        desc: "Parses :root and scoped CSS variables and can rewrite design tokens directly — not just resolved computed colors.",
        pl: "yes",
        vals: { ColorZilla: "no", Peek: "partial", "Site Palette": "no", "Eye Dropper": "no" },
      },
      {
        feature: ":hover & :focus color capture",
        desc: "Detects colors that only appear in pseudo-states — interactive states that other tools miss entirely.",
        pl: "yes",
        vals: { ColorZilla: "no", Peek: "no", "Site Palette": "no", "Eye Dropper": "no" },
      },
      {
        feature: "Perceptual color clustering",
        desc: "Groups near-duplicate colors using perceptual distance (CIEDE2000) so you see a clean palette, not 300 hex codes.",
        pl: "yes",
        vals: { ColorZilla: "no", Peek: "basic", "Site Palette": "partial", "Eye Dropper": "no" },
      },
    ],
  },
  {
    label: "Live Editing",
    rows: [
      {
        feature: "Non-destructive live overrides",
        desc: "Edit page colors in real time without touching source code. Every override is tracked and revertable.",
        pl: "yes",
        vals: { ColorZilla: "no", Peek: "no", "Site Palette": "no", "Eye Dropper": "no" },
      },
      {
        feature: "SPA & BFCache resilience",
        desc: "MutationObserver watchdog keeps overrides alive through React Router/Next.js navigations and browser Back button.",
        pl: "yes",
        vals: { ColorZilla: "no", Peek: "no", "Site Palette": "no", "Eye Dropper": "no" },
      },
      {
        feature: "Full undo / redo",
        desc: "Step-by-step history for every color change made on the live page — like Command+Z in a design app.",
        pl: "yes",
        vals: { ColorZilla: "no", Peek: "no", "Site Palette": "no", "Eye Dropper": "no" },
      },
      {
        feature: "Per-domain auto-persistence",
        desc: "Overrides save instantly and re-apply every time you revisit. No Save button, no losing work.",
        pl: "yes",
        vals: { ColorZilla: "no", Peek: "no", "Site Palette": "partial", "Eye Dropper": "no" },
      },
      {
        feature: "Before / after split view",
        desc: "Drag a divider to compare the original page against your recolored version side-by-side.",
        pl: "yes",
        vals: { ColorZilla: "no", Peek: "no", "Site Palette": "no", "Eye Dropper": "no" },
      },
    ],
  },
  {
    label: "Analysis",
    rows: [
      {
        feature: "Color heatmap",
        desc: "Overlays the entire page with hex labels on every colored element — nothing hides from you.",
        pl: "yes",
        vals: { ColorZilla: "partial", Peek: "no", "Site Palette": "no", "Eye Dropper": "no" },
      },
      {
        feature: "Harmony generation & scoring",
        desc: "Generates 6 harmony schemes (analogous, triadic, split-complementary…) and scores each for visual balance.",
        pl: "yes",
        vals: { ColorZilla: "no", Peek: "no", "Site Palette": "no", "Eye Dropper": "no" },
      },
    ],
  },
  {
    label: "Accessibility",
    rows: [
      {
        feature: "WCAG contrast checker",
        desc: "Live AA/AAA pass/fail overlays directly on the page as you edit.",
        pl: "yes",
        vals: { ColorZilla: "basic", Peek: "basic", "Site Palette": "no", "Eye Dropper": "no" },
      },
      {
        feature: "One-click contrast auto-fix",
        desc: "Automatically adjusts failing text colors to the nearest WCAG AA-passing value in one click.",
        pl: "yes",
        vals: { ColorZilla: "no", Peek: "no", "Site Palette": "no", "Eye Dropper": "no" },
      },
      {
        feature: "Color blind simulation",
        desc: "Previews the page filtered for 8 types of color vision deficiency before you ship.",
        pl: "yes",
        vals: { ColorZilla: "no", Peek: "no", "Site Palette": "no", "Eye Dropper": "no" },
      },
    ],
  },
  {
    label: "Export & Import",
    rows: [
      {
        feature: "Developer exports",
        desc: "CSS vars, Tailwind config, JSON design tokens, OKLCH, CIE LAB, CMYK — every format your stack needs.",
        pl: "yes",
        vals: { ColorZilla: "no", Peek: "yes", "Site Palette": "no", "Eye Dropper": "no" },
      },
      {
        feature: "Design tool exports",
        desc: "Sketch templates, Adobe Swatch, SVG palettes for handoff to design tools.",
        pl: "no",
        vals: { ColorZilla: "no", Peek: "partial", "Site Palette": "yes", "Eye Dropper": "no" },
      },
      {
        feature: "Import & auto-map a palette",
        desc: "Paste a Coolors/Figma palette and PaletteLive maps each color to the closest live element with contrast preservation.",
        pl: "yes",
        vals: { ColorZilla: "no", Peek: "no", "Site Palette": "partial", "Eye Dropper": "no" },
      },
    ],
  },
  {
    label: "Privacy & Cost",
    rows: [
      {
        feature: "100% local — no data leaves device",
        desc: "Zero telemetry, no analytics, fully auditable codebase. Your browsing stays private.",
        pl: "yes",
        vals: { ColorZilla: "partial", Peek: "yes", "Site Palette": "partial", "Eye Dropper": "yes" },
      },
      {
        feature: "Free, no account required",
        desc: "Full feature access without sign-up, login, or subscription.",
        pl: "yes",
        vals: { ColorZilla: "yes", Peek: "yes", "Site Palette": "partial", "Eye Dropper": "yes" },
      },
    ],
  },
];

// ─── Competitor profiles ─────────────────────────────────────────────────────
const PROFILES = [
  {
    name: "ColorZilla",
    tagline: "The long-standing stalwart",
    since: "10M+ users",
    good: "Trusted eyedropper, CSS gradient editor, per-element color inspector. Recently updated to MV3. Huge install base and solid brand recognition.",
    gap: "Built around the eyedropper workflow. No live page recoloring, no override persistence, no accessibility tooling. Analyzer gives a palette but can't edit the page.",
    tier: "Eyedropper / Analyzer",
    tierColor: "bg-slate-100 text-slate-600",
  },
  {
    name: "Peek",
    tagline: "The clean modern extractor",
    since: "DOM-based",
    good: "One of the closest peers. Extracts colors, gradients, typography, and assets cleanly. Supports OKLCH and developer-friendly exports (CSS/SCSS/Tailwind/JSON/SVG). Local processing.",
    gap: "Extraction-only — no live recoloring, no override engine, no undo/redo of page edits. Great if you just want to see what a site uses; not for editing or prototyping.",
    tier: "Palette Extractor",
    tierColor: "bg-sky-50 text-sky-700",
  },
  {
    name: "Site Palette",
    tagline: "The design tool integrator",
    since: "Screenshot-based",
    good: "Strong design-tool story: exports to Sketch, Adobe Swatch, SVG. Account-based history and shareable palette links. Integrations with Coolors and Google Art Palette.",
    gap: "Screenshot-based extraction means it reads pixels, not the DOM. Misses CSS variables, pseudo-states, and Shadow DOM structure. Live recoloring is absent. Adds a paid subscription tier.",
    tier: "Palette Extractor",
    tierColor: "bg-sky-50 text-sky-700",
  },
  {
    name: "Eye Dropper",
    tagline: "The minimalist privacy pick",
    since: "Simple & fast",
    good: "Extremely minimal and fast. Great for grabbing a single hex code off any page. Strong privacy stance, no telemetry, free. Perfect for a quick pick.",
    gap: "Single-purpose by design. No palette-level analysis, no live editing, no WCAG tooling, no exports beyond copy-to-clipboard. Not built for design system or engineering workflows.",
    tier: "Simple Picker",
    tierColor: "bg-emerald-50 text-emerald-700",
  },
];

// ─── Cell component ───────────────────────────────────────────────────────────
function Cell({ val }: { val: CellVal }) {
  if (val === "yes")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
        <svg width="11" height="11" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="10" cy="10" r="10" fill="#4F46E5" fillOpacity="0.15" />
          <path d="M6 10.5l2.5 2.5 5.5-6" stroke="#4F46E5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Yes
      </span>
    );
  if (val === "partial")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        <svg width="11" height="11" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="10" cy="10" r="10" fill="#D97706" fillOpacity="0.15" />
          <path d="M6 10h8" stroke="#D97706" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Partial
      </span>
    );
  if (val === "basic")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-600">
        <svg width="11" height="11" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="10" cy="10" r="10" fill="#0284C7" fillOpacity="0.12" />
          <path d="M10 6v4M10 14v.5" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Basic
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-400">
      <svg width="11" height="11" viewBox="0 0 20 20" fill="none" aria-hidden>
        <circle cx="10" cy="10" r="10" fill="#9CA3AF" fillOpacity="0.15" />
        <path d="M7 7l6 6M13 7l-6 6" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      No
    </span>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────
export function ComparePage() {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  useEffect(() => {
    document.title = "PaletteLive vs ColorZilla, Peek, Site Palette — Full Comparison";
    // Update meta description
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content =
      "Honest side-by-side comparison of PaletteLive against ColorZilla, Peek, Site Palette, and Eye Dropper. Covers extraction depth, live editing, WCAG accessibility, exports, and privacy.";
    return () => {
      document.title = "PaletteLive — Live Color Editor & Palette Extractor";
    };
  }, []);

  return (
    <div className="min-h-screen bg-white font-[IBM_Plex_Serif,serif]">
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <a href="/" className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-500 transition-colors">
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden>
              <rect width="32" height="32" rx="8" fill="#4F46E5" />
              <circle cx="10" cy="16" r="4" fill="#fff" />
              <circle cx="22" cy="16" r="4" fill="#fff" fillOpacity="0.6" />
              <circle cx="16" cy="10" r="3" fill="#fff" fillOpacity="0.85" />
              <circle cx="16" cy="22" r="3" fill="#fff" fillOpacity="0.4" />
            </svg>
            PaletteLive
          </a>
          <a href="/" className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M12 5l-6 5 6 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to home
          </a>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <header className="bg-slate-50 border-b border-slate-200 px-5 py-14 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-indigo-500">Feature Comparison</p>
        <h1 className="mx-auto max-w-3xl text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
          PaletteLive vs. every color extension
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-500">
          An honest deep-dive into extraction depth, live editing, accessibility tools, and export formats across the most popular browser color extensions.
        </p>

        {/* Tier badges */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs">
          {[
            { label: "Simple Pickers", desc: "Eye Dropper, basic pickers", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
            { label: "Palette Extractors", desc: "ColorZilla, Peek, Site Palette", color: "bg-sky-50 text-sky-700 border-sky-200" },
            { label: "Color IDE", desc: "PaletteLive", color: "bg-indigo-50 text-indigo-700 border-indigo-200 ring-1 ring-indigo-300" },
          ].map((t) => (
            <span key={t.label} className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-semibold ${t.color}`}>
              {t.label}
              <span className="font-normal opacity-70">— {t.desc}</span>
            </span>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">

        {/* ── Tier framing ────────────────────────────────────────── */}
        <section className="mb-14">
          <h2 className="mb-6 text-lg font-bold text-slate-800">Why most comparisons miss the point</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                tier: "Simple Pickers",
                tools: "Eye Dropper, basic color pickers",
                body: "One click → one hex code. Fast and frictionless — perfect if you just want to grab a color off a page. They don't attempt palette-level analysis or editing.",
                color: "border-emerald-200 bg-emerald-50/50",
                badge: "bg-emerald-100 text-emerald-700",
              },
              {
                tier: "Palette Extractors",
                tools: "ColorZilla, Peek, Site Palette",
                body: "Snapshot a page's color palette and let you view or export it. Useful for discovery and design handoff, but the workflow ends there — no live editing, no accessibility layer.",
                color: "border-sky-200 bg-sky-50/50",
                badge: "bg-sky-100 text-sky-700",
              },
              {
                tier: "Color IDE",
                tools: "PaletteLive",
                body: "Extracts, edits, analyzes, and exports — all on the live page, without touching source code. Think browser DevTools, but purpose-built for color systems.",
                color: "border-indigo-200 bg-indigo-50/60 ring-1 ring-indigo-200",
                badge: "bg-indigo-100 text-indigo-700",
              },
            ].map((c) => (
              <div key={c.tier} className={`rounded-2xl border p-5 ${c.color}`}>
                <span className={`mb-3 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${c.badge}`}>
                  {c.tier}
                </span>
                <p className="mb-1 text-xs font-semibold text-slate-500">{c.tools}</p>
                <p className="text-sm leading-relaxed text-slate-700">{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Comparison table ─────────────────────────────────────── */}
        <section className="mb-16">
          <h2 className="mb-4 text-lg font-bold text-slate-800">Full feature breakdown</h2>
          <p className="mb-6 text-sm text-slate-500">
            Hover any feature name for details. <span className="font-medium text-amber-600">Partial</span> = the capability exists but is limited in scope or depth.{" "}
            <span className="font-medium text-sky-600">Basic</span> = a minimal version is present (e.g. a simple eyedropper or palette save).
          </p>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            {/* Sticky column headers */}
            <div
              className="grid min-w-[720px] border-b border-slate-200 bg-slate-50 px-4 py-3"
              style={{ gridTemplateColumns: "minmax(200px,1fr) repeat(5, minmax(112px,130px))" }}
            >
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Feature</div>
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                  PaletteLive
                </span>
              </div>
              {COLS.map((c) => (
                <div key={c} className="flex justify-center">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                    {c}
                  </span>
                </div>
              ))}
            </div>

            {TABLE.map((group) => (
              <div key={group.label}>
                {/* Group header */}
                <div className="border-b border-slate-200 bg-slate-100/70 px-4 py-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{group.label}</span>
                </div>

                {group.rows.map((row, i) => {
                  const rowKey = `${group.label}-${i}`;
                  const isHovered = hoveredRow === rowKey;
                  return (
                    <div
                      key={row.feature}
                      className={`relative grid min-w-[720px] items-center border-b border-slate-100 px-4 py-3 transition-colors last:border-0 ${
                        isHovered ? "bg-indigo-50/50" : i % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                      }`}
                      style={{ gridTemplateColumns: "minmax(200px,1fr) repeat(5, minmax(112px,130px))" }}
                    >
                      {/* Feature name with tooltip */}
                      <div className="relative pr-4">
                        <span
                          className="cursor-default border-b border-dashed border-indigo-200 pb-px text-sm font-medium text-slate-800"
                          onMouseEnter={() => setHoveredRow(rowKey)}
                          onMouseLeave={() => setHoveredRow(null)}
                        >
                          {row.feature}
                        </span>
                        {isHovered && (
                          <div
                            className="absolute bottom-[calc(100%+8px)] left-0 z-20 w-64 rounded-xl bg-slate-900 px-3 py-2.5 text-xs leading-relaxed text-slate-200 shadow-xl"
                            style={{ pointerEvents: "none" }}
                          >
                            {row.desc}
                            <div className="absolute top-full left-5 border-4 border-transparent" style={{ borderTopColor: "#0f172a" }} />
                          </div>
                        )}
                      </div>

                      {/* PaletteLive — always first, highlighted */}
                      <div className="flex justify-center">
                        <Cell val={row.pl} />
                      </div>

                      {/* Competitors */}
                      {COLS.map((col) => (
                        <div key={col} className="flex justify-center">
                          <Cell val={row.vals[col]} />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Table footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-indigo-50/60 px-5 py-4">
              <p className="text-sm font-semibold text-indigo-600">
                18+ features. 100% free. No account.
              </p>
              <AddExtensionButton className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500">
                Add to Browser — it&apos;s free
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </AddExtensionButton>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Data based on publicly documented features as of March 2026. Hover any row for details.
          </p>
        </section>

        {/* ── Competitor profiles ──────────────────────────────────── */}
        <section className="mb-16">
          <h2 className="mb-2 text-lg font-bold text-slate-800">A fair take on each tool</h2>
          <p className="mb-6 text-sm text-slate-500">
            Every tool on this page is good at something. Here's where each one genuinely shines — and where it ends.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            {PROFILES.map((p) => (
              <div key={p.name} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${p.tierColor}`}>
                    {p.tier}
                  </span>
                  <span className="text-xs text-slate-400">{p.since}</span>
                </div>
                <h3 className="mb-0.5 text-base font-bold text-slate-900">{p.name}</h3>
                <p className="mb-4 text-xs font-medium text-slate-400">{p.tagline}</p>

                <div className="space-y-3 text-sm">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-600">Where it shines</p>
                    <p className="leading-relaxed text-slate-600">{p.good}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Where it ends</p>
                    <p className="leading-relaxed text-slate-500">{p.gap}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── The one thing only PaletteLive does ─────────────────── */}
        <section className="mb-16 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-7 py-8">
          <h2 className="mb-4 text-lg font-bold text-slate-800">The gap no other extension fills</h2>
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-slate-600">
            Every tool above stops at <strong>extraction</strong>: show the user what colors a site uses, then hand off to Figma, DevTools, or a separate CSS file. PaletteLive closes the loop.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: "1", label: "Extract", desc: "Full DOM + Shadow DOM, CSS variables, pseudo-states, perceptual clustering." },
              { step: "2", label: "Edit", desc: "Live non-destructive overrides with undo, persistence, and SPA resilience." },
              { step: "3", label: "Audit", desc: "WCAG checker + auto-fix + 8-type color blind simulation, all on the live page." },
              { step: "4", label: "Export", desc: "CSS vars, Tailwind config, design tokens, OKLCH, LAB, CMYK — ready for production." },
            ].map((s) => (
              <div key={s.step} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                  {s.step}
                </div>
                <p className="mb-1 text-sm font-bold text-slate-800">{s.label}</p>
                <p className="text-xs leading-relaxed text-slate-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────────── */}
        <section className="rounded-2xl bg-indigo-600 px-8 py-10 text-center">
          <h2 className="mb-2 text-xl font-bold text-white">Try PaletteLive — it&apos;s free</h2>
          <p className="mb-6 text-sm text-indigo-200">
            No account. No telemetry. All 18+ features unlocked from install.
          </p>
          <AddExtensionButton className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-2.5 text-sm font-bold text-indigo-600 transition-colors hover:bg-indigo-50">
            Add to Browser
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </AddExtensionButton>
          <p className="mt-4 text-xs text-indigo-300">
            Chrome · Firefox · Edge · Brave · Arc
          </p>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-slate-50 px-5 py-8 text-center text-xs text-slate-400">
        <p>
          <a href="/" className="font-semibold text-indigo-500 hover:text-indigo-400 transition-colors">PaletteLive</a>
          {" · "}
          <a href="/privacypolicy" className="hover:text-slate-600 transition-colors">Privacy Policy</a>
          {" · "}
          Comparison data reflects publicly documented features as of March 2026.
        </p>
      </footer>
    </div>
  );
}
