-- CreateEnum
CREATE TYPE "UnidadVenta" AS ENUM ('UNIDAD', 'KILOGRAMO', 'GRAMO', 'LITRO', 'DOCENA', 'MANOJO', 'PAQUETE');

-- CreateEnum
CREATE TYPE "EstadoPublicacion" AS ENUM ('BORRADOR', 'PUBLICADO', 'DESACTIVADO');

-- CreateTable
CREATE TABLE "categorias" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" UUID NOT NULL,
    "puestoId" UUID NOT NULL,
    "categoriaId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" DECIMAL(10,2) NOT NULL,
    "unidadVenta" "UnidadVenta" NOT NULL,
    "presentacion" TEXT,
    "estado" "EstadoPublicacion" NOT NULL DEFAULT 'BORRADOR',
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto_imagenes" (
    "id" UUID NOT NULL,
    "productoId" UUID NOT NULL,
    "ruta" TEXT NOT NULL,
    "textoAlternativo" TEXT,
    "orden" INTEGER NOT NULL,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producto_imagenes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_slug_key" ON "categorias"("slug");

-- CreateIndex
CREATE INDEX "productos_puestoId_estado_idx" ON "productos"("puestoId", "estado");

-- CreateIndex
CREATE INDEX "productos_categoriaId_estado_idx" ON "productos"("categoriaId", "estado");

-- CreateIndex
CREATE INDEX "productos_estado_creadoEn_idx" ON "productos"("estado", "creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "producto_imagenes_ruta_key" ON "producto_imagenes"("ruta");

-- CreateIndex
CREATE UNIQUE INDEX "producto_imagenes_productoId_orden_key" ON "producto_imagenes"("productoId", "orden");

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_puestoId_fkey" FOREIGN KEY ("puestoId") REFERENCES "puestos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_imagenes" ADD CONSTRAINT "producto_imagenes_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Restricciones que Prisma no expresa en el esquema
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_nombre_slug_chk" CHECK (length(trim("nombre")) > 0 AND length("slug") > 0 AND "slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "productos" ADD CONSTRAINT "productos_nombre_chk" CHECK (length(trim("nombre")) > 0);
ALTER TABLE "productos" ADD CONSTRAINT "productos_precio_positivo_chk" CHECK ("precio" > 0);
ALTER TABLE "producto_imagenes" ADD CONSTRAINT "producto_imagenes_orden_chk" CHECK ("orden" >= 0);
ALTER TABLE "producto_imagenes" ADD CONSTRAINT "producto_imagenes_ruta_chk" CHECK (length(trim("ruta")) > 0);

-- RLS sin políticas (Supabase expone public por PostgREST); el backend usa el rol postgres.
ALTER TABLE "categorias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "productos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "producto_imagenes" ENABLE ROW LEVEL SECURITY;
