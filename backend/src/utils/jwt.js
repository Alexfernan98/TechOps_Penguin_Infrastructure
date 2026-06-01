const jwt = require('jsonwebtoken');

const ACCESS_SECRET  = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TTL     = process.env.JWT_EXPIRES_IN         || '1h';
const REFRESH_TTL    = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

function signAccess(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

function signRefresh(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

function verifyAccess(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

function verifyRefresh(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

function tokensForUser(user) {
  const payload = { sub: user.id, email: user.email, role: user.role };
  return {
    accessToken:  signAccess(payload),
    refreshToken: signRefresh(payload),
  };
}

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh, tokensForUser };
