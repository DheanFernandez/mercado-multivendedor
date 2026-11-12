-- CreateEnum
CREATE TYPE "EstadoPedidoPuesto" AS ENUM ('ESPERANDO_PAGO', 'PAGO_APROBADO', 'EN_PREPARACION', 'LISTO_PARA_RETIRO', 'ENTREGADO', 'EXPIRADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "pedidos" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "cliente_id" UUID NOT NULL,
    "clave_idempotencia" TEXT NOT NULL,
    "carrito_id" UUID NOT NULL,
    "huella_carrito" CHAR(64) NOT NULL,
    "total" DECIMAL(16,2) NOT NULL,
    "reserva_vence_en" TIMESTAMPTZ(3) NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subpedidos" (
    "id" UUID NOT NULL,
    "pedido_id" UUID NOT NULL,
    "puesto_id" UUID NOT NULL,
    "puesto_codigo" TEXT NOT NULL,
    "puesto_nombre" TEXT NOT NULL,
    "estado" "EstadoPedidoPuesto" NOT NULL DEFAULT 'ESPERANDO_PAGO',
    "subtotal" DECIMAL(16,2) NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subpedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lineas_pedido" (
    "id" UUID NOT NULL,
    "subpedido_id" UUID NOT NULL,
    "puesto_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "nombre_producto" TEXT NOT NULL,
    "unidad_venta" "UnidadVenta" NOT NULL,
    "presentacion" TEXT,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "lineas_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_estados_subpedido" (
    "id" UUID NOT NULL,
    "subpedido_id" UUID NOT NULL,
    "estado_anterior" "EstadoPedidoPuesto",
    "estado_nuevo" "EstadoPedidoPuesto" NOT NULL,
    "origen" TEXT NOT NULL,
    "actor_id" UUID,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_estados_subpedido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_codigo_key" ON "pedidos"("codigo");

-- CreateIndex
CREATE INDEX "pedidos_cliente_id_creado_en_id_idx" ON "pedidos"("cliente_id", "creado_en" DESC, "id");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_cliente_id_clave_idempotencia_key" ON "pedidos"("cliente_id", "clave_idempotencia");

-- CreateIndex
CREATE INDEX "subpedidos_puesto_id_estado_idx" ON "subpedidos"("puesto_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "subpedidos_pedido_id_puesto_id_key" ON "subpedidos"("pedido_id", "puesto_id");

-- CreateIndex
CREATE UNIQUE INDEX "subpedidos_id_puesto_id_key" ON "subpedidos"("id", "puesto_id");

-- CreateIndex
CREATE UNIQUE INDEX "lineas_pedido_subpedido_id_producto_id_key" ON "lineas_pedido"("subpedido_id", "producto_id");

-- CreateIndex
CREATE INDEX "historial_estados_subpedido_subpedido_id_creado_en_idx" ON "historial_estados_subpedido"("subpedido_id", "creado_en");

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "subpedidos" ADD CONSTRAINT "subpedidos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "subpedidos" ADD CONSTRAINT "subpedidos_puesto_id_fkey" FOREIGN KEY ("puesto_id") REFERENCES "puestos"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lineas_pedido" ADD CONSTRAINT "lineas_pedido_subpedido_id_puesto_id_fkey" FOREIGN KEY ("subpedido_id", "puesto_id") REFERENCES "subpedidos"("id", "puesto_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lineas_pedido" ADD CONSTRAINT "lineas_pedido_producto_id_puesto_id_fkey" FOREIGN KEY ("producto_id", "puesto_id") REFERENCES "productos"("id", "puestoId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "historial_estados_subpedido" ADD CONSTRAINT "historial_estados_subpedido_subpedido_id_fkey" FOREIGN KEY ("subpedido_id") REFERENCES "subpedidos"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- ───────────── Restricciones que Prisma no expresa en el esquema (spec 003-pedidos-subpedidos, data-model §2–§3) ─────────────
-- Migración ADITIVA: solo crea objetos nuevos; no altera tablas, columnas ni tipos existentes.

-- Formatos e importes (céntimos exactos con NUMERIC; los totales Σ se garantizan en el dominio, sin triggers diferidos)
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_codigo_chk" CHECK ("codigo" ~ '^PED-[0-9A-HJKMNP-TV-Z]{8}$');
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_clave_chk" CHECK (length("clave_idempotencia") BETWEEN 1 AND 100 AND "clave_idempotencia" ~ '^[A-Za-z0-9:_.-]+$');
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_huella_chk" CHECK ("huella_carrito" ~ '^[0-9a-f]{64}$');
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_total_chk" CHECK ("total" > 0);
ALTER TABLE "subpedidos" ADD CONSTRAINT "subpedidos_subtotal_chk" CHECK ("subtotal" > 0);
ALTER TABLE "lineas_pedido" ADD CONSTRAINT "lineas_pedido_cantidad_chk" CHECK ("cantidad" BETWEEN 1 AND 10000);
ALTER TABLE "lineas_pedido" ADD CONSTRAINT "lineas_pedido_precio_chk" CHECK ("precio_unitario" > 0);
ALTER TABLE "lineas_pedido" ADD CONSTRAINT "lineas_pedido_subtotal_chk" CHECK ("subtotal" = "precio_unitario" * "cantidad");
ALTER TABLE "historial_estados_subpedido" ADD CONSTRAINT "historial_estados_subpedido_estados_chk" CHECK ("estado_anterior" IS DISTINCT FROM "estado_nuevo");
ALTER TABLE "historial_estados_subpedido" ADD CONSTRAINT "historial_estados_subpedido_origen_chk" CHECK (length("origen") BETWEEN 1 AND 50);

-- Inmutabilidad (AC08 · CA-O18). Errores de integridad (23001): no se reintentan. Ningún código de producción los desactiva.
-- Líneas e historial: solo inserción.
CREATE FUNCTION "pedidos_registro_solo_insercion"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo inserción: no admite %.', TG_TABLE_NAME, TG_OP USING ERRCODE = 'restrict_violation';
END;
$$;

-- Pedidos: no cambian código, cliente, clave, carrito, huella, total, vencimiento (ni su identidad y fecha de creación).
CREATE FUNCTION "pedidos_proteger_columnas"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.codigo IS DISTINCT FROM OLD.codigo
     OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
     OR NEW.clave_idempotencia IS DISTINCT FROM OLD.clave_idempotencia
     OR NEW.carrito_id IS DISTINCT FROM OLD.carrito_id
     OR NEW.huella_carrito IS DISTINCT FROM OLD.huella_carrito
     OR NEW.total IS DISTINCT FROM OLD.total
     OR NEW.reserva_vence_en IS DISTINCT FROM OLD.reserva_vence_en
     OR NEW.creado_en IS DISTINCT FROM OLD.creado_en THEN
    RAISE EXCEPTION 'Los datos de un pedido no se pueden modificar.' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- Subpedidos: solo pueden cambiar el estado y la fecha de actualización.
CREATE FUNCTION "subpedidos_solo_estado"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.pedido_id IS DISTINCT FROM OLD.pedido_id
     OR NEW.puesto_id IS DISTINCT FROM OLD.puesto_id
     OR NEW.puesto_codigo IS DISTINCT FROM OLD.puesto_codigo
     OR NEW.puesto_nombre IS DISTINCT FROM OLD.puesto_nombre
     OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
     OR NEW.creado_en IS DISTINCT FROM OLD.creado_en THEN
    RAISE EXCEPTION 'De un subpedido solo puede cambiar el estado.' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "pedidos_inmutable_trg" BEFORE UPDATE ON "pedidos" FOR EACH ROW EXECUTE FUNCTION "pedidos_proteger_columnas"();
CREATE TRIGGER "subpedidos_solo_estado_trg" BEFORE UPDATE ON "subpedidos" FOR EACH ROW EXECUTE FUNCTION "subpedidos_solo_estado"();
CREATE TRIGGER "lineas_pedido_inmutable_trg" BEFORE UPDATE OR DELETE ON "lineas_pedido" FOR EACH ROW EXECUTE FUNCTION "pedidos_registro_solo_insercion"();
CREATE TRIGGER "historial_estados_subpedido_inmutable_trg" BEFORE UPDATE OR DELETE ON "historial_estados_subpedido" FOR EACH ROW EXECUTE FUNCTION "pedidos_registro_solo_insercion"();

-- RLS sin políticas (Supabase expone public por PostgREST); el backend usa el rol postgres.
ALTER TABLE "pedidos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subpedidos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lineas_pedido" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "historial_estados_subpedido" ENABLE ROW LEVEL SECURITY;
