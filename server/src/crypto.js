'use strict';
const crypto = require('node:crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'bioannot-dev-secret-change-in-production';
const JWT_EXPIRES_SEC = 7 * 24 * 60 * 60; // 7 days

// ── Password hashing (PBKDF2 — no bcrypt needed) ──────────────────────────

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const attempt = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  // Constant-time comparison
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attempt, 'hex'));
}

// ── JWT (HS256) without jsonwebtoken package ──────────────────────────────

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function signToken(payload) {
  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body    = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + JWT_EXPIRES_SEC }));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  const parts = (token || '').split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  // Use constant-time comparison to prevent timing attacks
  const sigBuf      = Buffer.from(sig,      'base64url');
  const expectedBuf = Buffer.from(expected, 'base64url');
  if (sigBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error('Invalid signature');
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return payload;
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
