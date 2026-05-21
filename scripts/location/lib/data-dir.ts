import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DEFAULT_WEB_DATA = path.resolve(BACKEND_ROOT, "../pranidoctor-web/data/locations");

/** Resolve authoritative sheet directory (CSV/JSON; optional XLSX sheets). */
export function resolveLocationDataDir(): string {
  const fromEnv = process.env.LOCATION_DATA_DIR?.trim();
  if (fromEnv) {
    const abs = path.isAbsolute(fromEnv) ? fromEnv : path.resolve(BACKEND_ROOT, fromEnv);
    if (!fs.existsSync(abs)) {
      throw new Error(`LOCATION_DATA_DIR does not exist: ${abs}`);
    }
    return abs;
  }
  if (fs.existsSync(DEFAULT_WEB_DATA)) {
    return DEFAULT_WEB_DATA;
  }
  const local = path.join(BACKEND_ROOT, "data", "locations");
  if (fs.existsSync(local)) {
    return local;
  }
  throw new Error(
    "Location data directory not found. Set LOCATION_DATA_DIR or place CSVs under pranidoctor-web/data/locations.",
  );
}

export function readTextFile(dataDir: string, name: string): string | null {
  const p = path.join(dataDir, name);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf8").trim();
  return raw.length ? raw : null;
}
