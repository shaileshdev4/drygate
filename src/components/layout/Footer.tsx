"use client";

import Link from "next/link";

const NAV = [
  { label: "Verify", href: "/verify" },
  { label: "History", href: "/dashboard" },
  { label: "How it works", href: "/how-it-works" },
];

export function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(8,8,12,0.8)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "48px 24px 32px",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "40px 48px",
          alignItems: "start",
        }}
      >
        {/* Brand */}
        <div>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: "linear-gradient(135deg, #8a63ff 0%, #5e3de8 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 12px rgba(138,99,255,0.35)",
                flexShrink: 0,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
                <rect x="1" y="4" width="7" height="1.5" rx="0.75" fill="white" opacity="0.95" />
                <rect x="1" y="7.5" width="5" height="1.5" rx="0.75" fill="white" opacity="0.6" />
                <circle cx="11" cy="6.5" r="1.5" fill="white" opacity="0.9" />
              </svg>
            </span>
            <span
              style={{
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "-0.03em",
                color: "var(--text)",
              }}
            >
              Drygate
            </span>
          </Link>
          <p
            style={{
              marginTop: 10,
              fontSize: 13,
              color: "var(--text-muted)",
              lineHeight: 1.6,
              maxWidth: 320,
            }}
          >
            Production readiness gate for n8n workflows. Static analysis + sandbox execution + prioritized fix plan.
          </p>
          <p
            style={{
              marginTop: 20,
              fontSize: 11,
              color: "var(--text-faint)",
              fontFamily: "var(--font-data)",
            }}
          >
            Score is heuristic — not a formal proof of safety. Use as a pre-flight signal.
          </p>
        </div>

        {/* Nav */}
        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            paddingTop: 4,
          }}
        >
          {NAV.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                textDecoration: "none",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)")
              }
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "16px 24px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "var(--text-faint)",
            fontFamily: "var(--font-data)",
          }}
        >
          Drygate · Built for n8n automation teams
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-faint)",
            fontFamily: "var(--font-data)",
          }}
        >
          Demo build — requires Docker + n8n sandbox
        </span>
      </div>
    </footer>
  );
}
