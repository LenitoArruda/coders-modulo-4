import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { describe, expect, it } from "vitest";

import {
  toErrorContract,
  sessionUnauthorizedException,
} from "./error-contract";

describe("toErrorContract", () => {
  it("deve preservar o payload quando o erro já segue o contrato", () => {
    const exception = new UnauthorizedException({
      code: "UNAUTHORIZED",
      message: "Your session is invalid or has expired. Sign in again.",
    });

    expect(toErrorContract(exception)).toEqual({
      status: 401,
      body: {
        code: "UNAUTHORIZED",
        message: "Your session is invalid or has expired. Sign in again.",
      },
    });
  });

  it("deve preservar fieldErrors quando presentes", () => {
    const exception = new BadRequestException({
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      fieldErrors: { email: ["Email is required."] },
    });

    expect(toErrorContract(exception)).toEqual({
      status: 400,
      body: {
        code: "VALIDATION_ERROR",
        message: "The request is invalid.",
        fieldErrors: { email: ["Email is required."] },
      },
    });
  });

  it("deve mapear HttpException padrão para código e mensagem genéricos", () => {
    const exception = new NotFoundException();

    const result = toErrorContract(exception);

    expect(result.status).toBe(404);
    expect(result.body).toEqual({
      code: "NOT_FOUND",
      message: "Resource not found.",
    });
    expect(result.body.message).not.toContain("Cannot");
  });

  it("deve usar INTERNAL_ERROR para exceções desconhecidas sem detalhes internos", () => {
    const exception = new Error("connect ECONNREFUSED postgres@secret-host");

    const result = toErrorContract(exception);

    expect(result.status).toBe(500);
    expect(result.body).toEqual({
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred. Try again later.",
    });
    expect(JSON.stringify(result.body)).not.toContain("secret-host");
  });

  it("deve usar INTERNAL_ERROR para HttpException de servidor", () => {
    const exception = new UnauthorizedException();
    const serverException = Object.assign(exception, {
      getStatus: () => 503,
    });

    expect(toErrorContract(serverException)).toEqual({
      status: 503,
      body: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred. Try again later.",
      },
    });
  });

  it("deve criar o 401 de sessão com o contrato da spec", () => {
    const exception = sessionUnauthorizedException();

    expect(exception.getStatus()).toBe(401);
    expect(toErrorContract(exception)).toEqual({
      status: 401,
      body: {
        code: "UNAUTHORIZED",
        message: "Your session is invalid or has expired. Sign in again.",
      },
    });
  });
});
