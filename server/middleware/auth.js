const { verifyAccessToken } = require('../services/authTokens');

async function authMiddleware(req, res, next) {
  try {
    const h = String(req.headers.authorization ?? '').trim();
    const m = h.match(/^Bearer\s+(.+)$/i);
    const token = m ? m[1] : '';
    const { userId } = await verifyAccessToken(token);
    req.userId = userId;
    next();
  } catch (e) {
    res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }
}

module.exports = { authMiddleware };

