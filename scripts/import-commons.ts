/**
 * Import real dental X-rays from Wikimedia Commons whose licence allows commercial
 * use (CC BY / CC BY-SA / CC0), as demo patients. These are the only real images the
 * public landing page may show; attribution is stored in ImagingStudy.source.
 *
 *   npm run commons:import
 *
 * They are published, de-identified images, not clinic patients, so they're flagged
 * synthetic (allowed to go to a model in dev).
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { saveFile, erasePatientFiles } from "../src/lib/storage";
import { imageSize } from "../src/lib/image-size";
import { now } from "../src/lib/clock";

type Item = { id: string; file: string; type: "pa" | "bitewing" | "pano"; mime: string; ageYears: number | null; artist: string; license: string; licenseUrl: string };

const ITEMS: Item[] = [
  {
    id: "CX-01",
    file: "Periapical_radiolucency.jpg",
    type: "pa",
    mime: "image/jpeg",
    ageYears: 30,
    artist: "Shaimaa Abdellatif",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
  },
];

const CACHE = path.join(process.cwd(), ".cache", "commons");

async function download(file: string): Promise<Buffer> {
  const to = path.join(CACHE, file);
  if (fs.existsSync(to)) return fs.readFileSync(to);
  fs.mkdirSync(CACHE, { recursive: true });
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}`;
  console.log(`Downloading ${url}`);
  const res = await fetch(url, { headers: { "user-agent": "HouseAI-demo/0.1 (dental demo import)" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(to, buf);
  return buf;
}

async function main() {
  for (const it of ITEMS) {
    const buf = await download(it.file);
    const size = imageSize(buf);
    if (await prisma.patient.findUnique({ where: { id: it.id } })) {
      await erasePatientFiles(it.id);
      await prisma.patient.delete({ where: { id: it.id } });
    }
    const t = now();
    await prisma.patient.create({
      data: {
        id: it.id,
        name: `Commons ${it.type.toUpperCase()} ${it.id.slice(3)}`,
        initials: "CX",
        dob: "[DATE]",
        ageYears: it.ageYears,
        email: "[EMAIL]",
        allergies: [],
        premedicationRequired: false,
        flags: ["dataset:wikimedia-commons"],
        synthetic: true,
        consents: { create: ["treatment", "ai_analysis"].map((purpose) => ({ purpose, granted: true, recordRef: "public-image", timestamp: t })) },
      },
    });
    const fileUrl = await saveFile(it.id, buf);
    await prisma.imagingStudy.create({
      data: {
        patientId: it.id,
        type: it.type,
        takenAt: t,
        fileUrl,
        mimeType: it.mime,
        width: size?.width ?? null,
        height: size?.height ?? null,
        source: `${it.file.replace(/_/g, " ")} · ${it.artist}, Wikimedia Commons · ${it.license} (${it.licenseUrl})`,
      },
    });
    console.log(`Imported ${it.id} (${it.type}, ${size?.width}×${size?.height}) · ${it.license}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
