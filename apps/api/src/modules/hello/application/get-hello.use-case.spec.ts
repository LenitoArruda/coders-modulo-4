import { describe, expect, it } from "vitest";

import { GetHelloUseCase } from "./get-hello.use-case";

describe("GetHelloUseCase", () => {
  it("deve retornar Hello World", () => {
    const useCase = new GetHelloUseCase();

    expect(useCase.execute()).toEqual({ message: "Hello World" });
  });
});
