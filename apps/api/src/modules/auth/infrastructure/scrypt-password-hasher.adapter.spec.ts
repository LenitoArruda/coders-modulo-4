import { describe, expect, it } from "vitest";

import { ScryptPasswordHasherAdapter } from "./scrypt-password-hasher.adapter";

const password = "correct horse battery staple";

describe("ScryptPasswordHasherAdapter", () => {
  it("deve gerar um hash forte e verificável sem guardar a senha", async () => {
    const hasher = new ScryptPasswordHasherAdapter();

    const hash = await hasher.hash(password);

    expect(hash.startsWith("$scrypt$ln=15,r=8,p=1$")).toBe(true);
    expect(hash).not.toContain(password);
    await expect(hasher.verify(password, hash)).resolves.toBe(true);
    await expect(hasher.verify("wrong password", hash)).resolves.toBe(false);
  });

  it("deve usar salt aleatório em cada hash", async () => {
    const hasher = new ScryptPasswordHasherAdapter();

    const first = await hasher.hash(password);
    const second = await hasher.hash(password);

    expect(first).not.toBe(second);
    await expect(hasher.verify(password, first)).resolves.toBe(true);
    await expect(hasher.verify(password, second)).resolves.toBe(true);
  });

  it("deve recusar hashes malformados sem lançar", async () => {
    const hasher = new ScryptPasswordHasherAdapter();

    await expect(hasher.verify(password, "plain-text")).resolves.toBe(false);
    await expect(
      hasher.verify(password, "$scrypt$ln=99,r=8,p=1$c2FsdA$a2V5"),
    ).resolves.toBe(false);
  });
});
