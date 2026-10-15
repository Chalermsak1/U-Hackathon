import { readFile } from "node:fs/promises";
import path from "node:path";

const FIXTURE_ROOT = path.join(process.cwd(), "data", "fixtures");

/** Reads a fixture JSON file; returns null when it does not exist. */
export async function readFixture<T>(...segments: string[]): Promise<T | null> {
  try {
    const raw = await readFile(path.join(FIXTURE_ROOT, ...segments), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
