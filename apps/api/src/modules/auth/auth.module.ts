import { Module } from "@nestjs/common";
import { createClient } from "@supabase/supabase-js";
import { createTransport } from "nodemailer";

import { loadEnv } from "../shared/config/env";

import { CreateSessionUseCase } from "./application/create-session.use-case";
import { EmailSenderPort } from "./application/ports/email-sender.port";
import { SessionTokenPort } from "./application/ports/session-token.port";
import { SessionsRepositoryPort } from "./application/ports/sessions-repository.port";
import { UsersRepositoryPort } from "./application/ports/users-repository.port";
import { ValidateSessionUseCase } from "./application/validate-session.use-case";
import {
  JWT_SECRET,
  SESSION_TTL_SECONDS,
  SMTP_FROM,
  SMTP_TRANSPORT,
  SUPABASE_CLIENT,
} from "./auth.tokens";
import { JoseSessionTokenAdapter } from "./infrastructure/jose-session-token.adapter";
import { SmtpEmailSender } from "./infrastructure/smtp-email.sender";
import { SupabaseSessionsRepository } from "./infrastructure/supabase-sessions.repository";
import { SupabaseUsersRepository } from "./infrastructure/supabase-users.repository";
import { AuthController } from "./interface/auth.controller";
import { SessionGuard } from "./interface/session.guard";

/**
 * Session infrastructure shared by the confirmation (005) and sign-in (006)
 * slices. Configuration values are read lazily from the validated environment
 * so importing the module never requires env vars.
 */
@Module({
  controllers: [AuthController],
  providers: [
    { provide: JWT_SECRET, useFactory: () => loadEnv().jwtSecret },
    {
      provide: SESSION_TTL_SECONDS,
      useFactory: () => loadEnv().sessionTtlSeconds,
    },
    {
      provide: SUPABASE_CLIENT,
      useFactory: () => {
        const env = loadEnv();

        return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
      },
    },
    {
      provide: SMTP_TRANSPORT,
      useFactory: () => {
        const env = loadEnv();

        return createTransport({ host: env.smtpHost, port: env.smtpPort });
      },
    },
    { provide: SMTP_FROM, useFactory: () => loadEnv().smtpFrom },
    JoseSessionTokenAdapter,
    { provide: SessionTokenPort, useExisting: JoseSessionTokenAdapter },
    { provide: SessionsRepositoryPort, useClass: SupabaseSessionsRepository },
    { provide: UsersRepositoryPort, useClass: SupabaseUsersRepository },
    { provide: EmailSenderPort, useClass: SmtpEmailSender },
    CreateSessionUseCase,
    ValidateSessionUseCase,
    SessionGuard,
  ],
  exports: [
    CreateSessionUseCase,
    ValidateSessionUseCase,
    SessionTokenPort,
    JoseSessionTokenAdapter,
  ],
})
export class AuthModule {}
