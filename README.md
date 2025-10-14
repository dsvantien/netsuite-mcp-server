# NetSuite MCP Server

A Model Context Protocol (MCP) server providing access to NetSuite data through OAuth 2.0 with PKCE authentication. Works seamlessly with any MCP-compatible client including Claude Code, Cursor IDE, and Gemini CLI.

## Features

- ✅ **OAuth 2.0 with PKCE** - Secure authentication without client secrets
- ✅ **Automatic Token Refresh** - Tokens refresh automatically before expiration
- ✅ **Environment Variable Support** - Configure credentials once in your MCP config
- ✅ **Session Persistence** - Authentication survives server restarts
- ✅ **Universal MCP Integration** - Works with Claude Code, Cursor IDE, Gemini CLI, and other MCP clients
- ✅ **NetSuite MCP Tools** - Access to all NetSuite MCP capabilities (SuiteQL, Reports, Saved Searches, etc.)
- ✅ **Modular Architecture** - Clean, maintainable codebase following single-responsibility principle

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. NetSuite Setup

Create an integration record in NetSuite:
1. Navigate to **Setup > Integration > Manage Integrations > New**
2. Fill in the details:
   - **Name**: "MCP Server Integration"
   - **OAuth 2.0**: ✓ Checked
   - **Redirect URI**: `http://localhost:8080/callback` (or your custom port)
3. Save and copy the **Client ID**

### 3. MCP Client Configuration

Add to your MCP client's configuration file:

**Claude Code**: `~/.claude.json`
**Cursor IDE**: `.cursor/mcp.json`
**Gemini CLI**: Per Gemini's MCP setup

#### Option A: With Environment Variables (Recommended)

```json
{
  "mcpServers": {
    "netsuite": {
      "command": "node",
      "args": ["/absolute/path/to/netsuite-mcp-server/src/index.js"],
      "env": {
        "NETSUITE_ACCOUNT_ID": "your-account-id",
        "NETSUITE_CLIENT_ID": "your-client-id",
        "OAUTH_CALLBACK_PORT": "8080"
      }
    }
  }
}
```

**Benefits**: Set credentials once, no need to provide them every time

**Optional Environment Variables**:
- `OAUTH_CALLBACK_PORT` - OAuth callback port (default: 8080)

#### Option B: Without Environment Variables

```json
{
  "mcpServers": {
    "netsuite": {
      "command": "node",
      "args": ["/absolute/path/to/netsuite-mcp-server/src/index.js"]
    }
  }
}
```

**Note**: You'll need to provide credentials when calling `netsuite_authenticate`

### 4. Authenticate & Use

Start your MCP client and authenticate:

```
Authenticate with NetSuite
```

A browser window opens → Login to NetSuite → Authentication complete!

**Important**: After authentication, you'll need to restart your chat or reconnect the MCP server to see NetSuite tools. This is normal MCP behavior.

Once authenticated, use natural language queries:

```
Show me all customers
List available saved searches
Run a SuiteQL query to get sales orders from last month
Execute the "Monthly Revenue" report
```

## Architecture

```
MCP Client (Claude Code, Cursor, Gemini, etc.)
       │
       │ stdio (JSON-RPC)
       ▼
┌──────────────────────────────┐
│   MCP Server (Node.js)       │
│                              │
│  ┌────────────────────────┐ │
│  │ OAuth Manager          │ │
│  │ - PKCE generation      │ │
│  │ - Local HTTP server    │ │
│  │   (port 8080 default)  │ │
│  │ - Token storage        │ │
│  └────────────────────────┘ │
│                              │
│  ┌────────────────────────┐ │
│  │ MCP Tools              │ │
│  │ - ns_runCustomSuiteQL  │ │
│  │ - ns_runReport         │ │
│  │ - ns_listSavedSearches │ │
│  └────────────────────────┘ │
└──────────────────────────────┘
       │
       │ HTTPS + Bearer Token
       ▼
┌──────────────────────────────┐
│  NetSuite MCP REST API       │
└──────────────────────────────┘
```

## Project Structure

```
netsuite-mcp-server/
├── src/
│   ├── index.js              # Main MCP server entry point
│   ├── oauth/
│   │   ├── manager.js        # OAuth flow orchestrator
│   │   ├── pkce.js           # PKCE challenge/verifier generation
│   │   ├── callbackServer.js # HTTP callback server with CSRF protection
│   │   ├── sessionStorage.js # Session file management
│   │   └── tokenExchange.js  # Token exchange & refresh operations
│   ├── mcp/
│   │   └── tools.js          # NetSuite MCP API client
│   └── utils/
│       └── browserLauncher.js # Cross-platform browser launcher
├── sessions/                 # OAuth tokens (gitignored)
├── authenticate.js           # Standalone CLI authentication utility
├── package.json
├── .gitignore
└── README.md
```

### Modular Design Benefits

The codebase follows the single-responsibility principle:

- **pkce.js** - PKCE utilities (base64 encoding, challenge generation)
- **callbackServer.js** - HTTP callback handling (CSRF protection, HTML pages, timeouts)
- **sessionStorage.js** - Session persistence (save, load, clear, isAuthenticated)
- **tokenExchange.js** - NetSuite OAuth API communication (token exchange/refresh)
- **browserLauncher.js** - Cross-platform URL opening (macOS, Windows, Linux)

