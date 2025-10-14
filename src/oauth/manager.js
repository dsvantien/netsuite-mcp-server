import crypto from 'crypto';
import { generatePKCE } from './pkce.js';
import { CallbackServer } from './callbackServer.js';
import { SessionStorage } from './sessionStorage.js';
import { exchangeCodeForTokens, refreshAccessToken, shouldRefreshToken } from './tokenExchange.js';
import { openBrowser } from '../utils/browserLauncher.js';

/**
 * OAuth Manager for NetSuite OAuth 2.0 with PKCE
 * Handles authorization flow, token exchange, and automatic token refresh
 */
export class OAuthManager {
  constructor(config = {}) {
    this.callbackPort = config.callbackPort || 8765;
    this.storage = new SessionStorage(config.storagePath || './sessions');
    this.callbackServer = new CallbackServer(this.callbackPort);
  }

  /**
   * Start OAuth flow with local callback server
   * @param {Object} config - Configuration with accountId and clientId
   * @returns {Promise<string>} Authorization URL
   */
  async startAuthFlow(config) {
    const { accountId, clientId } = config;

    if (!accountId || !clientId) {
      throw new Error('accountId and clientId are required');
    }

    const pkce = generatePKCE();
    const state = crypto.randomBytes(16).toString('hex');
    const redirectUri = `http://localhost:${this.callbackPort}/callback`;

    // Store PKCE and config (critical: must persist until callback)
    await this.storage.save({
      pkce: pkce.code_verifier,
      state,
      config: { accountId, clientId, redirectUri },
      timestamp: Date.now()
    });

    // Generate authorization URL
    const authUrl = this.buildAuthorizationUrl(accountId, clientId, redirectUri, state, pkce);

    console.error(`\n🔐 NetSuite Authentication Required`);
    console.error(`📋 Opening browser for authentication...\n`);

    // Automatically open browser
    await openBrowser(authUrl);

    console.error(`📋 If browser didn't open, use this URL:\n`);
    console.error(`   ${authUrl}\n`);
    console.error(`⏳ Waiting for authentication...`);

    // Start callback server and wait for OAuth callback
    try {
      await this.callbackServer.start(state, async (code) => {
        await this.handleAuthorizationCode(code);
      });
      console.error(`✅ Authentication successful!\n`);
    } catch (error) {
      console.error(`❌ Authentication failed: ${error.message}\n`);
      throw error;
    }

    return authUrl;
  }

  /**
   * Build authorization URL for NetSuite OAuth
   */
  buildAuthorizationUrl(accountId, clientId, redirectUri, state, pkce) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'mcp',
      state: state,
      code_challenge: pkce.code_challenge,
      code_challenge_method: pkce.code_challenge_method
    });

    return `https://${accountId}.app.netsuite.com/app/login/oauth2/authorize.nl?${params}`;
  }

  /**
   * Handle authorization code from OAuth callback
   */
  async handleAuthorizationCode(code) {
    const session = await this.storage.load();

    if (!session || !session.pkce) {
      throw new Error('Invalid session or PKCE challenge not found. Please try connecting again.');
    }

    const { pkce: verifier, config } = session;

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, config, verifier);

    // Store tokens in session
    await this.storage.save({
      ...session,
      tokens,
      pkce: null, // Clear PKCE after successful exchange
      authenticated: true
    });
  }

  /**
   * Ensure token is valid, auto-refresh if expiring soon
   * @returns {Promise<string>} Valid access token
   */
  async ensureValidToken() {
    const session = await this.storage.load();

    if (!session || !session.tokens) {
      throw new Error('Not authenticated. Please run authentication first.');
    }

    // Refresh if expiring in < 5 minutes
    if (shouldRefreshToken(session.tokens)) {
      console.error('⚠️  Token expiring soon, refreshing...');
      const newTokens = await refreshAccessToken(session.tokens);

      await this.storage.save({
        ...session,
        tokens: newTokens
      });

      return newTokens.access_token;
    }

    return session.tokens.access_token;
  }

  /**
   * Check if has valid authenticated session
   * @returns {Promise<boolean>}
   */
  async hasValidSession() {
    return await this.storage.isAuthenticated();
  }

  /**
   * Get account ID from session
   * @returns {Promise<string|undefined>}
   */
  async getAccountId() {
    const session = await this.storage.load();
    return session?.tokens?.accountId;
  }

  /**
   * Clear session (logout)
   */
  async clearSession() {
    await this.storage.clear();
  }

  // Legacy methods for backward compatibility
  async saveSession(data) {
    return await this.storage.save(data);
  }

  async loadSession() {
    return await this.storage.load();
  }

  async refreshAccessToken() {
    const session = await this.storage.load();
    if (!session || !session.tokens) {
      throw new Error('No tokens found in session');
    }

    const newTokens = await refreshAccessToken(session.tokens);
    await this.storage.save({
      ...session,
      tokens: newTokens
    });

    return newTokens;
  }
}
