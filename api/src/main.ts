import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:5173').split(','),
    credentials: true,
  });
  app.enableShutdownHooks();

  // Uploaded files (media.service.ts) live outside the database, on local
  // disk, and are served back as plain static files under /uploads — see
  // ARCHITECTURE.md's "Media" row: local disk, no S3/CDN, at this scale.
  app.useStaticAssets(join(process.cwd(), process.env.UPLOADS_DIR ?? 'uploads'), {
    prefix: '/uploads',
    // Uploaded files are served from our own address, so the browser must trust the
    // type we send and never guess a different one (MED-04: PDFs and Office files).
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });

  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);
  await app.listen(port);
  new Logger('Bootstrap').log(`API listening on http://localhost:${port}`);
}

await bootstrap();
