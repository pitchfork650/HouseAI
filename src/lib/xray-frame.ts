import type { OverlayShape } from "./pano";

/**
 * The viewer draws every X-ray into an 800×400 frame with "xMidYMid meet"
 * (letterboxed, centred). Overlays are stored in that frame, so geometry from a
 * model or a dataset (in image pixels or 0–1000 normalized) is mapped here.
 */
export const FRAME = { width: 800, height: 400 } as const;

export function fit(width: number, height: number) {
  const s = Math.min(FRAME.width / width, FRAME.height / height);
  return { s, ox: (FRAME.width - width * s) / 2, oy: (FRAME.height - height * s) / 2 };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A box in image pixels → a labelled box overlay in the frame. */
export function pixelBoxToOverlay(box: { x: number; y: number; w: number; h: number }, label: string, img: { width: number; height: number }): OverlayShape {
  const { s, ox, oy } = fit(img.width, img.height);
  const x = ox + box.x * s, y = oy + box.y * s, w = box.w * s, h = box.h * s;
  return { kind: "box", x: r1(x), y: r1(y), w: r1(w), h: r1(h), label, lx: r1(x), ly: r1(y > 16 ? y - 5 : y + h + 12) };
}

/** Gemini-style box_2d [ymin, xmin, ymax, xmax], normalized 0–1000 to the image → frame overlay. */
export function box2dToOverlay(box: [number, number, number, number], label: string, img: { width: number; height: number }): OverlayShape {
  const [ymin, xmin, ymax, xmax] = box.map((v) => Math.min(1000, Math.max(0, v)));
  const px = { x: (xmin / 1000) * img.width, y: (ymin / 1000) * img.height, w: ((xmax - xmin) / 1000) * img.width, h: ((ymax - ymin) / 1000) * img.height };
  return pixelBoxToOverlay(px, label, img);
}
