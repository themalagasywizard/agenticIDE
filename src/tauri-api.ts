// Tauri API wrapper for Tauri v2
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readDir as fsReadDir, readTextFile as fsReadTextFile, writeTextFile as fsWriteTextFile, mkdir } from '@tauri-apps/plugin-fs';

// Extend window interface for Tauri properties
declare global {
  interface Window {
    __TAURI_INTERNALS__?: any;
    __TAURI__?: any;
    tauri?: any;
  }
}

// Tauri detection - check multiple ways to ensure we detect Tauri properly
const isTauri = (() => {
  if (typeof window === "undefined") {
    console.log('Not in browser environment');
    return false;
  }
  
  const hasTauriInternals = typeof window.__TAURI_INTERNALS__ !== "undefined";
  const hasTauri = typeof window.__TAURI__ !== "undefined";
  const hasTauriProperty = 'tauri' in window;
  
  console.log('Tauri detection check:', {
    hasTauriInternals,
    hasTauri,
    hasTauriProperty,
    windowKeys: Object.keys(window).filter(k => k.toLowerCase().includes('tauri')),
    userAgent: navigator.userAgent
  });
  
  const isTauriDetected = hasTauriInternals || hasTauri || hasTauriProperty;
  
  if (!isTauriDetected) {
    console.warn('Tauri not detected! Make sure you\'re running the app with "npm run tauri:dev" instead of "npm run dev"');
  }
  
  return isTauriDetected;
})();

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

// Mock invoke function removed - using direct Tauri API calls instead

// Export the appropriate implementations
export const open = isTauri ? openDialog : mockOpen;

// Use our custom Tauri command for reading directories
export const readDir = async (path: string) => {
  console.log(`readDir called with path: ${path}, isTauri: ${isTauri}`);
  
  // Try Tauri first, regardless of detection (in case detection is faulty)
  try {
    console.log('Attempting to use Tauri custom list_directory command for path:', path);
    const entries = await invoke('list_directory', { path }) as Array<{
      name: string;
      path: string;
      is_directory: boolean;
      size?: number;
      modified?: number;
    }>;
    console.log('✅ Tauri custom command successfully returned entries:', entries);
    
    // Transform backend structure to match frontend expectations
    const transformedEntries = entries.map((entry) => ({
      name: entry.name,
      path: entry.path,
      children: entry.is_directory ? [] : undefined, // Empty array for directories, undefined for files
    }));
    console.log('Transformed entries:', transformedEntries);
    return transformedEntries;
  } catch (error) {
    console.error('❌ Tauri readDir failed:', error);
    
    if (isTauri) {
      // If we detected Tauri but API failed, throw the error
      throw error;
    }
    
    // Fallback to mock if Tauri is not available
    console.log('🔄 Falling back to mock readDir for path:', path);
    return mockReadDir(path);
  }
};

export const readTextFile = async (path: string) => {
  console.log(`readTextFile called with path: ${path}, isTauri: ${isTauri}`);
  
  // Try Tauri first, regardless of detection (in case detection is faulty)
  try {
    console.log('Attempting to use Tauri custom read_file_content command for path:', path);
    const content = await invoke('read_file_content', { filePath: path }) as string;
    console.log('✅ Tauri custom command successfully returned content, length:', content.length);
    return content as string;
  } catch (error) {
    console.error('❌ Tauri readTextFile failed:', error);
    
    if (isTauri) {
      // If we detected Tauri but API failed, throw the error
      throw error;
    }
    
    // Fallback to mock if Tauri is not available
    console.log('🔄 Falling back to mock readTextFile for path:', path);
    return mockReadTextFile(path);
  }
};

export const writeTextFile = async (path: string, content: string) => {
  console.log(`writeTextFile called with path: ${path}, isTauri: ${isTauri}`);
  
  // Try Tauri first, regardless of detection (in case detection is faulty)
  try {
    console.log('Attempting to use Tauri custom write_file_content command for path:', path);
    await invoke('write_file_content', { filePath: path, content });
    console.log('✅ Tauri custom command successfully wrote file');
  } catch (error) {
    console.error('❌ Tauri writeTextFile failed:', error);
    
    if (isTauri) {
      // If we detected Tauri but API failed, throw the error
      throw error;
    }
    
    // Fallback to mock if Tauri is not available
    console.log('🔄 Falling back to mock writeTextFile for path:', path);
    return mockWriteTextFile(path, content);
  }
};

export { invoke };

// Git Commands
export const getGitStatus = async (projectPath: string) => {
  console.log('📊 Getting Git status for:', projectPath);
  
  if (isTauri) {
    try {
      console.log('📞 Invoking get_git_status command');
      const raw = await invoke('get_git_status', { projectPath }) as any;
      console.log('✅ Git status retrieved (raw):', raw);

      // Normalize snake_case from Rust to camelCase expected by UI
      const normalized = {
        branch: raw?.branch || '',
        modified: raw?.modified || [],
        untracked: raw?.untracked || [],
        staged: raw?.staged || [],
        isGitRepo: Boolean(raw?.is_git_repo ?? raw?.isGitRepo ?? false),
      };
      console.log('🔧 Git status normalized:', normalized);
      return normalized;
    } catch (error) {
      console.error('❌ Failed to get Git status:', error);
      return { branch: '', modified: [], untracked: [], staged: [], isGitRepo: false };
    }
  }
  
  console.log('⚠️ Not in Tauri environment, returning mock Git status');
  return { branch: '', modified: [], untracked: [], staged: [], isGitRepo: false };
};

