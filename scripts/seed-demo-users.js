const crypto = require('node:crypto');
const { neon } = require('@neondatabase/serverless');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to your Neon connection string first.');
  const sql = neon(process.env.DATABASE_URL);
  try {
    await sql`ALTER TABLE studyflow_users ADD COLUMN IF NOT EXISTS password_display text`;
  } catch {}
  const accounts = [
    { email: 'studyflow-demo-one@example.test', displayName: 'Demo Student One' },
    { email: 'studyflow-demo-two@example.test', displayName: 'Demo Student Two' }
  ];
  const credentials = [];
  for (const account of accounts) {
    const password = `${crypto.randomBytes(18).toString('base64url')}A9!`;
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
    let user;
    try {
      [user] = await sql`
        INSERT INTO studyflow_users (display_name, email, password_salt, password_hash, password_display)
        VALUES (${account.displayName}, ${account.email}, ${salt}, ${passwordHash}, ${password})
        ON CONFLICT (email) DO NOTHING
        RETURNING email
      `;
    } catch {
      [user] = await sql`
        INSERT INTO studyflow_users (display_name, email, password_salt, password_hash)
        VALUES (${account.displayName}, ${account.email}, ${salt}, ${passwordHash})
        ON CONFLICT (email) DO NOTHING
        RETURNING email
      `;
    }
    if (!user) throw new Error(`${account.email} already exists; no password was changed. Remove that demo row before rerunning.`);
    credentials.push({ ...account, password });
  }
  console.log('Created demo accounts (credentials are shown once; save them securely):');
  for (const account of credentials) console.log(`${account.displayName}\n  email: ${account.email}\n  password: ${account.password}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
