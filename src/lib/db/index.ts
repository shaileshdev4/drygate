import { PrismaClient } from "@prisma/client";
import { log } from "@/lib/logger";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/** Supabase :6543 = transaction-mode PgBouncer; Prisma must disable prepared statements. */
function warnIfTransactionalPoolerMisconfigured() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return;
  const url = raw.replace(/^["']|["']$/g, "");
  if (!/:(6543)(\/|\?|#|$)/.test(url)) return;
  if (/[?&]pgbouncer\s*=\s*true/i.test(url)) return;
  log.warn(
    "[prisma] DATABASE_URL uses port 6543 without ?pgbouncer=true — expect Postgres 42P05 (prepared statement already exists). Append ?pgbouncer=true to DATABASE_URL (use &pgbouncer=true if the URL already has a ?query).",
  );
}

function makePrisma() {
  warnIfTransactionalPoolerMisconfigured();

  const client = new PrismaClient({
    log: [
      { level: "error", emit: "stdout" },
      { level: "warn", emit: "stdout" },
      { level: "info", emit: "stdout" },
      { level: "query", emit: "stdout" },
    ],
  });

  // Log the moment Prisma first connects
  client
    .$connect()
    .then(() =>
      console.log(JSON.stringify({ level: "info", message: "[prisma] connected to database" })),
    )
    .catch((err: unknown) =>
      console.error(
        JSON.stringify({
          level: "error",
          message: "[prisma] connection failed",
          error: err instanceof Error ? err.message : String(err),
          DATABASE_URL: process.env.DATABASE_URL
            ? process.env.DATABASE_URL.replace(/:([^:@]+)@/, ":***@")
            : "MISSING",
        }),
      ),
    );

  return client;
}

export const prisma = globalForPrisma.prisma || makePrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
