const { database, getUserId, json, readJson, validOrigin } = require('../lib/server-auth');

module.exports = async function handler(req, res) {
  try {
    if (!validOrigin(req)) return json(res, 403, { error: 'Request origin is not allowed.' });
    const userId = getUserId(req);
    if (!userId) return json(res, 401, { error: 'Sign in to access your study data.' });
    const sql = database();

    if (req.method === 'GET') {
      const [row] = await sql`SELECT data FROM studyflow_data WHERE user_id = ${userId}`;
      return json(res, 200, { data: row?.data || null });
    }
    if (req.method !== 'PUT') return json(res, 405, { error: 'Method not allowed.' });

    const data = await readJson(req);
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.subjects) || !Array.isArray(data.tasks) || !Array.isArray(data.sessions)) {
      return json(res, 400, { error: 'Invalid study data.' });
    }
    await sql`
      INSERT INTO studyflow_data (user_id, data, updated_at)
      VALUES (${userId}, ${JSON.stringify(data)}::jsonb, now())
      ON CONFLICT (user_id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = now()
    `;
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('StudyFlow data error:', error);
    return json(res, 500, { error: 'Could not save your study data.' });
  }
};
