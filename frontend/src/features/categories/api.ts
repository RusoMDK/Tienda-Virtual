import { api } from "@/lib/api";

export type SubCat = { slug: string; name: string; imageUrl?: string | null };
export type CategoryNode = {
  slug: string;
  name: string;
  imageUrl?: string | null;
  sub?: SubCat[];
};

/** GET /categories → [ {slug:"all",name:"Todos"}, {slug:"x",name:"X",imageUrl,sub:[...]} ] */
export async function fetchCategories(): Promise<CategoryNode[]> {
  const { data } = await api.get("/categories");
  return data as CategoryNode[];
}
