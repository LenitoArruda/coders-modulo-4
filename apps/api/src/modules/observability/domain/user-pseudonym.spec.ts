import { describe, expect, it } from "vitest";

import { pseudonymizeUserId } from "./user-pseudonym";

describe("pseudonymizeUserId", () => {
  const salt = "test-server-side-salt";

  it("é estável para o mesmo usuário e sal", () => {
    expect(pseudonymizeUserId("user-42", salt)).toBe(
      pseudonymizeUserId("user-42", salt),
    );
  });

  it("produz valores diferentes para usuários diferentes", () => {
    expect(pseudonymizeUserId("user-42", salt)).not.toBe(
      pseudonymizeUserId("user-43", salt),
    );
  });

  it("produz valores diferentes quando o sal muda", () => {
    expect(pseudonymizeUserId("user-42", salt)).not.toBe(
      pseudonymizeUserId("user-42", "another-test-salt"),
    );
  });

  it("não revela o identificador original", () => {
    const original = "person@example.test";
    const pseudonym = pseudonymizeUserId(original, salt);

    expect(pseudonym).not.toContain(original);
    expect(pseudonym).not.toContain("example");
    expect(pseudonym).toMatch(/^u_[a-f0-9]{32}$/);
  });
});
