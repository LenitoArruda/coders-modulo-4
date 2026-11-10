import { Module } from "@nestjs/common";
import { createClient } from "@supabase/supabase-js";
import { MailtrapClient } from "mailtrap";

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
import { RequestPasswordResetUseCase } from "./application/request-password-reset.use-case";
import { ResetPasswordUseCase } from "./application/reset-password.use-case";
import { SignInUseCase } from "./application/sign-in.use-case";
import { SignUpUseCase } from "./application/sign-up.use-case";
import { ValidateSessionUseCase } from "./application/validate-session.use-case";
import {
  CONFIRMATION_RATE_LIMIT_MAX,
  CONFIRMATION_RATE_LIMIT_WINDOW_SECONDS,
  CONFIRMATION_TOKEN_TTL_SECONDS,
  FORGOT_PASSWORD_RATE_LIMIT_MAX,
  FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS,
  JWT_SECRET,
  RESET_PASSWORD_RATE_LIMIT_MAX,
  RESET_PASSWORD_RATE_LIMIT_WINDOW_SECONDS,
  RESET_TOKEN_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  SIGN_IN_RATE_LIMIT_MAX,
  SIGN_IN_RATE_LIMIT_WINDOW_SECONDS,
  SIGN_UP_RATE_LIMIT_MAX,
  SIGN_UP_RATE_LIMIT_WINDOW_SECONDS,
  MAIL_FROM,
  MAILTRAP_CLIENT,
  SUPABASE_CLIENT,
  WEB_ORIGIN,
} from "./auth.tokens";
import { CryptoOpaqueTokenAdapter } from "./infrastructure/crypto-opaque-token.adapter";
import { JoseSessionTokenAdapter } from "./infrastructure/jose-session-token.adapter";
import { ScryptPasswordHasherAdapter } from "./infrastructure/scrypt-password-hasher.adapter";
import { MailtrapEmailSender } from "./infrastructure/mailtrap-email.sender";
import { SupabaseAuthTokensRepository } from "./infrastructure/supabase-auth-tokens.repository";
import { SupabaseSessionsRepository } from "./infrastructure/supabase-sessions.repository";
import { SupabaseUsersRepository } from "./infrastructure/supabase-users.repository";
import { AuthController } from "./interface/auth.controller";
import { ConfirmationRateLimiter } from "./interface/confirmation-rate-limiter";
import { ForgotPasswordRateLimiter } from "./interface/forgot-password-rate-limiter";
import { ResetPasswordRateLimiter } from "./interface/reset-password-rate-limiter";
import { SessionGuard } from "./interface/session.guard";
import { SignInRateLimiter } from "./interface/sign-in-rate-limiter";
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
    {
      provide: RESET_TOKEN_TTL_SECONDS,
      useFactory: () => loadEnv().resetTokenTtlSeconds,
    },
    {
      provide: FORGOT_PASSWORD_RATE_LIMIT_MAX,
      useFactory: () => loadEnv().forgotPasswordRateLimitMax,
    },
    {
      provide: FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS,
      useFactory: () => loadEnv().forgotPasswordRateLimitWindowSeconds,
    },
    {
      provide: SIGN_IN_RATE_LIMIT_MAX,
      useFactory: () => loadEnv().signInRateLimitMax,
    },
    {
      provide: SIGN_IN_RATE_LIMIT_WINDOW_SECONDS,
      useFactory: () => loadEnv().signInRateLimitWindowSeconds,
    },
    {
      provide: RESET_PASSWORD_RATE_LIMIT_MAX,
      useFactory: () => loadEnv().resetPasswordRateLimitMax,
    },
    {
      provide: RESET_PASSWORD_RATE_LIMIT_WINDOW_SECONDS,
      useFactory: () => loadEnv().resetPasswordRateLimitWindowSeconds,
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
      provide: MAILTRAP_CLIENT,
      useFactory: () =>
        new MailtrapClient({ token: loadEnv().mailtrapApiToken }),
    },
    {
      provide: MAIL_FROM,
      useFactory: () => {
        const env = loadEnv();

        return { email: env.mailFromEmail, name: env.mailFromName };
      },
    },
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
    { provide: EmailSenderPort, useClass: MailtrapEmailSender },
    CreateSessionUseCase,
    RequestPasswordResetUseCase,
    SignUpUseCase,
    SignUpRateLimiter,
    ConfirmAccountUseCase,
    ConfirmationRateLimiter,
    ForgotPasswordRateLimiter,
    ResetPasswordUseCase,
    ResetPasswordRateLimiter,
    SignInUseCase,
    SignInRateLimiter,
    ValidateSessionUseCase,
    SessionGuard,
  ],
  exports: [
    CreateSessionUseCase,
    SignUpUseCase,
    SignUpRateLimiter,
    ConfirmAccountUseCase,
    ConfirmationRateLimiter,
    SignInUseCase,
    SignInRateLimiter,
    ValidateSessionUseCase,
    SessionTokenPort,
    JoseSessionTokenAdapter,
  ],
})
export class AuthModule {}
