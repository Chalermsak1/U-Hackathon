// Runs once when the Node server starts: start the alert watcher (see src/lib/watch.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startWatcher } = await import("./lib/watch");
  startWatcher();
}
