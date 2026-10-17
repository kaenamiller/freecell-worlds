// Print the SQL Better Auth needs for the options in src/auth.js (used to write
// migrations/0001_auth.sql). Run after upgrading better-auth or changing auth plugins.
import { DatabaseSync } from 'node:sqlite';
import { getMigrations } from 'better-auth/db/migration';
import { authOptions } from '../src/auth.js';

const env = { TRUSTED_ORIGINS: 'http://localhost', BETTER_AUTH_URL: 'http://localhost', BETTER_AUTH_SECRET: 'x'.repeat(32), GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'x' };
const { compileMigrations } = await getMigrations(authOptions(env, { database: new DatabaseSync(':memory:') }));
console.log(await compileMigrations());
