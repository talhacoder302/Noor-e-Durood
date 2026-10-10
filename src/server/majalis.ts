import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { Majlis, type MajlisDoc } from "@/models/majlis";
import { ready } from "./ready";

export const MAJALIS_TAG = "majalis";

export type MajlisOption = { id: string; name: string; nameEn: string; city: string };

const toOption = (m: MajlisDoc): MajlisOption => ({
  id: m._id.toString(),
  name: m.name,
  nameEn: m.nameEn ?? "",
  city: m.city ?? "",
});

/** Active majalis in display order (uncached; for services and tests). */
export async function listActiveMajalis(): Promise<MajlisOption[]> {
  await ready();
  const docs = await Majlis.find({ active: true }).sort({ order: 1, name: 1 }).lean<MajlisDoc[]>();
  return docs.map(toOption);
}

/** Same list for pages; refreshed at once when an admin edits it (updateTag). */
export async function getCachedMajalis(): Promise<MajlisOption[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag(MAJALIS_TAG);
  return listActiveMajalis();
}

export async function isActiveMajlis(id: string): Promise<boolean> {
  if (!/^[0-9a-f]{24}$/.test(id)) return false;
  await ready();
  return (await Majlis.countDocuments({ _id: id, active: true })) === 1;
}

export async function majlisName(id: string | undefined): Promise<string | null> {
  if (!id || !/^[0-9a-f]{24}$/.test(id)) return null;
  await ready();
  const m = await Majlis.findById(id, { name: 1 }).lean<MajlisDoc>();
  return m?.name ?? null;
}

// Admin

export type AdminMajlis = MajlisOption & { active: boolean; order: number };

export async function listAllMajalis(): Promise<AdminMajlis[]> {
  await ready();
  const docs = await Majlis.find().sort({ active: -1, order: 1, name: 1 }).lean<MajlisDoc[]>();
  return docs.map((m) => ({ ...toOption(m), active: m.active, order: m.order }));
}

export async function createMajlis(input: { name: string; nameEn?: string; city?: string; order?: number }) {
  await ready();
  await Majlis.create({ ...input, active: true });
}

export async function updateMajlis(
  id: string,
  patch: Partial<{ name: string; nameEn: string; city: string; order: number; active: boolean }>,
) {
  await ready();
  await Majlis.updateOne({ _id: id }, { $set: patch });
}
