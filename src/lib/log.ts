// Structured logs (one JSON object per line) so a log drain or `grep` can follow a request
// end to end by requestId. Never log message text, keys or wallet secrets.

export function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  if (process.env.LOG_SILENT === "1") return;
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));
}
