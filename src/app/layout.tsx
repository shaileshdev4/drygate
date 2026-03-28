import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Header } from "@/components/layout/Header";
import "../../globals.css";

export const metadata: Metadata = {
  title: "Drygate — n8n Production Readiness Verifier",
  description:
    "Upload an n8n workflow template and get a production readiness score with exact fix steps. Real sandbox execution. Zero guessing.",
  openGraph: {
    title: "Drygate",
    description: "Is your n8n workflow production-ready?",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const clerkEnabled =
    typeof publishableKey === "string" &&
    publishableKey.trim() !== "" &&
    !publishableKey.includes("your_key");

  return (
    <>
      {clerkEnabled ? (
        <ClerkProvider>
          <html lang="en" suppressHydrationWarning>
            <head>
              <link rel="preconnect" href="https://fonts.googleapis.com" />
              <link
                rel="preconnect"
                href="https://fonts.gstatic.com"
                crossOrigin="anonymous"
              />
            </head>
            <body>
              <Header />
              {children}
            </body>
          </html>
        </ClerkProvider>
      ) : (
        <html lang="en" suppressHydrationWarning>
          <head>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link
              rel="preconnect"
              href="https://fonts.gstatic.com"
              crossOrigin="anonymous"
            />
          </head>
          <body>
            <Header />
            {children}
          </body>
        </html>
      )}
    </>
  );
}

