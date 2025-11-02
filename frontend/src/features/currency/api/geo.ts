import { api } from "@/lib/api";

export type GeoGuess = { country: string | null; currency: string | null };

export async function geoGuess(): Promise<GeoGuess> {
  const { data } = await api.get("/geo/guess");
  return data;
}
