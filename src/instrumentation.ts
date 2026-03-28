export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const maskUrl = (url: string | undefined) =>
      url ? url.replace(/:([^:@]{1,60})@/, ":***@") : "MISSING";

    const env = {
      DATABASE_URL:    maskUrl(process.env.DATABASE_URL),
      DIRECT_URL:      maskUrl(process.env.DIRECT_URL),
      SANDBOX_N8N_URL: process.env.SANDBOX_N8N_URL || "(not set — sandbox disabled)",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? "set" : "(not set — demo mode)",
      CLERK_SECRET_KEY:
        process.env.CLERK_SECRET_KEY ? "set" : "(not set — demo mode)",
      PORT:      process.env.PORT     || "(not set)",
      NODE_ENV:  process.env.NODE_ENV || "(not set)",
    };

    console.log(JSON.stringify({ level: "info", message: "[drygate] server starting", env }));

    process.on("uncaughtException", (err) => {
      console.error(JSON.stringify({
        level: "error",
        message: "[drygate] uncaughtException",
        error: err.message,
        stack: err.stack,
      }));
      // Give logger time to flush, then exit — Railway will restart
      setTimeout(() => process.exit(1), 500);
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error(JSON.stringify({
        level: "error",
        message: "[drygate] unhandledRejection",
        reason: String(reason),
        promise: String(promise),
      }));
    });

    // Log a heartbeat every 60s so we know the process is alive
    setInterval(() => {
      console.log(JSON.stringify({ level: "debug", message: "[drygate] alive" }));
    }, 60_000).unref();
  }
}
