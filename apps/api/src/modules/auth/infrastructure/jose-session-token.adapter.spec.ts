import { SignJWT, decodeJwt } from "jose";
import { describe, expect, it } from "vitest";

import { InvalidSessionError } from "../domain/invalid-session.error";

import { JoseSessionTokenAdapter } from "./jose-session-token.adapter";

const SECRET = "unit-test-secret-with-at-least-32-characters";
const OTHER_SECRET = "another-test-secret-with-at-least-32-characters";
const claims = {
  userId: "11111111-1111-1111-1111-111111111111",
  sessionId: "22222222-2222-2222-2222-222222222222",
};

function keyFor(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

function createAdapter(ttlSeconds = 3600, secret = SECRET) {
  return new JoseSessionTokenAdapter(secret, ttlSeconds);
}

describe("JoseSessionTokenAdapter", () => {
  it("deve assinar um JWT HS256 apenas com sub, sid, iat e exp", async () => {
    const token = await createAdapter(3600).sign(claims);
    const payload = decodeJwt(token);

    expect(payload.sub).toBe(claims.userId);
    expect(payload.sid).toBe(claims.sessionId);
    expect(typeof payload.iat).toBe("number");
    expect(typeof payload.exp).toBe("number");
    expect(payload.exp! - payload.iat!).toBe(3600);
    expect(Object.keys(payload).sort()).toEqual(["exp", "iat", "sid", "sub"]);
  });

  it("deve validar um token assinado com o mesmo segredo", async () => {
    const adapter = createAdapter();
    const token = await adapter.sign(claims);

    await expect(adapter.verify(token)).resolves.toEqual(claims);
  });

  it("deve rejeitar um token assinado com outro segredo", async () => {
    const token = await createAdapter(3600, OTHER_SECRET).sign(claims);

    await expect(createAdapter().verify(token)).rejects.toBeInstanceOf(
      InvalidSessionError,
    );
  });

  it("deve rejeitar um token expirado", async () => {
    const issuedAt = Math.floor(Date.now() / 1000) - 120;
    const expired = await new SignJWT({ sid: claims.sessionId })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.userId)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + 60)
      .sign(keyFor(SECRET));

    await expect(createAdapter().verify(expired)).rejects.toBeInstanceOf(
      InvalidSessionError,
    );
  });

  it("deve rejeitar um token sem sid", async () => {
    const issuedAt = Math.floor(Date.now() / 1000);
    const withoutSession = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.userId)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + 60)
      .sign(keyFor(SECRET));

    await expect(createAdapter().verify(withoutSession)).rejects.toBeInstanceOf(
      InvalidSessionError,
    );
  });

  it("deve rejeitar um token malformado", async () => {
    await expect(createAdapter().verify("not-a-jwt")).rejects.toBeInstanceOf(
      InvalidSessionError,
    );
  });

  it("deve rejeitar um token assinado com outro algoritmo", async () => {
    const issuedAt = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ sid: claims.sessionId })
      .setProtectedHeader({ alg: "HS512" })
      .setSubject(claims.userId)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + 60)
      .sign(keyFor(SECRET));

    await expect(createAdapter().verify(token)).rejects.toBeInstanceOf(
      InvalidSessionError,
    );
  });
});
