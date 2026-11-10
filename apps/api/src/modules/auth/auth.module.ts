import { Module } from "@nestjs/common";
import { createClient } from "@supabase/supabase-js";
import { createTransport } from "nodemailer";

import { loadEnv } from "../shared/config/env";

import { ConfirmAccountUseCase } from "./application/confirm-account.use-case";
import { CreateSessionUseCase } from "./application/create-session.use-case";
import { AuthTokensRepositoryPort } from "./application/ports/auth-tokens-repository.port";
import { EmailSenderPort } from "./application/ports/email-sender.port";
import { OpaqueTokenPort } from "./application/ports/opaque-token.port";
import { PasswordHasherPort } from "./application/ports/password-hasher.port";
import { SessionTokenPort } from "./application/ports/session-token.port";
import { SessionsRepositoryPort } from "./application/ports/sessions-repository.port";
import { UsersRepositoryPort } from "./application/ports/users-repository.port";
import { SignUpUseCase } from "./application/sign-up.use-case";
import { ValidateSessionUseCase } from "./application/validate-session.use-case";
import {
  CONFIRMATION_RATE_LIMIT_MAX,
  CONFIRMATION_RATE_LIMIT_WINDOW_SECONDS,
  CONFIRMATION_TOKEN_TTL_SECONDS,
  JWT_SECRET,
  SESSION_TTL_SECONDS,
  SIGN_UP_RATE_LIMIT_MAX,
  SIGN_UP_RATE_LIMIT_WINDOW_SECONDS,
  SMTP_FROM,
  SMTP_TRANSPORT,
  SUPABASE_CLIENT,
  WEB_ORIGIN,
} from "./auth.tokens";
import { CryptoOpaqueTokenAdapter } from "./infrastructure/crypto-opaque-token.adapter";
import { JoseSessionTokenAdapter } from "./infrastructure/jose-session-token.adapter";
import { ScryptPasswordHasherAdapter } from "./infrastructure/scrypt-password-hasher.adapter";
import { SmtpEmailSender } from "./infrastructure/smtp-email.sender";
import { SupabaseAuthTokensRepository } from "./infrastructure/supabase-auth-tokens.repository";
import { SupabaseSessionsRepository } from "./infrastructure/supabase-sessions.repository";
import { SupabaseUsersRepository } from "./infrastructure/supabase-users.repository";
import { AuthController } from "./interface/auth.controller";
import { ConfirmationRateLimiter } from "./interface/confirmation-rate-limiter";
import { SessionGuard } from "./interface/session.guard";
import { SignUpRateLimiter } from "./interface/sign-up-rate-limiter";

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
      provide: CONFIRMATION_TOKEN_TTL_SECONDS,
      useFactory: () => loadEnv().confirmationTokenTtlSeconds,
    },
    {
      provide: SIGN_UP_RATE_LIMIT_MAX,
      useFactory: () => loadEnv().signUpRateLimitMax,
    },
    {
      provide: SIGN_UP_RATE_LIMIT_WINDOW_SECONDS,
      useFactory: () => loadEnv().signUpRateLimitWindowSeconds,
    },
    {
      provide: CONFIRMATION_RATE_LIMIT_MAX,
      useFactory: () => loadEnv().confirmationRateLimitMax,
    },
    {
      provide: CONFIRMATION_RATE_LIMIT_WINDOW_SECONDS,
      useFactory: () => loadEnv().confirmationRateLimitWindowSeconds,
    },
    { provide: WEB_ORIGIN, useFactory: () => loadEnv().webOrigin },
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
    {
      provide: AuthTokensRepositoryPort,
      useClass: SupabaseAuthTokensRepository,
    },
    ScryptPasswordHasherAdapter,
    { provide: PasswordHasherPort, useExisting: ScryptPasswordHasherAdapter },
    CryptoOpaqueTokenAdapter,
    { provide: OpaqueTokenPort, useExisting: CryptoOpaqueTokenAdapter },
    { provide: EmailSenderPort, useClass: SmtpEmailSender },
    CreateSessionUseCase,
    SignUpUseCase,
    SignUpRateLimiter,
    ConfirmAccountUseCase,
    ConfirmationRateLimiter,
    ValidateSessionUseCase,
    SessionGuard,
  ],
  exports: [
    CreateSessionUseCase,
    SignUpUseCase,
    SignUpRateLimiter,
    ConfirmAccountUseCase,
    ConfirmationRateLimiter,
    ValidateSessionUseCase,
    SessionTokenPort,
    JoseSessionTokenAdapter,
  ],
})
export class AuthModule {}
