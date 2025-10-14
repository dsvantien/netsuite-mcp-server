import fs from 'fs/promises';
import path from 'path';

/**
 * Session storage for OAuth tokens
 * Handles reading and writing session data to disk
 */
export class SessionStorage {
  constructor(storagePath) {
    this.storagePath = storagePath;
    this.sessionFile = path.join(storagePath, 'session.json');
  }

  /**
   * Save session data to file
   * @param {Object} data - Session data to save
   */
  async save(data) {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
      await fs.writeFile(this.sessionFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('❌ Failed to save session:', error.message);
      throw error;
    }
  }

  /**
   * Load session data from file
   * @returns {Promise<Object|null>} Session data or null if not found
   */
  async load() {
    try {
      const data = await fs.readFile(this.sessionFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // Session file doesn't exist
      }
      throw error;
    }
  }

  /**
   * Clear session file (logout)
   */
  async clear() {
    try {
      await fs.unlink(this.sessionFile);
      console.error('✅ Session cleared');
    } catch {
      // Session file doesn't exist, ignore
    }
  }

  /**
   * Check if session exists and is authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    try {
      const session = await this.load();
      return !!(session && session.authenticated && session.tokens);
    } catch {
      return false;
    }
  }
}
