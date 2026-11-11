import { Injectable } from "@nestjs/common";

import type { AuthUser } from "../domain/auth-user";

/**
 * Intenção do endpoint `GET /auth/me`: devolver a pessoa autenticada.
 * O `SessionGuard` já resolveu e validou o `AuthUser`; este use case não
 * relê o repositório para não duplicar I/O nem alterar o comportamento.
 */
@Injectable()
export class GetCurrentUserUseCase {
  execute(user: AuthUser): AuthUser {
    return user;
  }
}
