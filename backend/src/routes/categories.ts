import type { FastifyInstance } from "fastify";
import { z } from "zod";

// ──────────────────────────────────────────────
// Tipos (DB)
// ──────────────────────────────────────────────
type CatRow = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl: string | null; // en tu admin: sólo subcategorías guardan image
};

// /categories/tree
type TreeNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl: string | null;
  children: TreeNode[];
  count?: number;
};

// ──────────────────────────────────────────────
// Utils
// ──────────────────────────────────────────────
const collator = new Intl.Collator("es", { sensitivity: "base" });
const sortByName = <T extends { name: string }>(arr: T[]) =>
  arr.sort((a, b) => collator.compare(a.name, b.name));

function buildTree(rows: CatRow[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const r of rows) map.set(r.id, { ...r, children: [] });

  const roots: TreeNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRec = (n: TreeNode) => {
    sortByName(n.children);
    for (const c of n.children) sortRec(c);
  };
  sortByName(roots);
  for (const r of roots) sortRec(r);

  return roots;
}

function trimDepth(nodes: TreeNode[], depth: number): TreeNode[] {
  if (depth < 0) return nodes;
  const rec = (n: TreeNode, d: number): TreeNode => ({
    ...n,
    children: d === 0 ? [] : n.children.map((c) => rec(c, d - 1)),
  });
  return nodes.map((n) => rec(n, depth));
}

// ──────────────────────────────────────────────
// Rutas
// ──────────────────────────────────────────────
export default async function categoriesRoutes(app: FastifyInstance) {
  // ========== /categories (padres + sub, plano) ==========
  const FlatQuery = z.object({
    includeCounts: z.coerce.boolean().default(false),
    onlyActive: z.coerce.boolean().default(true),
  });

  app.get("/categories", async (req, reply) => {
    try {
      const q = FlatQuery.parse(req.query);

      // Padres y subcategorías
      const [parents, subs] = await Promise.all([
        app.prisma.category.findMany({
          where: { parentId: null },
          orderBy: { name: "asc" },
          // Los padres no suelen tener imagen (admin sólo guarda en sub),
          // pero igual la incluimos por si en tu esquema la usas.
          select: { id: true, name: true, slug: true, imageUrl: true },
        }),
        app.prisma.category.findMany({
          where: { parentId: { not: null } },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            slug: true,
            parentId: true,
            imageUrl: true,
          },
        }),
      ]);

      // Conteos (opcionales)
      let directCounts = new Map<string, number>(); // por categoryId (sub o padre si aplica)
      if (q.includeCounts) {
        const grouped = await app.prisma.product.groupBy({
          by: ["categoryId"],
          _count: { _all: true },
          where: q.onlyActive ? { active: true } : undefined,
        });
        for (const g of grouped) {
          const id = (g as any).categoryId as string | null;
          const c = (g as any)._count._all ?? 0;
          if (id) directCounts.set(id, c);
        }
      }

      // Agrupar hijos por parentId
      const byParent = new Map<string, CatRow[]>();
      for (const s of subs) {
        const list = byParent.get(s.parentId!) || [];
        list.push(s);
        byParent.set(s.parentId!, list);
      }

      // Armar payload público
      const payload = parents.map((p) => {
        const children = sortByName(byParent.get(p.id) || []);
        const sub = children.map((c) => ({
          slug: c.slug,
          name: c.name,
          imageUrl: c.imageUrl ?? null,
          ...(q.includeCounts ? { count: directCounts.get(c.id) ?? 0 } : {}),
        }));

        // Portada del padre: si no tiene imageUrl propia, usa la de la primera sub con imagen
        const parentCover =
          p.imageUrl || sub.find((s) => !!s.imageUrl)?.imageUrl || null;

        // Sumar conteos de hijos al padre (habitual: productos ligados a sub)
        const parentCount = q.includeCounts
          ? sub.reduce(
              (a, s: any) => a + (s.count ?? 0),
              directCounts.get(p.id) ?? 0
            )
          : undefined;

        return {
          slug: p.slug,
          name: p.name,
          imageUrl: parentCover,
          sub,
          ...(q.includeCounts ? { count: parentCount } : {}),
        };
      });

      // Total (si se piden conteos)
      const grandTotal = q.includeCounts
        ? payload.reduce((a, p: any) => a + (p.count ?? 0), 0)
        : undefined;

      const out = [
        {
          slug: "all",
          name: "Todos",
          imageUrl: null,
          ...(q.includeCounts ? { count: grandTotal ?? 0 } : {}),
        },
        ...payload,
      ];

      reply.header(
        "Cache-Control",
        "public, max-age=60, stale-while-revalidate=300"
      );
      return out;
    } catch (err) {
      req.log.error({ err }, "GET /categories failed");
      return reply.internalServerError("Could not load categories");
    }
  });

  // ========== /categories/tree (multinivel) ==========
  const TreeQuery = z.object({
    includeCounts: z.coerce.boolean().default(false),
    onlyActive: z.coerce.boolean().default(true),
    depth: z.coerce.number().min(0).max(6).optional(),
  });

  app.get("/categories/tree", async (req, reply) => {
    try {
      const q = TreeQuery.parse(req.query);

      const rows = await app.prisma.category.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
          imageUrl: true,
        },
        orderBy: { name: "asc" },
      });

      if (rows.length === 0) {
        reply.header(
          "Cache-Control",
          "public, max-age=60, stale-while-revalidate=300"
        );
        return {
          slug: "all",
          name: "Todos",
          imageUrl: null,
          children: [],
          ...(q.includeCounts ? { count: 0 } : {}),
        };
      }

      let tree = buildTree(rows);

      if (q.includeCounts) {
        const grouped = await app.prisma.product.groupBy({
          by: ["categoryId"],
          _count: { _all: true },
          where: q.onlyActive ? { active: true } : undefined,
        });

        const direct = new Map<string, number>();
        for (const g of grouped) {
          const id = (g as any).categoryId as string | null;
          if (id) direct.set(id, (g as any)._count._all ?? 0);
        }

        const sumCounts = (n: TreeNode): number => {
          const own = direct.get(n.id) ?? 0;
          let childSum = 0;
          for (const c of n.children) childSum += sumCounts(c);
          n.count = own + childSum;
          return n.count!;
        };
        for (const r of tree) sumCounts(r);
      }

      if (typeof q.depth === "number") tree = trimDepth(tree, q.depth);

      const rootCount = q.includeCounts
        ? tree.reduce((a, n) => a + (n.count ?? 0), 0)
        : undefined;

      const root = {
        slug: "all",
        name: "Todos",
        imageUrl: null,
        children: tree.map(
          ({ id, name, slug, parentId, children, imageUrl, count }) => ({
            id,
            name,
            slug,
            parentId,
            imageUrl,
            children,
            ...(q.includeCounts ? { count } : {}),
          })
        ),
        ...(q.includeCounts ? { count: rootCount } : {}),
      };

      reply.header(
        "Cache-Control",
        "public, max-age=60, stale-while-revalidate=300"
      );
      return root;
    } catch (err) {
      req.log.error({ err }, "GET /categories/tree failed");
      return reply.internalServerError("Could not load categories tree");
    }
  });
}
