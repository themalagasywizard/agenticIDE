// Tauri API wrapper for Tauri v2
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readDir as fsReadDir, readTextFile as fsReadTextFile, writeTextFile as fsWriteTextFile, remove, rename, mkdir } from '@tauri-apps/plugin-fs';

// Development mode detection
const isTauri = typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__ !== "undefined";

// Mock implementations for development
const mockOpen = async (options: any) => {
  console.warn("Tauri dialog API not available in development mode, using browser fallback");

  // For development, we can use the browser's file picker as a fallback
  if (typeof document !== "undefined") {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = options?.multiple || false;
    input.webkitdirectory = options?.directory || false;

    return new Promise((resolve) => {
      input.onchange = (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          if (options?.directory) {
            // For directory selection, return the directory path
            const file = files[0];

            // Try to get the directory path using various methods
            let directoryPath: string | null = null;

            if (file.webkitRelativePath) {
              // Chrome/Edge: webkitRelativePath gives us path/to/file
              const pathParts = file.webkitRelativePath.split('/');
              if (pathParts.length > 1) {
                directoryPath = pathParts[0];
              }
            }

            if (!directoryPath && (file as any).path) {
              // Some browsers provide a path property
              try {
                const fullPath = (file as any).path;
                const pathParts = fullPath.split(/[/\\]/);
                if (pathParts.length > 1) {
                  // Remove the filename to get directory
                  pathParts.pop();
                  directoryPath = pathParts.join('/');
                }
              } catch (error) {
                console.warn('Could not extract directory from path:', error);
              }
            }

            if (!directoryPath) {
              // Ultimate fallback: use the first file's name as directory name
              directoryPath = file.name;
            }

            resolve(directoryPath);
          } else {
            // For file selection, return the file path
            const file = files[0];

            // Try various methods to get the file path
            if ((file as any).path) {
              // Some browsers provide a path property
              resolve((file as any).path);
            } else if (file.webkitRelativePath) {
              // Chrome/Edge: webkitRelativePath gives us path/to/file
              resolve(file.webkitRelativePath);
            } else {
              // Fallback: just return the filename
              resolve(file.name);
            }
          }
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  }

  return null;
};

const mockReadDir = async (path: string) => {
  console.warn("Tauri fs API not available in development mode - returning enhanced mock data for:", path);

  // Normalize path for matching
  const normalizedPath = path.replace(/\\/g, '/').replace(/\/$/, '');
  const pathParts = normalizedPath.split('/');
  const lastPart = pathParts[pathParts.length - 1];

  // Create more realistic mock data based on common project structures
  const mockFiles = [];

  // Root directory - show project files
  if (normalizedPath === '' || normalizedPath === '/' || normalizedPath.includes('landing') || pathParts.length <= 2) {
    console.log('Detected root/project directory, returning main project files for path:', normalizedPath);
    mockFiles.push(
      { name: "README.md", path: `${normalizedPath}/README.md`, children: undefined },
      { name: "package.json", path: `${normalizedPath}/package.json`, children: undefined },
      { name: ".gitignore", path: `${normalizedPath}/.gitignore`, children: undefined },
      { name: "src", path: `${normalizedPath}/src`, children: [] },
      { name: "public", path: `${normalizedPath}/public`, children: [] },
      { name: "components", path: `${normalizedPath}/components`, children: [] },
      { name: "utils", path: `${normalizedPath}/utils`, children: [] },
      { name: "assets", path: `${normalizedPath}/assets`, children: [] },
      { name: "styles", path: `${normalizedPath}/styles`, children: [] }
    );
  } else if (lastPart === 'src') {
    console.log('Detected src directory, returning source files');
    mockFiles.push(
      { name: "App.tsx", path: `${normalizedPath}/App.tsx`, children: undefined },
      { name: "main.tsx", path: `${normalizedPath}/main.tsx`, children: undefined },
      { name: "index.css", path: `${normalizedPath}/index.css`, children: undefined },
      { name: "App.css", path: `${normalizedPath}/App.css`, children: undefined },
      { name: "components", path: `${normalizedPath}/components`, children: [] },
      { name: "utils", path: `${normalizedPath}/utils`, children: [] },
      { name: "types", path: `${normalizedPath}/types`, children: [] }
    );
  } else if (lastPart === 'components') {
    console.log('Detected components directory, returning component files');
    mockFiles.push(
      { name: "Header.tsx", path: `${normalizedPath}/Header.tsx`, children: undefined },
      { name: "Footer.tsx", path: `${normalizedPath}/Footer.tsx`, children: undefined },
      { name: "Button.tsx", path: `${normalizedPath}/Button.tsx`, children: undefined },
      { name: "Modal.tsx", path: `${normalizedPath}/Modal.tsx`, children: undefined },
      { name: "Card.tsx", path: `${normalizedPath}/Card.tsx`, children: undefined },
      { name: "Form.tsx", path: `${normalizedPath}/Form.tsx`, children: undefined }
    );
  } else if (lastPart === 'public') {
    console.log('Detected public directory, returning public files');
    mockFiles.push(
      { name: "index.html", path: `${normalizedPath}/index.html`, children: undefined },
      { name: "favicon.ico", path: `${normalizedPath}/favicon.ico`, children: undefined },
      { name: "robots.txt", path: `${normalizedPath}/robots.txt`, children: undefined },
      { name: "assets", path: `${normalizedPath}/assets`, children: [] },
      { name: "images", path: `${normalizedPath}/images`, children: [] }
    );
  } else {
    console.log('Generic directory detected, returning generic files');
    // Generic subdirectory content
    mockFiles.push(
      { name: "index.js", path: `${normalizedPath}/index.js`, children: undefined },
      { name: "index.ts", path: `${normalizedPath}/index.ts`, children: undefined },
      { name: "styles.css", path: `${normalizedPath}/styles.css`, children: undefined },
      { name: "config.json", path: `${normalizedPath}/config.json`, children: undefined },
      { name: "utils.js", path: `${normalizedPath}/utils.js`, children: undefined }
    );
  }

  // Fallback: if no files matched, return basic project structure
  if (mockFiles.length === 0) {
    console.log('No files matched path pattern, using fallback for path:', path);
    mockFiles.push(
      { name: "README.md", path: `${normalizedPath}/README.md`, children: undefined },
      { name: "package.json", path: `${normalizedPath}/package.json`, children: undefined },
      { name: "src", path: `${normalizedPath}/src`, children: [] },
      { name: "public", path: `${normalizedPath}/public`, children: [] }
    );
  }

  console.log('Mock file tree for path:', path, '->', mockFiles.length, 'files');
  return mockFiles;
};

const mockReadTextFile = async (path: string) => {
  console.warn("Tauri fs API not available in development mode - returning mock content for:", path);

  // Return mock content based on file path and type
  if (path.endsWith('README.md')) {
    return `# Project Title

This is a mock project for development mode.

## Features

- File tree navigation
- Code editing
- Git integration
- Terminal support

## Getting Started

1. Open a project folder
2. Navigate through files
3. Edit code
4. Use Git features

## Development

This is running in development mode with mock file system operations.`;
  } else if (path.endsWith('package.json')) {
    return `{
  "name": "mock-project",
  "version": "1.0.0",
  "description": "Mock project for development",
  "main": "src/main.tsx",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "typescript": "^5.0.0",
    "vite": "^4.0.0"
  }
}`;
  } else if (path.endsWith('.gitignore')) {
    return `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
dist/
build/

# Environment variables
.env
.env.local

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db`;
  } else if (path.endsWith('App.tsx')) {
    return `import React from 'react';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Hello from Mock Project!</h1>
        <p>This is a mock React component for development mode.</p>
      </header>
    </div>
  );
}

export default App;`;
  } else if (path.endsWith('index.html')) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mock Project</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`;
  } else if (path.endsWith('.json')) {
    return `{
  "setting": "value",
  "config": {
    "debug": true,
    "version": "1.0.0"
  }
}`;
  } else if (path.endsWith('.js') || path.endsWith('.ts')) {
    return `// Mock JavaScript/TypeScript file
console.log('Hello from mock file!');

// This is development mode content
function mockFunction() {
  return 'This is a mock function';
}

export default mockFunction;`;
  } else if (path.endsWith('.css')) {
    return `/* Mock CSS file */
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

.App {
  text-align: center;
}

.App-header {
  background-color: #282c34;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
}`;
  }

  return `// Mock file content for: ${path}
// This file is simulated for development mode
// In production, this would contain the actual file content`;
};

const mockWriteTextFile = async (path: string, content: string) => {
  console.warn("Tauri fs API not available in development mode - mock write operation");
  console.log(`Would write to ${path}:`, content.substring(0, 100) + (content.length > 100 ? '...' : ''));
};

const mockInvoke = async (cmd: string, args?: any) => {
  console.warn("Tauri invoke API not available in development mode");
  return null;
};

// Export the appropriate implementations
export const open = isTauri ? openDialog : mockOpen;

// Use Tauri V2 plugin for reading directories
export const readDir = async (path: string) => {
  if (isTauri) {
    try {
      const entries = await fsReadDir(path);
      console.log('Tauri FS returned:', entries);
      // Transform Tauri FS Entry structure to match frontend expectations
      return entries.map((entry: any) => ({
        name: entry.name,
        path: entry.path,
        children: entry.isDirectory ? [] : undefined, // Empty array for directories, undefined for files
      }));
    } catch (error) {
      console.error('Error in readDir:', error);
      throw error;
    }
  }
  return mockReadDir(path);
};

export const readTextFile = async (path: string) => {
  if (isTauri) {
    return await fsReadTextFile(path);
  }
  return mockReadTextFile(path);
};

export const writeTextFile = async (path: string, content: string) => {
  if (isTauri) {
    return await fsWriteTextFile(path, content);
  }
  return mockWriteTextFile(path, content);
};

export { invoke };

// Git Commands
export const getGitStatus = async (projectPath: string) => {
  if (isTauri) {
    return await invoke('get_git_status', { projectPath });
  }
  return { branch: '', modified: [], untracked: [], staged: [], isGitRepo: false };
};

export const stageFile = async (projectPath: string, filePath: string) => {
  if (isTauri) {
    return await invoke('stage_file', { projectPath, filePath });
  }
};

export const unstageFile = async (projectPath: string, filePath: string) => {
  if (isTauri) {
    return await invoke('unstage_file', { projectPath, filePath });
  }
};

export const commitChanges = async (projectPath: string, message: string) => {
  if (isTauri) {
    return await invoke('commit_changes', { projectPath, message });
  }
  return 'mock-commit-hash';
};

export const getRecentCommits = async (projectPath: string, limit = 10) => {
  if (isTauri) {
    return await invoke('get_recent_commits', { projectPath, limit });
  }
  return [];
};

export const initGitRepo = async (projectPath: string) => {
  if (isTauri) {
    return await invoke('init_git_repo', { projectPath });
  }
};

// File System Commands
export const listDirectory = async (path: string) => {
  if (isTauri) {
    try {
      const entries = await fsReadDir(path);
      return entries.map((entry: any) => ({
        name: entry.name,
        path: entry.path,
        is_directory: entry.isDirectory,
      }));
    } catch (error) {
      console.error('Error in listDirectory:', error);
      throw error;
    }
  }
  return [];
};

export const createNewFile = async (filePath: string, content = '') => {
  if (isTauri) {
    return await fsWriteTextFile(filePath, content);
  }
};

export const createNewDirectory = async (dirPath: string) => {
  if (isTauri) {
    return await mkdir(dirPath);
  }
};

export const renamePath = async (from: string, to: string) => {
  if (isTauri) {
    return await rename(from, to);
  }
};

export const deletePath = async (path: string) => {
  if (isTauri) {
    return await remove(path, { recursive: true });
  }
};

export const movePath = async (from: string, to: string) => {
  if (isTauri) {
    return await rename(from, to);
  }
};

export const readFileContent = async (filePath: string) => {
  if (isTauri) {
    return await fsReadTextFile(filePath);
  }
  return '';
};

export const writeFileContent = async (filePath: string, content: string) => {
  if (isTauri) {
    return await fsWriteTextFile(filePath, content);
  }
};
