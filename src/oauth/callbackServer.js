import http from 'http';

/**
 * OAuth callback server for receiving authorization codes
 * Handles the redirect from NetSuite after user authentication
 */
export class CallbackServer {
  constructor(port) {
    this.port = port;
    this.server = null;
    this.authPromiseResolve = null;
    this.authPromiseReject = null;
  }

  /**
   * Start HTTP server and wait for OAuth callback
   * @param {string} expectedState - CSRF protection state parameter
   * @param {Function} onCodeReceived - Callback when authorization code is received
   * @returns {Promise<void>}
   */
  start(expectedState, onCodeReceived) {
    return new Promise((resolve, reject) => {
      this.authPromiseResolve = resolve;
      this.authPromiseReject = reject;

      // Close existing server if any
      if (this.server) {
        this.server.close();
      }

      this.server = http.createServer(async (req, res) => {
        await this.handleRequest(req, res, expectedState, onCodeReceived);
      });

      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`❌ Port ${this.port} is already in use.`);
          console.error(`   Please close any application using this port or change the port in config.`);
        }
        this.authPromiseReject(error);
      });

      this.server.listen(this.port, () => {
        console.error(`🌐 OAuth callback server listening on http://localhost:${this.port}`);
      });

      // Set timeout for authentication (5 minutes)
      setTimeout(() => {
        if (this.server && this.server.listening) {
          this.close();
          this.authPromiseReject(new Error('Authentication timeout (5 minutes)'));
        }
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Handle OAuth callback request
   */
  async handleRequest(req, res, expectedState, onCodeReceived) {
    const url = new URL(req.url, `http://localhost:${this.port}`);

    if (url.pathname !== '/callback') {
      return;
    }

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Handle OAuth error
    if (error) {
      this.sendErrorPage(res, 'Authentication Failed', error);
      this.close();
      this.authPromiseReject(new Error(error));
      return;
    }

    // Validate state parameter (CSRF protection)
    if (state !== expectedState) {
      this.sendErrorPage(res, 'Invalid State', 'CSRF validation failed. Please try again.');
      this.close();
      this.authPromiseReject(new Error('Invalid state parameter'));
      return;
    }

    try {
      // Exchange authorization code for tokens
      await onCodeReceived(code);

      this.sendSuccessPage(res);

      // Close server after successful auth
      setTimeout(() => {
        this.close();
        this.authPromiseResolve();
      }, 3000);

    } catch (error) {
      this.sendErrorPage(res, 'Token Exchange Failed', error.message);
      this.close();
      this.authPromiseReject(error);
    }
  }

  /**
   * Send success HTML page
   */
  sendSuccessPage(res) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Authentication Successful</title>
        </head>
        <body style="font-family: system-ui; text-align: center; padding: 50px;">
          <h1>✅ Authentication Successful!</h1>
          <p>You can close this window and return to your IDE.</p>
        </body>
      </html>
    `);
  }

  /**
   * Send error HTML page
   */
  sendErrorPage(res, title, message) {
    const statusCode = title.includes('Invalid') ? 400 : 500;
    res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${title}</title>
        </head>
        <body style="font-family: system-ui; text-align: center; padding: 50px;">
          <h1>❌ ${title}</h1>
          <p style="color: #d32f2f; font-size: 1.1em;">${message}</p>
          <p style="color: #666; margin-top: 30px;">You can close this window.</p>
        </body>
      </html>
    `);
  }

  /**
   * Close the server
   */
  close() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
