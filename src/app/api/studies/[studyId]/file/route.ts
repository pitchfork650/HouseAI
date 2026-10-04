import { prisma } from "@/lib/db";
import { readFile } from "@/lib/storage";

/** Serve a decrypted study image to the signed-in clinic UI. */
export async function GET(_req: Request, ctx: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await ctx.params;
  const s = await prisma.imagingStudy.findUnique({ where: { id: studyId } });
  if (!s?.fileUrl?.startsWith("storage:")) return new Response("Not found", { status: 404 });
  const data = await readFile(s.fileUrl);
  return new Response(new Uint8Array(data), { headers: { "content-type": s.mimeType ?? "application/octet-stream", "cache-control": "private, no-store" } });
}
