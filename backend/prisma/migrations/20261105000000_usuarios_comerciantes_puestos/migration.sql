-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('CLIENTE', 'COMERCIANTE', 'TRABAJADOR_PUESTO', 'ADMINISTRADOR');

-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "EstadoComerciante" AS ENUM ('ACTIVO', 'SUSPENDIDO');

-- CreateEnum
CREATE TYPE "EstadoPuesto" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "telefono" TEXT,
    "rol" "RolUsuario" NOT NULL DEFAULT 'CLIENTE',
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'ACTIVO',
    "authId" TEXT,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comerciantes" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "nombreComercial" TEXT NOT NULL,
    "estado" "EstadoComerciante" NOT NULL DEFAULT 'ACTIVO',
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "comerciantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puestos" (
    "id" UUID NOT NULL,
    "comercianteId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "estado" "EstadoPuesto" NOT NULL DEFAULT 'ACTIVO',
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "puestos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_authId_key" ON "usuarios"("authId");

-- CreateIndex
CREATE INDEX "usuarios_rol_idx" ON "usuarios"("rol");

-- CreateIndex
CREATE UNIQUE INDEX "comerciantes_usuarioId_key" ON "comerciantes"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "puestos_codigo_key" ON "puestos"("codigo");

-- CreateIndex
CREATE INDEX "puestos_comercianteId_idx" ON "puestos"("comercianteId");

-- AddForeignKey
ALTER TABLE "comerciantes" ADD CONSTRAINT "comerciantes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puestos" ADD CONSTRAINT "puestos_comercianteId_fkey" FOREIGN KEY ("comercianteId") REFERENCES "comerciantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Restricciones que Prisma no expresa en el esquema
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_email_minusculas_chk" CHECK ("email" = lower("email") AND length(trim("email")) > 3);
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_nombres_chk" CHECK (length(trim("nombres")) > 0 AND length(trim("apellidos")) > 0);
ALTER TABLE "comerciantes" ADD CONSTRAINT "comerciantes_nombre_comercial_chk" CHECK (length(trim("nombreComercial")) > 0);
ALTER TABLE "puestos" ADD CONSTRAINT "puestos_codigo_nombre_chk" CHECK (length(trim("codigo")) > 0 AND length(trim("nombre")) > 0);

-- Supabase expone el esquema public mediante PostgREST: se activa RLS sin políticas para impedir
-- el acceso con las claves anon/authenticated. El backend se conecta con el rol postgres (omite RLS).
ALTER TABLE "usuarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comerciantes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "puestos" ENABLE ROW LEVEL SECURITY;
