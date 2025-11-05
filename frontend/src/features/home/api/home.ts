// src/features/home/api/home.ts
import { api } from "@/lib/api";
import type { HomeSection } from "@/features/home/types";

export async function fetchHomeSections(): Promise<HomeSection[]> {
  const { data } = await api.get<{ sections: HomeSection[] }>("/home");
  return data.sections ?? [];
}
