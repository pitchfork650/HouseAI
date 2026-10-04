import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Patient files are encrypted at rest with AES-256-GCM:
 * [12-byte IV][16-byte auth tag][ciphertext]. Key: FILE_ENCRYPTION_KEY (base64, 32 bytes).
 *
 * Where the ciphertext lives: a private Supabase Storage bucket when SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are set (production; serverless disks don't persist),
 * otherwise ./storage on local disk. Files are encrypted before they leave the app,
 * so Supabase only ever holds ciphertext.
 */
const ROOT = path.join(process.cwd(), "storage");
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "patient-files";

function supabase() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, headers: { authorization: `Bearer ${key}`, apikey: key } } : null;
}

async function sb(pathname: string, init: RequestInit = {}) {
  const s = supabase()!;
  const res = await fetch(`${s.url}/storage/v1/${pathname}`, { ...init, headers: { ...s.headers, ...init.headers } });
  if (!res.ok) throw new Error(`Supabase Storage ${init.method ?? "GET"} ${pathname}: ${res.status} ${await res.text()}`);
  return res;
}

/** Create the private bucket if it doesn't exist (run once from the production setup script). */
export async function ensureBucket(): Promise<"created" | "exists" | "local"> {
  if (!supabase()) return "local";
  const s = supabase()!;
  const res = await fetch(`${s.url}/storage/v1/bucket`, { method: "POST", headers: { ...s.headers, "content-type": "application/json" }, body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }) });
  if (res.ok) return "created";
  const body = await res.text();
  if (res.status === 409 || /already exists|Duplicate/i.test(body)) return "exists";
  throw new Error(`Supabase Storage: could not create bucket ${BUCKET}: ${res.status} ${body}`);
}
let warned = false;

function key(): Buffer {
  const k = process.env.FILE_ENCRYPTION_KEY;
  if (k) {
    const buf = Buffer.from(k, "base64");
    if (buf.length !== 32) throw new Error("FILE_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
    return buf;
  }
  if (process.env.NODE_ENV === "production") throw new Error("FILE_ENCRYPTION_KEY is required in production");
  if (!warned) {
    console.warn("[storage] FILE_ENCRYPTION_KEY not set; using a dev-only derived key.");
    warned = true;
  }
  return crypto.createHash("sha256").update("houseai-dental-dev-key").digest();
}

export function encrypt(plain: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]);
}

export function decrypt(blob: Buffer): Buffer {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const d = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(blob.subarray(28)), d.final()]);
}

const folder = (patientId: string) => patientId.replace(/[^A-Za-z0-9-]/g, "");

export async function saveFile(patientId: string, data: Buffer): Promise<string> {
  const rel = `${folder(patientId)}/${crypto.randomUUID()}`;
  const blob = encrypt(data);
  if (supabase()) {
    await sb(`object/${BUCKET}/${rel}.bin`, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: new Uint8Array(blob) });
  } else {
    await fs.mkdir(path.join(ROOT, folder(patientId)), { recursive: true });
    await fs.writeFile(path.join(ROOT, `${rel}.bin`), blob);
  }
  return `storage:${rel}`;
}

export async function readFile(fileUrl: string): Promise<Buffer> {
  if (!fileUrl.startsWith("storage:")) throw new Error("Not a stored file");
  const rel = fileUrl.slice("storage:".length);
  if (rel.includes("..")) throw new Error("Bad path");
  if (supabase()) return decrypt(Buffer.from(await (await sb(`object/${BUCKET}/${rel}.bin`)).arrayBuffer()));
  return decrypt(await fs.readFile(path.join(ROOT, `${rel}.bin`)));
}

export async function erasePatientFiles(patientId: string): Promise<void> {
  if (!supabase()) return fs.rm(path.join(ROOT, folder(patientId)), { recursive: true, force: true });
  const list = (await (await sb(`object/list/${BUCKET}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prefix: folder(patientId), limit: 1000 }) })).json()) as { name: string }[];
  if (!list.length) return;
  await sb(`object/${BUCKET}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ prefixes: list.map((f) => `${folder(patientId)}/${f.name}`) }) });
}
