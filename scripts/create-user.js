const crypto = require('node:crypto');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { neon } = require('@neondatabase/serverless');

function askHidden(prompt) {
  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    const bytes = [];
    const onData = chunk => {
      for (const byte of chunk) {
        if (byte === 3) {
          stdin.off('data', onData);
          stdin.setRawMode(false);
          stdout.write('\n');
          reject(new Error('Cancelled.'));
          return;
        }
        if (byte === 13 || byte === 10) {
          stdin.off('data', onData);
          stdin.setRawMode(false);
          stdout.write('\n');
          resolve(Buffer.from(bytes).toString('utf8'));
          return;
        }
        if (byte === 8 || byte === 127) {
          let index = bytes.length - 1;
          while (index > 0 && (bytes[index] & 0xc0) === 0x80) index--;
          if (index >= 0) bytes.length = index;
        } else if (byte >= 32) bytes.push(byte);
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to your Neon connection string first.');
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') throw new Error('Run this command in an interactive terminal.');

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const email = (await rl.question('Account email: ')).trim().toLowerCase();
  const displayName = (await rl.question('Account name: ')).trim();
  rl.close();
  const password = await askHidden('Temporary password (10+ characters; input hidden): ');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Enter a valid email address.');
  if (!displayName || displayName.length > 60) throw new Error('Account name must be 1 to 60 characters.');
  if (password.length < 10 || password.length > 256) throw new Error('Password must be 10 to 256 characters.');

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
  const sql = neon(process.env.DATABASE_URL);
  try {
    await sql`ALTER TABLE studyflow_users ADD COLUMN IF NOT EXISTS password_display text`;
  } catch {}
  let user;
  try {
    [user] = await sql`
      INSERT INTO studyflow_users (display_name, email, password_salt, password_hash, password_display)
      VALUES (${displayName}, ${email}, ${salt}, ${passwordHash}, ${password})
      ON CONFLICT (email) DO NOTHING
      RETURNING email
    `;
  } catch {
    [user] = await sql`
      INSERT INTO studyflow_users (display_name, email, password_salt, password_hash)
      VALUES (${displayName}, ${email}, ${salt}, ${passwordHash})
      ON CONFLICT (email) DO NOTHING
      RETURNING email
    `;
  }
  if (!user) throw new Error('An account with this email already exists.');
  console.log(`Created StudyFlow account for ${user.email}. Share the initial password securely.`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
