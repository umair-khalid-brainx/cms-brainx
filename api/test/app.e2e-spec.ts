import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';

// Requires a running database (npm run db:up at the repo root).
describe('AppController (e2e)', () => {
  // No generic here: `supertest/types` doesn't exist in the installed
  // supertest/@types/supertest versions (verified — neither package exposes
  // that subpath or re-exports `App`), and `INestApplication`'s `TServer`
  // generic already defaults to `any`.
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({ service: 'cms-api', version: '0.1.0' });
  });

  afterEach(async () => {
    await app.close();
  });
});
