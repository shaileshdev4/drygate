"use client";

import Link from "next/link";
import { UserButton, SignedIn, SignedOut } from "@clerk/nextjs";

export function ClerkAuthButtons() {
  return (
    <>
      <SignedOut>
        <Link
          href="/verify"
          className="btn-primary"
          style={{ padding: "8px 18px", fontSize: 13 }}
        >
          Get started
        </Link>
      </SignedOut>

      <SignedIn>
        <Link
          href="/verify"
          style={{
            fontFamily: "var(--font-ui, 'DM Sans', sans-serif)",
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: "var(--text-2, #8f8aa8)",
            textDecoration: "none",
            padding: "7px 14px",
            borderRadius: 7,
            border: "1px solid rgba(255,255,255,0.09)",
            background: "transparent",
            transition: "color 0.15s, background 0.15s",
          }}
        >
          New run
        </Link>

        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 0 0 2px rgba(138,99,255,0.15)",
          }}
        >
          <UserButton
            appearance={{
              elements: {
                avatarBox: { width: 30, height: 30, borderRadius: 7 },
              },
            }}
          />
        </div>
      </SignedIn>
    </>
  );
}
