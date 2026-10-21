const crypto = require('node:crypto');
const { database, getUserId, json, readJson, validOrigin } = require('../lib/server-auth');

module.exports = async function handler(req, res) {
  try {
    if (!validOrigin(req)) return json(res, 403, { error: 'Request origin is not allowed.' });
    const userId = getUserId(req);
    if (!userId) return json(res, 401, { error: 'Sign in to manage accounts.' });
    const sql = database();
    const [currentUser] = await sql`SELECT role FROM studyflow_users WHERE id = ${userId}`;
    if (!currentUser || currentUser.role !== 'admin') return json(res, 403, { error: 'Admin access is required.' });

    if (req.method === 'GET') {
      const users = await sql`SELECT id, display_name, email, role, created_at FROM studyflow_users ORDER BY created_at DESC`;
      return json(res, 200, { users });
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

    const body = await readJson(req, 8192);
    const action = String(body.action || 'reset');
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json(res, 400, { error: 'Enter a valid account email.' });

    let displayName = '';
    if (action === 'create') {
      displayName = String(body.displayName || '').trim();
      if (!displayName || displayName.length > 60) return json(res, 400, { error: 'Name must be between 1 and 60 characters.' });
    } else if (action !== 'reset') {
      return json(res, 400, { error: 'Unknown account action.' });
    }

    const temporaryPassword = crypto.randomBytes(18).toString('base64url');
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.scryptSync(temporaryPassword, salt, 64).toString('hex');
    if (action === 'create') {
      const [user] = await sql`
        INSERT INTO studyflow_users (display_name, email, password_salt, password_hash)
        VALUES (${displayName}, ${email}, ${salt}, ${passwordHash})
        ON CONFLICT (email) DO NOTHING
        RETURNING email
      `;
      if (!user) return json(res, 409, { error: 'An account with that email already exists.' });
      return json(res, 201, { email: user.email, temporaryPassword });
    }

    const [user] = await sql`UPDATE studyflow_users SET password_salt = ${salt}, password_hash = ${passwordHash} WHERE lower(email) = ${email} RETURNING email`;
    if (!user) return json(res, 404, { error: 'No account exists with that email.' });
    return json(res, 200, { email: user.email, temporaryPassword });
  } catch (error) {
    console.error('StudyFlow admin error:', error);
    return json(res, 500, { error: 'Could not complete the account request.' });
  }
};