This modular structure enables:
- ✅ Independent testing of each module
- ✅ Easy maintenance and debugging
- ✅ Reusability in other projects
- ✅ Clear separation of concerns

## Environment Variable Configuration

### Configuration Example

```json
{
  "mcpServers": {
    "netsuite": {
      "command": "node",
      "args": ["path/to/src/index.js"],
      "env": {
        "NETSUITE_ACCOUNT_ID": "123456-sb1",
        "NETSUITE_CLIENT_ID": "your-client-id-here",
        "OAUTH_CALLBACK_PORT": "8080"
      }
    }
  }
}
```

### Environment Variables

- **NETSUITE_ACCOUNT_ID** - Your NetSuite account ID (required)
- **NETSUITE_CLIENT_ID** - Your OAuth client ID (required)
- **OAUTH_CALLBACK_PORT** - OAuth callback port (optional, default: 8080)

### Resolution Order

1. **Check arguments first**: If `accountId` or `clientId` provided as arguments, use them
2. **Fallback to environment variables**: If no arguments, use env vars
3. **Validation**: If neither source provides credentials, show error with instructions

### Security Best Practices

1. **File Permissions**: Ensure config file has restrictive permissions
   ```bash
   chmod 600 ~/.claude.json
   ```
2. **No Secrets**: Client secrets not required (PKCE authentication)
3. **Local Token Storage**: OAuth tokens stored in `sessions/` directory
4. **Never Commit**: Don't commit config files with credentials to git

## Available NetSuite MCP Tools

Once authenticated, you'll have access to NetSuite's native MCP tools:

- `ns_runCustomSuiteQL` - Execute SuiteQL queries
- `ns_listAllReports` - List available financial reports
- `ns_runReport` - Execute a specific report
- `ns_listSavedSearches` - List saved searches
- `ns_runSavedSearch` - Execute a saved search
- `ns_getRecord` - Retrieve a specific record
- `ns_createRecord` - Create a new record
- `ns_updateRecord` - Update an existing record
- And more...

The exact tools available depend on your NetSuite account configuration.

## OAuth Flow

1. **Initiation**: User calls `netsuite_authenticate` with credentials
2. **PKCE Generation**: Server generates code verifier and SHA-256 challenge
3. **Authorization URL**: Server generates NetSuite OAuth URL and starts local callback server
4. **User Login**: Browser opens NetSuite login page
5. **Authorization**: User approves access
6. **Callback**: NetSuite redirects to `http://localhost:8080/callback` with authorization code
7. **Token Exchange**: Server exchanges code for access/refresh tokens (public client pattern)
8. **Session Storage**: Tokens stored in `sessions/session.json` (persists across restarts)
9. **Auto-Refresh**: Tokens automatically refresh when expiring (5-minute buffer)

## Troubleshooting
 now uses absolute paths based on script location

### Issue: "Port already in use"

**Cause**: Another application using the OAuth callback port

**Solution**:
```bash
# Check what's using the port (example for port 8080)
lsof -i :8080

# Option 1: Kill the process
# Option 2: Change port via environment variable
```

Set custom port in your MCP config:
```json
{
  "env": {
    "OAUTH_CALLBACK_PORT": "9000"
  }
}
```

**Remember to update the redirect URI in your NetSuite integration to match the new port!**

### Issue: Tools not appearing after authentication

**Cause**: MCP clients cache tool list at session start

**Solution**:
- **Restart chat** - Open new conversation
- **Reconnect MCP** - Use `/mcp` command (Claude Code)
- **Restart app** - Close and reopen your IDE

This is normal MCP behavior - tool lists are fetched once per session.

## Development

### Standalone Authentication

Test authentication without MCP client:

```bash
node authenticate.js <accountId> <clientId>
```

### Clearing Session

```bash
rm -rf sessions/
```

Or use the `netsuite_logout` tool in your MCP client.

### Viewing Logs

All server logs output to stderr. When running in MCP clients, these logs appear in the client's console/logs.

## Technical Details

### PKCE Implementation

- **Code Verifier**: 32 random bytes, base64url encoded
- **Code Challenge**: SHA-256 hash of verifier, base64url encoded
- **Challenge Method**: S256 (required by NetSuite)

### Token Exchange (Public Client Pattern)

```http
POST https://{accountId}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code={authorization_code}
&redirect_uri=http://localhost:8080/callback
&client_id={client_id}
&code_verifier={verifier}
```

**Important**: No `Authorization` header (public client).

### Token Refresh

Tokens automatically refresh when expiring in < 5 minutes:

```http
POST https://{accountId}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token={refresh_token}
&client_id={client_id}
```

## Prerequisites

- **Node.js** 18.0.0 or higher
- **NetSuite Account** with MCP access
- **NetSuite Integration Record** with OAuth 2.0 and PKCE enabled
- **MCP Client** - Any MCP-compatible client (Claude Code, Cursor IDE, Gemini CLI, etc.)

## License

MIT

## References

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [NetSuite OAuth 2.0 Documentation](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_158081952044.html)
- [PKCE Specification (RFC 7636)](https://datatracker.ietf.org/doc/html/rfc7636)
