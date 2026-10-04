import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_DAY, autofillDays, weekDays } from "@/lib/schedule";

const Body = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), scope: z.enum(["day", "week"]).default("week") });

export async function POST(req: Request) {
  const body = Body.parse(await req.json().catch(() => ({})));
  const date = body.date ?? DEFAULT_DAY;
  return NextResponse.json(await autofillDays(body.scope === "week" ? weekDays(date) : [date]));
}
