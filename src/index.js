#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { OAuthManager } from './oauth/manager.js';
import { NetSuiteMCPTools } from './mcp/tools.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory where the script is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname); // Go up one level from src/ to project root

/**
 * NetSuite MCP Server
 * Provides NetSuite tools to Claude Code via MCP protocol with OAuth 2.0 PKCE authentication
 */
class NetSuiteMCPServer {
  constructor() {
    // Use absolute path for sessions directory
    const sessionsPath = join(projectRoot, 'sessions');

    // Get callback port from environment or use default
    const callbackPort = parseInt(process.env.OAUTH_CALLBACK_PORT || '8080', 10);

    this.oauthManager = new OAuthManager({
      storagePath: sessionsPath,
      callbackPort
    });

    this.mcpTools = new NetSuiteMCPTools(this.oauthManager);
    this.isAuthenticated = false;

    // Create MCP server
    this.server = new Server({
      name: 'netsuite-mcp',
      version: '1.0.0',
    }, {
      capabilities: {
        tools: {}
      }
    });

    // Note: Handlers will be set up after server starts
  }

  /**
   * Setup MCP protocol handlers
   */
  setupHandlers() {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        // Check if authenticated
        this.isAuthenticated = await this.oauthManager.hasValidSession();

        // If not authenticated, return special authentication tool
        if (!this.isAuthenticated) {
          console.error('⚠️  Not authenticated - returning authentication tool');
          return {
            tools: [
              {
                name: 'netsuite_authenticate',
                description: 'Authenticate with NetSuite to access MCP tools. Required before using any NetSuite tools. If NETSUITE_ACCOUNT_ID and NETSUITE_CLIENT_ID environment variables are set, they will be used automatically.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    accountId: {
                      type: 'string',
                      description: 'NetSuite Account ID (e.g., 1234567 or 1234567_SB1 for sandbox). Optional if NETSUITE_ACCOUNT_ID env var is set.'
                    },
                    clientId: {
                      type: 'string',
                      description: 'OAuth 2.0 Client ID from NetSuite integration record. Optional if NETSUITE_CLIENT_ID env var is set.'
                    }
                  },
                  required: []
                }
              },
              {
                name: 'netsuite_logout',
                description: 'Clear NetSuite authentication session',
                inputSchema: {
                  type: 'object',
                  properties: {}
                }
              }
            ]
          };
        }

        // Fetch and return NetSuite MCP tools
        console.error('✅ Authenticated - fetching NetSuite tools');
        const tools = await this.mcpTools.fetchTools();

        // Add logout tool to the list
        const allTools = [
          ...tools,
          {
            name: 'netsuite_logout',
            description: 'Clear NetSuite authentication session and logout',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ];

        return { tools: allTools };

      } catch (error) {
        console.error('❌ Error in tools/list:', error.message);
        // Return authentication tool on error
        return {
          tools: [
            {
              name: 'netsuite_authenticate',
              description: 'Authenticate with NetSuite to access MCP tools. If NETSUITE_ACCOUNT_ID and NETSUITE_CLIENT_ID environment variables are set, they will be used automatically.',
              inputSchema: {
                type: 'object',
                properties: {
                  accountId: { type: 'string', description: 'NetSuite Account ID. Optional if NETSUITE_ACCOUNT_ID env var is set.' },
                  clientId: { type: 'string', description: 'OAuth Client ID. Optional if NETSUITE_CLIENT_ID env var is set.' }
                },
                required: []
              }
            }
          ]
        };
      }
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Handle authentication tool
        if (name === 'netsuite_authenticate') {
          return await this.handleAuthentication(args);
        }

        // Handle logout tool
        if (name === 'netsuite_logout') {
          return await this.handleLogout();
        }

        // Check authentication for NetSuite tools
        this.isAuthenticated = await this.oauthManager.hasValidSession();
        if (!this.isAuthenticated) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ Not authenticated. Please use the netsuite_authenticate tool first.\n\n' +
                      'Example:\n' +
                      '{\n' +
                      '  "accountId": "1234567",\n' +
                      '  "clientId": "your-client-id"\n' +
                      '}'
              }
            ],
            isError: true
          };
        }

        // Execute NetSuite tool
        console.error(`\n🔧 Executing NetSuite tool: ${name}`);
        const result = await this.mcpTools.executeTool(name, args);

        // Format result for MCP protocol
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            }
          ]
        };

      } catch (error) {
        console.error(`❌ Tool execution error:`, error.message);
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  /**
   * Handle NetSuite authentication
   */
  async handleAuthentication(args) {
    // Use environment variables if available, fallback to arguments
    const accountId = args.accountId || process.env.NETSUITE_ACCOUNT_ID;
    const clientId = args.clientId || process.env.NETSUITE_CLIENT_ID;

    // Validate that we have both values
    if (!accountId || !clientId) {
      return {
        content: [
          {
            type: 'text',
            text: '❌ Missing required credentials.\n\n' +
                  'Please provide credentials in one of two ways:\n\n' +
                  '1. Via arguments:\n' +
                  '   {\n' +
                  '     "accountId": "your-account-id",\n' +
                  '     "clientId": "your-client-id"\n' +
                  '   }\n\n' +
                  '2. Via environment variables (set in ~/.claude.json):\n' +
                  '   NETSUITE_ACCOUNT_ID\n' +
                  '   NETSUITE_CLIENT_ID'
          }
        ],
        isError: true
      };
    }

    try {
      console.error('\n🔐 Starting NetSuite authentication...');
      console.error(`📋 Account ID: ${accountId}`);
      console.error(`📋 Client ID: ${clientId?.substring(0, 8)}...`);

      // Indicate if using environment variables
      if (process.env.NETSUITE_ACCOUNT_ID || process.env.NETSUITE_CLIENT_ID) {
        console.error('✅ Using credentials from environment variables');
      }

      // Start OAuth flow (this will wait for user to complete authentication)
      await this.oauthManager.startAuthFlow({
        accountId,
        clientId
      });

      // Update authentication status
      this.isAuthenticated = true;

      // Clear tools cache to fetch fresh tools
      this.mcpTools.clearCache();

      return {
        content: [
          {
            type: 'text',
            text: '✅ Successfully authenticated with NetSuite!\n\n' +
                  'You can now use NetSuite MCP tools. Try asking:\n' +
                  '- "List all saved searches"\n' +
                  '- "Run a SuiteQL query to get customer data"\n' +
                  '- "Show me available reports"'
          }
        ]
      };

    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      return {
        content: [
          {
            type: 'text',
            text: `❌ Authentication failed: ${error.message}\n\n` +
                  'Please check:\n' +
                  '1. Your NetSuite Account ID is correct\n' +
                  '2. Your OAuth Client ID is correct\n' +
                  '3. The integration record has PKCE enabled\n' +
                  `4. The redirect URI is set to: http://localhost:${this.oauthManager.callbackServer.port}/callback\n` +
                  `5. Port ${this.oauthManager.callbackServer.port} is not in use by another application`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * Handle logout
   */
  async handleLogout() {
    try {
      await this.oauthManager.clearSession();
      this.mcpTools.clearCache();
      this.isAuthenticated = false;

      console.error('✅ Logged out successfully');

      return {
        content: [
          {
            type: 'text',
            text: '✅ Successfully logged out from NetSuite.\n\n' +
                  'Use netsuite_authenticate to login again.'
          }
        ]
      };

    } catch (error) {
      console.error('❌ Logout error:', error.message);
      return {
        content: [
          {
            type: 'text',
            text: `❌ Logout failed: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * Start the MCP server
   */
  async start() {
    console.error('🚀 NetSuite MCP Server starting...');
    console.error('📦 Version: 1.0.0');
    console.error('🔌 Transport: stdio (MCP Client)');
    console.error(`🌐 Callback Port: ${this.oauthManager.callbackServer.port}`);
    console.error(`📁 Sessions Directory: ${this.oauthManager.storage.storagePath}`);

    // Check if already authenticated
    this.isAuthenticated = await this.oauthManager.hasValidSession();
    if (this.isAuthenticated) {
      console.error('✅ Already authenticated with NetSuite');
      const accountId = await this.oauthManager.getAccountId();
      console.error(`📋 Account ID: ${accountId}`);
    } else {
      console.error('⚠️  Not authenticated - authentication required');
    }

    // Connect stdio transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Set up handlers after connection
    this.setupHandlers();

    console.error('✅ NetSuite MCP Server ready!\n');
  }
}

// Start the server
async function main() {
  try {
    const server = new NetSuiteMCPServer();
    await server.start();
  } catch (error) {
    console.error('❌ Fatal error starting MCP server:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

// Start the server
main();
