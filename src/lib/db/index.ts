import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function makePrisma() {
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
