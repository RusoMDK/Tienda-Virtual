import { Card, CardHeader, CardContent, Badge, Button } from "@/ui";
import { useCartStore } from "@/features/cart/store";
import { Link } from "react-router-dom";
import { useToast } from "@/ui";

export type ProductDTO = {
  id: string; slug: string; name: string; description: string;
  price: number; currency: string; stock: number; active: boolean;
};

export default function ProductCard({ p }: { p: ProductDTO }) {
  const add = useCartStore((s) => s.add);
  const toast = useToast();
  const price = (p.price / 100).toFixed(2);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <Link to={`/product/${p.slug}`} className="font-semibold hover:underline">
            {p.name}
          </Link>
          {p.stock <= 3 && p.stock > 0 && <Badge>Quedan {p.stock}</Badge>}
          {p.stock === 0 && <Badge>Sin stock</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm opacity-80 mb-3 line-clamp-3">{p.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold">${price}</span>
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link to={`/product/${p.slug}`}>Ver</Link>
            </Button>
            <Button
              size="sm"
              disabled={p.stock === 0}
              onClick={() => {
                add({ productId: p.id, slug: p.slug, name: p.name, price: p.price, qty: 1 });
                toast({ title: "Añadido al carrito", variant: "success" });
              }}
            >
              Añadir
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