export const stageFile = async (projectPath: string, filePath: string) => {
  console.log('📋 Staging file:', filePath, 'in project:', projectPath);
  
  if (isTauri) {
    try {
      console.log('📞 Invoking stage_file command');
      const result = await invoke('stage_file', { projectPath, filePath });
      console.log('✅ File staged successfully');
      return result;
    } catch (error) {
      console.error('❌ Failed to stage file:', error);
      throw error;
    }
  } else {
    console.warn('⚠️ Not in Tauri environment, cannot stage file');
    throw new Error('Git staging not available in development mode');
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
  console.log('🔧 Initializing Git repository for:', projectPath);
  
  if (isTauri) {
    try {
      console.log('📞 Invoking init_git_repo command');
      const result = await invoke('init_git_repo', { projectPath });
      console.log('✅ Git repository initialized successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to initialize Git repository:', error);
      throw error;
    }
  } else {
    console.warn('⚠️ Not in Tauri environment, cannot initialize Git repository');
    throw new Error('Git initialization not available in development mode');
  }
};

// Enhanced Git initialization with configuration support
export const initGitRepoEnhanced = async (projectPath: string) => {
  console.log('🔧 Enhanced Git repository initialization for:', projectPath);
  
  if (isTauri) {
    try {
      console.log('📞 Invoking init_git_repo_enhanced command');
      const result = await invoke('init_git_repo_enhanced', { projectPath });
      console.log('✅ Enhanced Git repository initialization result:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to initialize Git repository with enhanced method:', error);
      throw error;
    }
  } else {
    console.warn('⚠️ Not in Tauri environment, cannot initialize Git repository');
    throw new Error('Git initialization not available in development mode');
  }
};

// Get Git configuration
export const getGitConfig = async (projectPath: string) => {
  console.log('📋 Getting Git configuration for:', projectPath);
  
  if (isTauri) {
    try {
      console.log('📞 Invoking get_git_config command');
      const result = await invoke('get_git_config', { projectPath });
      console.log('✅ Git configuration retrieved:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to get Git configuration:', error);
      throw error;
    }
  } else {
    console.warn('⚠️ Not in Tauri environment, returning mock config');
    return { user_name: null, user_email: null, is_configured: false };
  }
};

// Set Git configuration
export const setGitConfig = async (projectPath: string, name: string, email: string) => {
  console.log('⚙️ Setting Git configuration for:', projectPath, { name, email });
  
  if (isTauri) {
    try {
      console.log('📞 Invoking set_git_config command');
      const result = await invoke('set_git_config', { projectPath, name, email });
      console.log('✅ Git configuration set successfully');
      return result;
    } catch (error) {
      console.error('❌ Failed to set Git configuration:', error);
      throw error;
    }
  } else {
    console.warn('⚠️ Not in Tauri environment, cannot set Git configuration');
    throw new Error('Git configuration not available in development mode');
  }
};

// Check if directory is a Git repository
export const isGitRepository = async (projectPath: string) => {
  console.log('🔍 Checking if Git repository exists at:', projectPath);
  
  if (isTauri) {
    try {
      console.log('📞 Invoking is_git_repository command');
      const result = await invoke('is_git_repository', { projectPath });
      console.log('✅ Git repository check result:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to check Git repository:', error);
      return false;
    }
  } else {
    console.warn('⚠️ Not in Tauri environment, returning false');
    return false;
  }
};

// Git Push/Pull operations
export const gitPush = async (projectPath: string, options?: { remoteName?: string; branchName?: string; username?: string; password?: string; }) => {
  const remoteName = options?.remoteName ?? 'origin';
  const branchName = options?.branchName ?? 'main';
  console.log('⬆️ Pushing to remote:', { projectPath, remoteName, branchName, withCredentials: Boolean(options?.password) });
  
  if (isTauri) {
    try {
      console.log('📞 Invoking git_push command');
      const result = await invoke('git_push', { 
        projectPath, 
        remoteName: remoteName === 'origin' ? null : remoteName,
        branchName: branchName === 'main' ? null : branchName,
        username: options?.username ?? null,
        password: options?.password ?? null,
      });
      console.log('✅ Push completed successfully');
      return result;
    } catch (error) {
      console.error('❌ Failed to push:', error);
      throw error;
    }
  } else {
    throw new Error('Git operations not available in development mode');
  }
};

export const saveGitCredentials = async (projectPath: string, username: string, password: string, remoteName = 'origin') => {
  if (!isTauri) throw new Error('Credentials storage not available in development mode');
  return await invoke('save_git_credentials_cmd', { projectPath, remoteName: remoteName === 'origin' ? null : remoteName, username, password });
};

export const clearGitCredentials = async (projectPath: string, username: string, remoteName = 'origin') => {
  if (!isTauri) throw new Error('Credentials storage not available in development mode');
  return await invoke('clear_git_credentials_cmd', { projectPath, remoteName: remoteName === 'origin' ? null : remoteName, username });
};

export const gitPull = async (projectPath: string, remoteName = 'origin', branchName = 'main') => {
  console.log('⬇️ Pulling from remote:', { projectPath, remoteName, branchName });
  
  if (isTauri) {
    try {
      console.log('📞 Invoking git_pull command');
      const result = await invoke('git_pull', { 
        projectPath, 
        remoteName: remoteName === 'origin' ? null : remoteName,
        branchName: branchName === 'main' ? null : branchName 
      });
      console.log('✅ Pull completed successfully');
      return result;
    } catch (error) {
      console.error('❌ Failed to pull:', error);
      throw error;
    }
  } else {
    throw new Error('Git operations not available in development mode');
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
  console.log(`renamePath called with from: ${from}, to: ${to}, isTauri: ${isTauri}`);

  // Try Tauri first, regardless of detection (in case detection is faulty)
  try {
    console.log('Attempting to use Tauri custom rename_path command');
    await invoke('rename_path', { from, to });
    console.log('✅ Tauri custom command successfully renamed file');
  } catch (error) {
    console.error('❌ Tauri renamePath failed:', error);

    if (isTauri) {
      // If we detected Tauri but API failed, throw the error
      throw error;
    }

    // Fallback to mock if Tauri is not available
    console.log('🔄 Falling back to mock renamePath');
    // For mock, we can't actually rename files, so throw an error
    throw new Error('Rename operation not supported in development mode');
  }
};

export const deletePath = async (path: string) => {
  console.log(`deletePath called with path: ${path}, isTauri: ${isTauri}`);

  // Try Tauri first, regardless of detection (in case detection is faulty)
  try {
    console.log('Attempting to use Tauri custom delete_path command');
    await invoke('delete_path', { path });
    console.log('✅ Tauri custom command successfully deleted path');
  } catch (error) {
    console.error('❌ Tauri deletePath failed:', error);

    if (isTauri) {
      // If we detected Tauri but API failed, throw the error
      throw error;
    }

    // Fallback to mock if Tauri is not available
    console.log('🔄 Falling back to mock deletePath');
    // For mock, we can't actually delete files, so throw an error
    throw new Error('Delete operation not supported in development mode');
  }
};

export const movePath = async (from: string, to: string) => {
  console.log(`movePath called with from: ${from}, to: ${to}, isTauri: ${isTauri}`);

  // Try Tauri first, regardless of detection (in case detection is faulty)
  try {
    console.log('Attempting to use Tauri custom move_path command');
    await invoke('move_path', { from, to });
    console.log('✅ Tauri custom command successfully moved path');
  } catch (error) {
    console.error('❌ Tauri movePath failed:', error);

    if (isTauri) {
      // If we detected Tauri but API failed, throw the error
      throw error;
    }

    // Fallback to mock if Tauri is not available
    console.log('🔄 Falling back to mock movePath');
    // For mock, we can't actually move files, so throw an error
    throw new Error('Move operation not supported in development mode');
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

// Git Credentials Functions
export const getGitCredentials = async (projectPath: string) => {
  console.log('🔑 Getting Git credentials for:', projectPath);

  if (isTauri) {
    try {
      console.log('📞 Invoking get_git_credentials command');
      const result = await invoke('get_git_credentials', { projectPath });
      console.log('✅ Git credentials retrieved');
      return result;
    } catch (error) {
      console.error('❌ Failed to get Git credentials:', error);
      return null;
    }
  } else {
    console.warn('⚠️ Not in Tauri environment, returning null');
    return null;
  }
};

export const setGitCredentials = async (projectPath: string, credentials: { username: string; token: string; remoteUrl: string }) => {
  console.log('🔐 Setting Git credentials for:', projectPath);

  if (isTauri) {
    try {
      console.log('📞 Invoking set_git_credentials command');
      const result = await invoke('set_git_credentials', {
        projectPath,
        username: credentials.username,
        token: credentials.token,
        remoteUrl: credentials.remoteUrl
      });
      console.log('✅ Git credentials saved successfully');
      return result;
    } catch (error) {
      console.error('❌ Failed to save Git credentials:', error);
      throw error;
    }
  } else {
    console.warn('⚠️ Not in Tauri environment, cannot save credentials');
    throw new Error('Git credentials not available in development mode');
  }
};

export const deleteGitCredentials = async (projectPath: string) => {
  console.log('🗑️ Deleting Git credentials for:', projectPath);

  if (isTauri) {
    try {
      console.log('📞 Invoking delete_git_credentials command');
      const result = await invoke('delete_git_credentials', { projectPath });
      console.log('✅ Git credentials deleted successfully');
      return result;
    } catch (error) {
      console.error('❌ Failed to delete Git credentials:', error);
      throw error;
    }
  } else {
    console.warn('⚠️ Not in Tauri environment, cannot delete credentials');
    throw new Error('Git credentials not available in development mode');
  }
};
