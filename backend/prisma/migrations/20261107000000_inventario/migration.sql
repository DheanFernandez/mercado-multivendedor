-- CreateEnum
CREATE TYPE "TipoMovimientoInventario" AS ENUM ('INGRESO', 'VENTA', 'DEVOLUCION', 'AJUSTE', 'RESERVA', 'LIBERACION');

-- CreateEnum
CREATE TYPE "EstadoReservaInventario" AS ENUM ('RESERVADA', 'LIBERADA', 'CONFIRMADA');

-- CreateTable
CREATE TABLE "inventarios" (
    "id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "puesto_id" UUID NOT NULL,
    "stock_fisico" INTEGER NOT NULL DEFAULT 0,
    "stock_reservado" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_inventario" (
    "id" UUID NOT NULL,
    "inventario_id" UUID NOT NULL,
    "tipo" "TipoMovimientoInventario" NOT NULL,
    "variacion_fisica" INTEGER NOT NULL,
    "variacion_reservada" INTEGER NOT NULL,
    "stock_fisico_despues" INTEGER NOT NULL,
    "stock_reservado_despues" INTEGER NOT NULL,
    "motivo" TEXT,
    "actor_id" UUID,
    "referencia" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas_inventario" (
    "id" UUID NOT NULL,
    "clave_operacion" TEXT NOT NULL,
    "inventario_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "estado" "EstadoReservaInventario" NOT NULL DEFAULT 'RESERVADA',
    "expira_en" TIMESTAMPTZ(3) NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservas_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventarios_producto_id_key" ON "inventarios"("producto_id");

-- CreateIndex
CREATE INDEX "inventarios_puesto_id_idx" ON "inventarios"("puesto_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventarios_producto_id_puesto_id_key" ON "inventarios"("producto_id", "puesto_id");

-- CreateIndex
CREATE INDEX "movimientos_inventario_inventario_id_creado_en_idx" ON "movimientos_inventario"("inventario_id", "creado_en");

-- CreateIndex
CREATE INDEX "reservas_inventario_estado_expira_en_idx" ON "reservas_inventario"("estado", "expira_en");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_inventario_clave_operacion_inventario_id_key" ON "reservas_inventario"("clave_operacion", "inventario_id");

-- CreateIndex
CREATE UNIQUE INDEX "productos_id_puestoId_key" ON "productos"("id", "puestoId");

-- AddForeignKey
ALTER TABLE "inventarios" ADD CONSTRAINT "inventarios_producto_id_puesto_id_fkey" FOREIGN KEY ("producto_id", "puesto_id") REFERENCES "productos"("id", "puestoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_inventario_id_fkey" FOREIGN KEY ("inventario_id") REFERENCES "inventarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_inventario" ADD CONSTRAINT "reservas_inventario_inventario_id_fkey" FOREIGN KEY ("inventario_id") REFERENCES "inventarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Restricciones que Prisma no expresa en el esquema (invariantes de ADR-003: nunca más reservado que físico)
ALTER TABLE "inventarios" ADD CONSTRAINT "inventarios_stock_chk" CHECK ("stock_fisico" >= 0 AND "stock_reservado" >= 0 AND "stock_reservado" <= "stock_fisico");
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_variacion_chk" CHECK (("variacion_fisica" <> 0 OR "variacion_reservada" <> 0) AND "stock_fisico_despues" >= 0 AND "stock_reservado_despues" >= 0);
ALTER TABLE "reservas_inventario" ADD CONSTRAINT "reservas_inventario_cantidad_chk" CHECK ("cantidad" > 0);
ALTER TABLE "reservas_inventario" ADD CONSTRAINT "reservas_inventario_clave_chk" CHECK (length("clave_operacion") BETWEEN 1 AND 100);

-- RLS sin políticas (Supabase expone public por PostgREST); el backend usa el rol postgres.
ALTER TABLE "inventarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "movimientos_inventario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reservas_inventario" ENABLE ROW LEVEL SECURITY;
