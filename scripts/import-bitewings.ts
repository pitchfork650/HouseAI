/**
 * Import real bitewing X-rays as demo patients, with expert caries labels stored
 * next to each image so swarm runs can be checked against them.
 *
 * Source: "Dental caries in bitewing radiographs" (Tichý et al., Charles University /
 * CTU Prague), Mendeley Data 10.17632/4fbdxs7s7w.1, CC BY-NC 3.0: research and
 * non-commercial use only, so it stays inside the app and off the marketing site.
 * 100 bitewings, carious lesions boxed by 5 experienced and 3 novice dentists. The
 * ground truth kept here is every lesion at least 3 of the 5 experienced dentists marked.
 *
 *   npm run xrays:import                 # 8 bitewings
 *   npm run xrays:import -- --count 30
 *   npm run xrays:import -- 07 31
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { prisma } from "../src/lib/db";
import { saveFile, erasePatientFiles } from "../src/lib/storage";
import { now } from "../src/lib/clock";
import { consensusBoxes, type GroundTruth } from "../src/lib/ground-truth";

const URL = "https://data.mendeley.com/public-files/datasets/4fbdxs7s7w/files/66498986-c8ec-4285-9eb7-4f56f65463c6/file_downloaded";
const CACHE = path.join(process.cwd(), ".cache", "bitewing");
const DIR = path.join(CACHE, "dental_rtg_test");
const EXPERTS = ["E0", "E1", "E2", "E3", "E4"];
const QUORUM = 3;
const SOURCE = "Tichý et al., Mendeley Data 10.17632/4fbdxs7s7w.1 · CC BY-NC 3.0";

type Coco = {
  images: { id: number; file_name: string; width: number; height: number }[];
  annotations: { image_id: number; category_id: number; bbox: [number, number, number, number] }[];
  categories: { id: number; name: string }[];
};

async function ensureDataset(): Promise<Coco> {
  if (!fs.existsSync(DIR)) {
    fs.mkdirSync(CACHE, { recursive: true });
    const zip = path.join(CACHE, "bitewings.zip");
    console.log("Downloading the bitewing dataset (about 80 MB)…");
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
    execFileSync("unzip", ["-q", "-o", zip, "-d", CACHE]);
    fs.rmSync(zip);
  }
  return JSON.parse(fs.readFileSync(path.join(DIR, "test_annotations_anonymized.json"), "utf8"));
}

async function main() {
  const coco = await ensureDataset();
  const annotator = new Map(coco.categories.map((c) => [c.id, c.name]));
  const truthFor = (imageId: number): GroundTruth[] =>
    consensusBoxes(
      coco.annotations
        .filter((a) => a.image_id === imageId && EXPERTS.includes(annotator.get(a.category_id) ?? ""))
        .map((a) => ({ annotator: annotator.get(a.category_id)!, box: { x: a.bbox[0], y: a.bbox[1], w: a.bbox[2], h: a.bbox[3] } })),
      QUORUM,
    )
      .sort((a, b) => a.box.x - b.box.x)
      .map((c) => ({ label: "caries", box: c.box, votes: c.votes }));

  const argv = process.argv.slice(2);
  const ci = argv.indexOf("--count");
  const named = argv.filter((a) => /^\d+$/.test(a) && argv[argv.indexOf(a) - 1] !== "--count");
  const withLesions = coco.images.filter((i) => truthFor(i.id).length > 0);
  const picked = named.length
    ? named.map((n) => coco.images.find((i) => i.file_name === `${n.padStart(2, "0")}.png`) ?? (() => { throw new Error(`No image ${n}.png`); })())
    : withLesions.slice(0, ci >= 0 ? Number(argv[ci + 1]) : 8);

  for (const img of picked) {
    const stem = img.file_name.replace(/\.png$/, "");
    const id = `BW-${stem}`;
    const labels = truthFor(img.id);
    if (await prisma.patient.findUnique({ where: { id } })) {
      await erasePatientFiles(id);
      await prisma.patient.delete({ where: { id } });
    }
    const t = now();
    await prisma.patient.create({
      data: {
        id,
        name: `Bitewing ${stem}`,
        initials: "BW",
        dob: "[DATE]",
        email: "[EMAIL]",
        allergies: [],
        premedicationRequired: false,
        flags: ["dataset:bitewing-caries"],
        // De-identified research images, not clinic patients: allowed to reach a model in dev.
        synthetic: true,
        consents: { create: ["treatment", "ai_analysis"].map((purpose) => ({ purpose, granted: true, recordRef: "dataset", timestamp: t })) },
      },
    });
    const fileUrl = await saveFile(id, fs.readFileSync(path.join(DIR, "images", img.file_name)));
    await prisma.imagingStudy.create({
      data: { patientId: id, type: "bitewing", takenAt: t, fileUrl, mimeType: "image/png", width: img.width, height: img.height, source: `${img.file_name} · ${SOURCE}`, labels },
    });
    console.log(`${id}  ${labels.length} lesion(s) marked by ≥${QUORUM} of 5 experienced dentists`);
  }
}

main().finally(() => prisma.$disconnect());
