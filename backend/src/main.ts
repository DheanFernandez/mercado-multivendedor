import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { montarDocumentacionOpenApi } from './shared/http/openapi/montar.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // CORS restringido al frontend; sin FRONTEND_URL no se habilita ningún origen cruzado.
  const frontend = process.env.FRONTEND_URL;
  if (frontend) {
    app.enableCors({ origin: frontend.replace(/\/+$/, ''), methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'], allowedHeaders: ['Authorization', 'Content-Type'] });
  }
  montarDocumentacionOpenApi(app); // Swagger UI en /api/docs y JSON en /api/docs-json (spec 005)
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
