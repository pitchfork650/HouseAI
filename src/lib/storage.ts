import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Patient files are encrypted at rest with AES-256-GCM. Layout on disk:
 * [12-byte IV][16-byte auth tag][ciphertext]. Key: FILE_ENCRYPTION_KEY (base64, 32 bytes).
 */
const ROOT = path.join(process.cwd(), "storage");
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

export async function saveFile(patientId: string, data: Buffer): Promise<string> {
  const id = crypto.randomUUID();
  const dir = path.join(ROOT, patientId.replace(/[^A-Za-z0-9-]/g, ""));
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${id}.bin`), encrypt(data));
  return `storage:${path.basename(dir)}/${id}`;
}

export async function readFile(fileUrl: string): Promise<Buffer> {
  if (!fileUrl.startsWith("storage:")) throw new Error("Not a stored file");
  const rel = fileUrl.slice("storage:".length);
  if (rel.includes("..")) throw new Error("Bad path");
  return decrypt(await fs.readFile(path.join(ROOT, `${rel}.bin`)));
}

export async function erasePatientFiles(patientId: string): Promise<void> {
  await fs.rm(path.join(ROOT, patientId.replace(/[^A-Za-z0-9-]/g, "")), { recursive: true, force: true });
}
