/**
 * Import real panoramic X-rays from the public DENTEX dataset (MICCAI 2023,
 * CC BY-NC-SA 4.0, non-commercial) as demo patients, with the expert labels
 * stored next to each image so swarm runs can be checked against them.
 *
 *   npm run dentex:import                 # a varied set of 6 X-rays
 *   npm run dentex:import -- --count 20   # the first 20 labelled X-rays
 *   npm run dentex:import -- val_38 val_30
 *
 * Images are downloaded once into .cache/dentex/ (about 150 MB) and stored
 * encrypted like any upload. They are de-identified research images, not clinic
 * patients, so they are flagged synthetic (allowed to go to a model in dev).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { prisma } from "../src/lib/db";
import { saveFile, erasePatientFiles } from "../src/lib/storage";
import { now } from "../src/lib/clock";
import { fdiToUniversal, type DatasetLabel, type GroundTruth } from "../src/lib/ground-truth";

const BASE = "https://huggingface.co/datasets/ibrahimhamamci/DENTEX/resolve/main/DENTEX";
const CACHE = path.join(process.cwd(), ".cache", "dentex");
const XRAYS = path.join(CACHE, "validation_data", "quadrant_enumeration_disease", "xrays");
const DEFAULT_SET = ["val_38", "val_30", "val_15", "val_21", "val_33", "val_39"];
const LABELS: Record<string, DatasetLabel> = { Impacted: "impacted", Caries: "caries", "Periapical Lesion": "periapical_lesion", "Deep Caries": "deep_caries" };

type Coco = {
  images: { id: number; file_name: string; width: number; height: number }[];
  annotations: { image_id: number; bbox: [number, number, number, number]; category_id_1: number; category_id_2: number; category_id_3: number }[];
  categories_3: { id: number; name: string }[];
};

async function download(url: string, to: string) {
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  fs.writeFileSync(to, Buffer.from(await res.arrayBuffer()));
}

async function ensureDataset() {
  fs.mkdirSync(CACHE, { recursive: true });
  const json = path.join(CACHE, "validation_triple.json");
  if (!fs.existsSync(json)) await download(`${BASE}/validation_triple.json`, json);
  if (!fs.existsSync(XRAYS)) {
    const zip = path.join(CACHE, "validation_data.zip");
    if (!fs.existsSync(zip)) await download(`${BASE}/validation_data.zip`, zip);
    execFileSync("unzip", ["-q", "-o", zip, "-d", CACHE]);
    fs.rmSync(zip);
  }
  return JSON.parse(fs.readFileSync(json, "utf8")) as Coco;
}

function pick(coco: Coco, argv: string[]) {
  const labelled = coco.images.filter((i) => coco.annotations.some((a) => a.image_id === i.id));
  const ci = argv.indexOf("--count");
  if (ci >= 0) return labelled.slice(0, Number(argv[ci + 1]));
  const names = argv.filter((a) => a.startsWith("val_"));
  const wanted = names.length ? names : DEFAULT_SET;
  return wanted.map((n) => {
    const img = labelled.find((i) => i.file_name === `${n}.png`);
    if (!img) throw new Error(`${n} is not a labelled DENTEX validation image`);
    return img;
  });
}

async function main() {
  const coco = await ensureDataset();
  const diag = new Map(coco.categories_3.map((c) => [c.id, LABELS[c.name]]));
  for (const img of pick(coco, process.argv.slice(2))) {
    const stem = img.file_name.replace(/\.png$/, "");
    const id = `DX-${stem.slice(4).padStart(2, "0")}`;
    const labels: GroundTruth[] = coco.annotations
      .filter((a) => a.image_id === img.id)
      .map((a) => {
        const fdi = (a.category_id_1 + 1) * 10 + (a.category_id_2 + 1);
        return { tooth: fdiToUniversal(fdi), fdi, label: diag.get(a.category_id_3)!, box: { x: a.bbox[0], y: a.bbox[1], w: a.bbox[2], h: a.bbox[3] } };
      })
      .sort((a, b) => a.tooth - b.tooth);

    if (await prisma.patient.findUnique({ where: { id } })) {
      await erasePatientFiles(id);
      await prisma.patient.delete({ where: { id } });
    }
    const t = now();
    await prisma.patient.create({
      data: {
        id,
        name: `DENTEX ${stem}`,
        initials: "DX",
        dob: "[DATE]",
        email: "[EMAIL]",
        allergies: [],
        premedicationRequired: false,
        flags: ["dataset:DENTEX"],
        synthetic: true,
        consents: { create: ["treatment", "ai_analysis"].map((purpose) => ({ purpose, granted: true, recordRef: "dataset", timestamp: t })) },
      },
    });
    const fileUrl = await saveFile(id, fs.readFileSync(path.join(XRAYS, img.file_name)));
    await prisma.imagingStudy.create({
      data: { patientId: id, type: "pano", takenAt: t, fileUrl, mimeType: "image/png", width: img.width, height: img.height, source: `DENTEX ${img.file_name} · CC BY-NC-SA 4.0`, labels },
    });
    console.log(`${id}  ${img.file_name}  ${labels.map((l) => `#${l.tooth} ${l.label}`).join(", ")}`);
  }
}

main().finally(() => prisma.$disconnect());
