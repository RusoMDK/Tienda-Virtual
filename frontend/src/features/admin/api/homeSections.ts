import { api } from "@/lib/api";
import type { HomeSection, HomeSectionType } from "@/features/home/types";

export type HomeSectionInput = {
  slug: string;
  type: HomeSectionType;
  title?: string | null;
  subtitle?: string | null;
  config?: any;
  layout?: any;
  active?: boolean;
};

export async function adminListHomeSections(): Promise<HomeSection[]> {
  const { data } = await api.get<HomeSection[]>("/admin/home/sections");
  return data;
}

export async function adminCreateHomeSection(
  input: HomeSectionInput
): Promise<HomeSection> {
  const { data } = await api.post<HomeSection>("/admin/home/sections", input);
  return data;
}

export async function adminUpdateHomeSection(
  id: string,
  input: HomeSectionInput
): Promise<HomeSection> {
  const { data } = await api.put<HomeSection>(
    `/admin/home/sections/${id}`,
    input
  );
  return data;
}

export async function adminDeleteHomeSection(id: string): Promise<void> {
  await api.delete(`/admin/home/sections/${id}`);
}

export async function adminReorderHomeSections(
  order: string[]
): Promise<{ ok: boolean }> {
  const { data } = await api.post<{ ok: boolean }>(
    "/admin/home/sections/reorder",
    { order }
  );
  return data;
}
