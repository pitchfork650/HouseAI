import { NextResponse } from "next/server";
import { DEFAULT_DAY, autofillDays, importCsv, weekDays } from "@/lib/schedule";

/** Import a CSV (patient_id, name, procedure_code, duration_min, priority, earliest, latest), then auto-fill. */
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "CSV too large (2 MB max)" }, { status: 400 });
  const res = await importCsv(await file.text());
  if (!res.imported) return NextResponse.json({ error: res.errors[0] ?? "No rows imported", errors: res.errors }, { status: 400 });
  const date = String(form.get("date") ?? DEFAULT_DAY);
  const fill = await autofillDays(weekDays(date));
  return NextResponse.json({ ...res, ...fill });
}
