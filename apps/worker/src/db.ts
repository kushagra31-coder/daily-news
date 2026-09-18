import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client/web';

export function getDb(env: any) {
  if (env.TURSO_URL && env.TURSO_AUTH_TOKEN) {
    const client = createClient({
      url: env.TURSO_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    });
    return drizzleLibsql(client);
  }
  
  if (env.DB) {
    return drizzleD1(env.DB);
  }

  throw new Error("No database configured (missing env.DB or env.TURSO_URL).");
}
