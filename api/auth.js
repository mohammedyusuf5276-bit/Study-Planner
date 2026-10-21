const crypto = require('node:crypto');
const { database, setSession, clearSession, getUserId, json, readJson, validOrigin } = require('../lib/server-auth');

function verifyPassword(password, salt, expectedHash) {
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = async function handler(req, res) {
  try {
    if (!validOrigin(req)) return json(res, 403, { error: 'Request origin is not allowed.' });
    if (req.method === 'GET') {
      const userId = getUserId(req);
      if (!userId) return json(res, 200, { user: null });
      const sql = database();
      const [user] = await sql`SELECT id, email, display_name FROM studyflow_users WHERE id = ${userId}`;
      if (!user) return json(res, 200, { user: null });
      return json(res, 200, { user: { id: user.id, email: user.email, displayName: user.display_name } });
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
    const body = await readJson(req, 8192);
    if (body.action === 'logout') {
      clearSession(res);
      return json(res, 200, { ok: true });
    }
    if (body.action === 'signup') {
      return json(res, 403, { error: 'Public account creation is disabled. Ask the StudyFlow administrator for an account.' });
    }
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return json(res, 400, { error: 'Enter a valid email address.' });
    }
    if (password.length < 10 || password.length > 256) {
      return json(res, 400, { error: 'Password must be between 10 and 256 characters.' });
    }

    if (body.action === 'signin') {
      const sql = database();
      const [user] = await sql`SELECT id, email, display_name, password_salt, password_hash FROM studyflow_users WHERE email = ${email}`;
      if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
        return json(res, 401, { error: 'Email or password is incorrect.' });
      }
      setSession(res, user.id);
      return json(res, 200, { user: { id: user.id, email: user.email, displayName: user.display_name } });
    }
    return json(res, 400, { error: 'Unknown account action.' });
  } catch (error) {
    console.error('StudyFlow authentication error:', error);
    return json(res, 500, { error: 'Account service is unavailable. Check the database setup and try again.' });
  }
};
