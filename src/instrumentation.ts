export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const maskUrl = (url: string | undefined) =>
      url ? url.replace(/:([^:@]{1,60})@/, ":***@") : "MISSING";

    const env = {
      DATABASE_URL:    maskUrl(process.env.DATABASE_URL),
      DIRECT_URL:      maskUrl(process.env.DIRECT_URL),
      SANDBOX_N8N_URL: process.env.SANDBOX_N8N_URL || "(not set — sandbox disabled)",
      PORT:            process.env.PORT     || "(not set)",
      NODE_ENV:        process.env.NODE_ENV || "(not set)",
    };

    console.log(JSON.stringify({ level: "info", message: "[drygate] server starting", env }));

    process.on("uncaughtException", (err) => {
      console.error(JSON.stringify({
        level: "error",
        message: "[drygate] uncaughtException",
        error: err.message,
        stack: err.stack,
      }));
      setTimeout(() => process.exit(1), 500);
    });

    process.on("unhandledRejection", (reason) => {
      console.error(JSON.stringify({
        level: "error",
        message: "[drygate] unhandledRejection",
        reason: String(reason),
      }));
    });

    setInterval(() => {
      console.log(JSON.stringify({ level: "debug", message: "[drygate] alive" }));
    }, 60_000).unref();
  }
}
