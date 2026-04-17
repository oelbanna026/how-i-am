const { SignJWT, jwtVerify } = require('jose');

function secretKey() {
  const raw = String(process.env.AUTH_JWT_SECRET ?? '').trim();
  if (!raw) return null;
  return new TextEncoder().encode(raw);
}

async function signAccessToken({ userId }) {
  const key = secretKey();
  if (!key) throw new Error('MISSING_AUTH_JWT_SECRET');
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60 * 24 * 14)
    .sign(key);
}

async function verifyAccessToken(token) {
  const key = secretKey();
  if (!key) throw new Error('MISSING_AUTH_JWT_SECRET');
  const t = String(token ?? '').trim();
  if (!t) throw new Error('MISSING_TOKEN');
  const { payload } = await jwtVerify(t, key, { algorithms: ['HS256'] });
  const userId = String(payload?.sub ?? '').trim();
  if (!userId) throw new Error('INVALID_TOKEN');
  return { userId };
}

module.exports = { signAccessToken, verifyAccessToken };

