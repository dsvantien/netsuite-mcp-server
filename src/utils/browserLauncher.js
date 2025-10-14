import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Open URL in default browser (cross-platform)
 * @param {string} url - URL to open
 */
export async function openBrowser(url) {
  const platform = process.platform;
  let command;

  switch (platform) {
    case 'darwin': // macOS
      command = `open "${url}"`;
      break;
    case 'win32': // Windows
      command = `start "" "${url}"`;
      break;
    default: // Linux and others
      command = `xdg-open "${url}"`;
      break;
  }

  try {
    await execAsync(command);
    console.error('🌐 Browser opened automatically');
  } catch (error) {
    console.error('⚠️  Could not auto-open browser:', error.message);
    console.error('   Please open the URL manually');
  }
}
