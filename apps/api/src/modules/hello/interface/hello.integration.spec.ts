import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../../../app.module";
import { configureApp } from "../../../app-setup";

describe("GET /api/v1/hello", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("deve retornar Hello World em JSON", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/hello")
      .expect(200);

    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual({ message: "Hello World" });
  });

  it("deve responder 404 com contrato de erro quando GET / não existe mais", async () => {
    const response = await request(app.getHttpServer()).get("/").expect(404);

    expect(response.body).toEqual({
      code: "NOT_FOUND",
      message: "Resource not found.",
    });
  });

  it("deve aceitar a origem permitida no CORS", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/hello")
      .set("Origin", "http://localhost:3000");

    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
  });

  it("não deve liberar uma origem não permitida", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/hello")
      .set("Origin", "http://malicious.example");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
