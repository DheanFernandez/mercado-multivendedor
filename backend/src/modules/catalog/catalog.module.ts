import { Module } from '@nestjs/common';
import { CATALOGO_REPOSITORY, type CatalogoRepository } from './application/ports/catalogo.repository.js';
import { ConsultarCatalogo, ObtenerDetalleCatalogo } from './application/use-cases/catalogo.use-cases.js';
import { CatalogoController } from './entry-adapters/catalogo.controller.js';
import { PrismaCatalogoRepository } from './infrastructure/prisma-catalogo.repository.js';

/** Marketplace y catálogo (lectura pública). Su API pública (index.ts) la consume el carrito. */
@Module({
  controllers: [CatalogoController],
  providers: [
    { provide: CATALOGO_REPOSITORY, useClass: PrismaCatalogoRepository },
    { provide: ConsultarCatalogo, useFactory: (r: CatalogoRepository) => new ConsultarCatalogo(r), inject: [CATALOGO_REPOSITORY] },
    { provide: ObtenerDetalleCatalogo, useFactory: (r: CatalogoRepository) => new ObtenerDetalleCatalogo(r), inject: [CATALOGO_REPOSITORY] },
  ],
  exports: [ObtenerDetalleCatalogo],
})
export class CatalogModule {}
