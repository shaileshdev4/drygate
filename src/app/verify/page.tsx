import { Suspense } from "react";
import VerifyPageClient from "./VerifyPageClient";

function VerifyFallback() {
  return (
    <main
      className="grid-bg"
      style={{
        minHeight: "100vh",
        padding: "36px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        fontSize: 14,
      }}
    >
      Loading verify…
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<VerifyFallback />}>
      <VerifyPageClient />
    </Suspense>
  );
}
