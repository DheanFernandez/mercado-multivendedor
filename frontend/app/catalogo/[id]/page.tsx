import { Suspense } from "react";
import { DetalleProducto } from "@/components/catalogo/DetalleProducto";
import { Cargando } from "@/components/comun";

export default function PaginaDetalle({ params }: PageProps<"/catalogo/[id]">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: PageProps<"/catalogo/[id]">["params"] }) {
  const { id } = await params;
  return <DetalleProducto id={id} />;
}
