"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

// Loaded only when Clerk is configured — prevents the @clerk/nextjs package
// from initialising (and throwing) on the server when no publishable key is set.
const ClerkAuthButtons = dynamic(
  () => import("./ClerkAuthButtons").then((m) => ({ default: m.ClerkAuthButtons })),
  { ssr: false }
);

const NAV_LINKS = [
  { href: "/verify", label: "Verify" },
  { href: "/dashboard", label: "History" },
];

function clerkConfigured(): boolean {
  const k = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return (
    typeof k === "string" &&
    k.trim() !== "" &&
    !k.includes("your_key")
  );
}

export function Header() {
  const pathname = usePathname();
  const useClerk = clerkConfigured();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        width: "100%",
        /* Frosted surface — no border-bottom cliché, use a diffuse line instead */
        background: "rgba(11,10,16,0.72)",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        {/* ── Wordmark ─────────────────────────────── */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          {/* Mark */}
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: "linear-gradient(135deg, #8a63ff 0%, #5e3de8 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 16px rgba(138,99,255,0.4), inset 0 1px 0 rgba(255,255,255,0.18)",
              flexShrink: 0,
            }}
          >
            {/* Gate icon — two stacked lines like a logic gate */}
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x="1" y="4" width="7" height="1.5" rx="0.75" fill="white" opacity="0.95" />
              <rect x="1" y="7.5" width="5" height="1.5" rx="0.75" fill="white" opacity="0.6" />
              <circle cx="11" cy="6.5" r="1.5" fill="white" opacity="0.9" />
            </svg>
          </span>

          {/* Logotype */}
          <span
            style={{
              fontFamily: "var(--font-ui, 'DM Sans', sans-serif)",
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: "-0.03em",
              color: "var(--text, #eeeaf8)",
            }}
          >
            Drygate
          </span>
        </Link>

        {/* ── Center nav ───────────────────────────── */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname?.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                style={{
                  fontFamily: "var(--font-ui, 'DM Sans', sans-serif)",
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  letterSpacing: "-0.01em",
                  color: active ? "var(--text, #eeeaf8)" : "var(--text-2, #8f8aa8)",
                  textDecoration: "none",
                  padding: "5px 12px",
                  borderRadius: 7,
                  background: active ? "rgba(255,255,255,0.07)" : "transparent",
                  border: active ? "1px solid rgba(255,255,255,0.09)" : "1px solid transparent",
                  transition: "color 0.15s, background 0.15s, border-color 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.color = "var(--text, #eeeaf8)";
                    (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-2, #8f8aa8)";
                    (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  }
                }}
              >
                {active && (
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "var(--violet, #8a63ff)",
                      boxShadow: "0 0 8px var(--violet-glow, rgba(138,99,255,0.4))",
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                )}
                {label}
              </Link>
            );
          })}
        </nav>

        {/* ── Right cluster ─────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {/* Badge */}
          <span
            style={{
              fontFamily: "var(--font-data, 'DM Mono', monospace)",
              fontSize: 10,
              fontWeight: 400,
              letterSpacing: "0.06em",
              color: "var(--text-muted, #524e66)",
              background: "var(--surface-plus, #1f1c29)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 4,
              padding: "2px 8px",
              display: "none",
            }}
            className="badge-version"
          >
            BETA
          </span>

          {!useClerk ? (
            <Link
              href="/verify"
              className="btn-primary"
              style={{ padding: "8px 18px", fontSize: 13 }}
            >
              Get started
            </Link>
          ) : (
            <ClerkAuthButtons />
          )}
        </div>
      </div>

      {/* Violet accent line — ultra thin, glows at center */}
      <div
        style={{
          position: "absolute",
          bottom: -1,
          left: "50%",
          transform: "translateX(-50%)",
          width: "30%",
          height: 1,
          background:
            "linear-gradient(90deg, transparent, rgba(138,99,255,0.5) 50%, transparent)",
          pointerEvents: "none",
        }}
      />
    </header>
  );
}