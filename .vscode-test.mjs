import { defineConfig } from '@vscode/test-cli';
import os from 'node:os';
import path from 'node:path';

// VS Code's default user-data-dir lives inside the project (.vscode-test/user-data). On deep project
// paths that pushes the Extension Host IPC socket past macOS's ~103-char unix-socket limit
// (listen EINVAL: ...-main.sock). Relocate it to a short temp path so `npm test` runs anywhere.
const userDataDir = path.join(os.tmpdir(), 'irt-vscode-test');

export default defineConfig({
  tests: [
    {
      files: 'out/test/**/*.test.js',
      mocha: {
        ui: 'bdd',
      },
      launchArgs: [ '--user-data-dir', userDataDir ],
    },
  ],
  coverage: {
    includeAll: true,
    exclude: [ '**/test/**', '**/*.test.*' ],
    reporter: [ 'text', 'html' ],
  },
});
