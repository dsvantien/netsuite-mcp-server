#!/usr/bin/env node

import { OAuthManager } from './src/oauth/manager.js';

/**
 * Standalone authentication script
 * This will authenticate with NetSuite and save tokens to session file
 */
async function authenticate() {
  const accountId = process.argv[2];
  const clientId = process.argv[3];

  if (!accountId || !clientId) {
    console.error('Usage: node authenticate.js <accountId> <clientId>');
    console.error('Example: node authenticate.js 6354785-sb1 your-client-id');
    process.exit(1);
  }

  // Get callback port from environment or use default
  const callbackPort = parseInt(process.env.OAUTH_CALLBACK_PORT || '8080', 10);

  console.log('🔐 Starting NetSuite OAuth authentication...');
  console.log(`📋 Account ID: ${accountId}`);
  console.log(`📋 Client ID: ${clientId.substring(0, 8)}...`);
  console.log(`🌐 Callback Port: ${callbackPort}`);
  console.log('');

  const oauthManager = new OAuthManager({
    storagePath: './sessions',
    callbackPort
  });

  try {
    // Start OAuth flow - this will open browser and wait for callback
    await oauthManager.startAuthFlow({
      accountId,
      clientId
    });

    console.log('');
    console.log('✅ Authentication successful!');
    console.log('✅ Tokens have been saved to ./sessions/session.json');
    console.log('');
    console.log('You can now use the NetSuite MCP server.');
    console.log('Run /mcp in Claude Code to reconnect and access NetSuite tools.');

  } catch (error) {
    console.error('');
    console.error('❌ Authentication failed:', error.message);
    console.error('');
    console.error('Please check:');
    console.error('1. Your NetSuite Account ID is correct');
    console.error('2. Your OAuth Client ID is correct');
    console.error('3. The integration record has PKCE enabled');
    console.error(`4. The redirect URI is set to: http://localhost:${callbackPort}/callback`);
    console.error(`5. Port ${callbackPort} is not in use by another application`);
    process.exit(1);
  }
}

authenticate();
