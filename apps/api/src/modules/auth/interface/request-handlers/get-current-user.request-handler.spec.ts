import { describe, expect, it, vi } from "vitest";

import { GetCurrentUserUseCase } from "../../application/get-current-user.use-case";
import type { AuthUser } from "../../domain/auth-user";

import { GetCurrentUserRequestHandler } from "./get-current-user.request-handler";

const user: AuthUser = {
  id: "11111111-1111-1111-1111-111111111111",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

describe("GetCurrentUserRequestHandler", () => {
  it("deve delegar ao use case uma vez e devolver o mesmo usuário", () => {
    const execute = vi.fn((value: AuthUser) => value);
    const handler = new GetCurrentUserRequestHandler({
      execute,
    } as unknown as GetCurrentUserUseCase);

    const response = handler.handle(user);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(user);
    expect(response.user).toBe(user);
    expect(response).toEqual({ user });
  });
});
