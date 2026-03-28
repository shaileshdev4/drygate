export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const env = {
      DATABASE_URL: process.env.DATABASE_URL ? "set" : "MISSING",
      DIRECT_URL: process.env.DIRECT_URL ? "set" : "MISSING",
      SANDBOX_N8N_URL: process.env.SANDBOX_N8N_URL || "(not set)",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
        ? "set"
        : "(not set — demo mode)",
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ? "set" : "(not set — demo mode)",
      PORT: process.env.PORT || "(not set)",
      NODE_ENV: process.env.NODE_ENV,
    };
    console.log(
      JSON.stringify({ level: "info", message: "[drygate] server starting", env })
    );

    process.on("uncaughtException", (err) => {
      console.error(
        JSON.stringify({ level: "error", message: "[drygate] uncaughtException", error: err.message, stack: err.stack })
      );
    });

    process.on("unhandledRejection", (reason) => {
      console.error(
        JSON.stringify({ level: "error", message: "[drygate] unhandledRejection", reason: String(reason) })
      );
    });
  }
}
