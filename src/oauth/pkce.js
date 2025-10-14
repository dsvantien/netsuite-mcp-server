import crypto from 'crypto';

/**
 * PKCE (Proof Key for Code Exchange) utilities
 * Used for OAuth 2.0 public client authentication
 */

/**
 * Base64URL encoding (no padding)
 * @param {Buffer} buffer - Buffer to encode
 * @returns {string} Base64URL encoded string
 */
export function base64URLEncode(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate PKCE challenge and verifier
 * @returns {{code_verifier: string, code_challenge: string, code_challenge_method: string}}
 */
export function generatePKCE() {
  const verifier = base64URLEncode(crypto.randomBytes(32));
  const challenge = base64URLEncode(
    crypto.createHash('sha256').update(verifier).digest()
  );

  return {
    code_verifier: verifier,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  };
}
