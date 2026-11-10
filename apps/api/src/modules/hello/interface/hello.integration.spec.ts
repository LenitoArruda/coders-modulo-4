import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../../../app.module";
import { configureApp } from "../../../app-setup";

function headerList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

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

  it("deve aceitar o preflight com métodos e headers do fluxo de auth", async () => {
    const response = await request(app.getHttpServer())
      .options("/api/v1/hello")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,content-type")
      .expect(204);

    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(
      headerList(response.headers["access-control-allow-methods"]),
    ).toEqual(expect.arrayContaining(["get", "head", "post", "options"]));
    expect(
      headerList(response.headers["access-control-allow-headers"]),
    ).toEqual(expect.arrayContaining(["authorization", "content-type"]));
  });

  it("não deve liberar o preflight de uma origem não permitida", async () => {
    const response = await request(app.getHttpServer())
      .options("/api/v1/hello")
      .set("Origin", "http://malicious.example")
      .set("Access-Control-Request-Method", "POST");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
