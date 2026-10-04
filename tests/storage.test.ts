import { afterEach, describe, expect, it, vi } from "vitest";

describe("storage on Supabase", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("uploads only ciphertext to the private bucket and reads it back", async () => {
    vi.stubEnv("SUPABASE_URL", "https://proj.supabase.co/");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const objects = new Map<string, Buffer>();
    const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
      const key = url.replace("https://proj.supabase.co/storage/v1/object/", "");
      expect((init.headers as Record<string, string>).authorization).toBe("Bearer service-key");
      if (init.method === "POST") {
        objects.set(key, Buffer.from(init.body as Uint8Array));
        return new Response("{}");
      }
      return new Response(new Uint8Array(objects.get(key)!));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { saveFile, readFile } = await import("@/lib/storage");

    const ref = await saveFile("BW-07", Buffer.from("x-ray bytes"));
    expect(ref).toMatch(/^storage:BW-07\/[0-9a-f-]{36}$/);
    const [stored] = [...objects.entries()];
    expect(stored[0]).toBe(`patient-files/${ref.slice(8)}.bin`);
    expect(stored[1].includes(Buffer.from("x-ray bytes"))).toBe(false);
    expect((await readFile(ref)).toString()).toBe("x-ray bytes");
  });
});
