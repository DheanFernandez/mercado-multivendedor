import { Suspense } from "react";
import { Cargando } from "@/components/comun";
import { EditarProducto } from "@/components/panel/EditarProducto";

export default function PaginaEditar({ params }: PageProps<"/panel/productos/[id]">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: PageProps<"/panel/productos/[id]">["params"] }) {
  const { id } = await params;
  return <EditarProducto id={id} />;
}
