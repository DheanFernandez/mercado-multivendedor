import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { DomainErrorFilter } from './shared/http/domain-error.filter.js';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { MerchantsModule } from './modules/merchants/merchants.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { CartModule } from './modules/cart/cart.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, UsersModule, MerchantsModule, ProductsModule, InventoryModule, CartModule, OrdersModule, PaymentsModule],
  controllers: [AppController],
  providers: [AppService, { provide: APP_FILTER, useClass: DomainErrorFilter }],
})
export class AppModule {}
