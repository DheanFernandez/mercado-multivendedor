import { Global, Module } from '@nestjs/common';
import { ALMACEN_ARCHIVOS } from '../../application/ports/almacen-archivos.port.js';
import { SupabaseAlmacenAdapter } from './supabase-almacen.adapter.js';

@Global()
@Module({
  providers: [{ provide: ALMACEN_ARCHIVOS, useClass: SupabaseAlmacenAdapter }],
  exports: [ALMACEN_ARCHIVOS],
})
export class StorageModule {}
