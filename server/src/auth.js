// Better Auth configuration: Google sign-in, email + password with required verification,
// Turnstile on the password endpoints, breached-password checks and database rate limits.
import { betterAuth } from 'better-auth';
import { captcha, haveIBeenPwned } from 'better-auth/plugins';
import { sendEmail, emails } from './email.js';
import { deleteThemeAssets } from './data.js';

export const origins = (env) => env.TRUSTED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);

// `database` is the D1 binding in the Worker; scripts/gen-schema.mjs passes node:sqlite instead.
export function authOptions(env, { database = env.DB, waitUntil = (p) => p } = {}) {
  // Send in the background so response timing doesn't reveal whether an email exists.
  const mail = (to, message) => waitUntil(sendEmail(env, { to, ...message }));

  return {
    appName: 'FreeCell Worlds',
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database,
    trustedOrigins: origins(env),
    advanced: {
      // Opaque random ids; the email is a login field, never the key.
      database: { generateId: 'uuid' },
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      // Production: prefix "fcw", Domain=freecellworlds.com (sent to every subdomain).
      // Staging: prefix "fcw-staging" and no Domain, so the cookie is host-only on
      // api-staging and is never the production session under another name.
      ...(env.COOKIE_PREFIX ? { cookiePrefix: env.COOKIE_PREFIX } : {}),
      crossSubDomainCookies: env.COOKIE_DOMAIN ? { enabled: true, domain: env.COOKIE_DOMAIN } : undefined,
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, url }) => mail(user.email, emails.reset(url)),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => mail(user.email, emails.verify(url)),
    },
    socialProviders: env.GOOGLE_CLIENT_ID
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, prompt: 'select_account' } }
      : {},
    account: {
      // Google verifies its emails, so a Google sign-in may join a *verified* password
      // account with the same address. Unverified password sign-ups are never linked
      // (Better Auth's requireLocalEmailVerified) and the hourly cron removes them.
      accountLinking: { enabled: true, trustedProviders: ['google'] },
    },
    user: {
      deleteUser: {
        enabled: true,
        // Deletion is always confirmed by email, for Google and password accounts alike.
        sendDeleteAccountVerification: async ({ user, url }) => mail(user.email, emails.deleteAccount(url)),
        beforeDelete: async (user) => deleteThemeAssets(env, user.id),
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 60,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60 * 60, max: 10 },
        '/request-password-reset': { window: 60 * 15, max: 3 },
        '/reset-password': { window: 60 * 15, max: 5 },
        '/change-password': { window: 60 * 15, max: 5 },
        '/send-verification-email': { window: 60 * 15, max: 3 },
        '/delete-user': { window: 60 * 15, max: 3 },
      },
    },
    plugins: [
      captcha({
        provider: 'cloudflare-turnstile',
        secretKey: env.TURNSTILE_SECRET_KEY,
        endpoints: ['/sign-up/email', '/sign-in/email', '/request-password-reset', '/send-verification-email'],
      }),
      haveIBeenPwned({
        customPasswordCompromisedMessage: 'That password has appeared in a known data breach. Please choose a different one.',
      }),
    ],
  };
}

export const createAuth = (env, ctx) => betterAuth(authOptions(env, { waitUntil: (p) => ctx.waitUntil(p) }));
