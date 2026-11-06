-- CreateTable
CREATE TABLE "carritos" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carritos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrito_items" (
    "id" UUID NOT NULL,
    "carrito_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "puesto_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carrito_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carritos_usuario_id_key" ON "carritos"("usuario_id");

-- CreateIndex
CREATE INDEX "carrito_items_producto_id_idx" ON "carrito_items"("producto_id");

-- CreateIndex
CREATE UNIQUE INDEX "carrito_items_carrito_id_producto_id_key" ON "carrito_items"("carrito_id", "producto_id");

-- AddForeignKey
ALTER TABLE "carritos" ADD CONSTRAINT "carritos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrito_items" ADD CONSTRAINT "carrito_items_carrito_id_fkey" FOREIGN KEY ("carrito_id") REFERENCES "carritos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrito_items" ADD CONSTRAINT "carrito_items_producto_id_puesto_id_fkey" FOREIGN KEY ("producto_id", "puesto_id") REFERENCES "productos"("id", "puestoId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restricciones que Prisma no expresa en el esquema (cantidad entera positiva y acotada)
ALTER TABLE "carrito_items" ADD CONSTRAINT "carrito_items_cantidad_chk" CHECK ("cantidad" BETWEEN 1 AND 10000);

-- RLS sin políticas (Supabase expone public por PostgREST); el backend usa el rol postgres.
ALTER TABLE "carritos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "carrito_items" ENABLE ROW LEVEL SECURITY;
