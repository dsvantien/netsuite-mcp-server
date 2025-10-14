import axios from 'axios';

/**
 * NetSuite OAuth token exchange utilities
 * Handles token exchange and refresh operations
 */

/**
 * Exchange authorization code for access/refresh tokens
 * @param {string} code - Authorization code from OAuth callback
 * @param {Object} config - Configuration with accountId, clientId, redirectUri
 * @param {string} codeVerifier - PKCE code verifier
 * @returns {Promise<Object>} Token response
 */
export async function exchangeCodeForTokens(code, config, codeVerifier) {
  const tokenUrl = `https://${config.accountId}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`;

  // CRITICAL: For Public Client with PKCE - all params in body, NO Authorization header
  const params = {
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: codeVerifier
  };

  console.error('🔄 Exchanging authorization code for tokens...');

  try {
    const response = await axios.post(tokenUrl, new URLSearchParams(params), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const tokens = {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
      expires_at: Date.now() + (response.data.expires_in * 1000),
      accountId: config.accountId,
      clientId: config.clientId
    };

    console.error('✅ Tokens obtained successfully');
    return tokens;

  } catch (error) {
    console.error('❌ Token exchange error:', error.response?.data || error.message);
    throw new Error(`Failed to exchange authorization code: ${error.response?.status || error.message}`);
  }
}

/**
 * Refresh access token using refresh token
 * @param {Object} tokens - Current tokens with refresh_token, accountId, clientId
 * @returns {Promise<Object>} New tokens
 */
export async function refreshAccessToken(tokens) {
  const { refresh_token, accountId, clientId } = tokens;
  const tokenUrl = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`;

  // For Public Client: include client_id in body
  const params = {
    grant_type: 'refresh_token',
    refresh_token: refresh_token,
    client_id: clientId
  };

  console.error('🔄 Refreshing access token...');

  try {
    const response = await axios.post(tokenUrl, new URLSearchParams(params), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const newTokens = {
      ...tokens,
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token || refresh_token,
      expires_in: response.data.expires_in,
      expires_at: Date.now() + (response.data.expires_in * 1000)
    };

    console.error('✅ Token refreshed successfully');
    return newTokens;

  } catch (error) {
    console.error('❌ Token refresh failed:', error.response?.data || error.message);
    throw new Error('Failed to refresh access token. Please re-authenticate.');
  }
}

/**
 * Check if token needs refresh (expires in less than 5 minutes)
 * @param {Object} tokens - Tokens with expires_at field
 * @returns {boolean}
 */
export function shouldRefreshToken(tokens) {
  const timeUntilExpiry = tokens.expires_at - Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  return timeUntilExpiry < fiveMinutes;
}
