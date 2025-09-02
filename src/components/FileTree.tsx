import React, { useState, useEffect } from 'react';
import {
  createNewFile as createNewFileAPI,
  createNewDirectory,
  deletePath,
  renamePath,
  getGitStatus,
  stageFile,
  unstageFile,
  initGitRepo
} from '../tauri-api';

// Extend window interface for Tauri properties
declare global {
  interface Window {
    __TAURI_INTERNALS__?: any;
    __TAURI__?: any;
    tauri?: any;
  }
}

// Check if we're likely using mock data
const isMockDataMode = () => {
  return typeof window !== "undefined" && (
    typeof window.__TAURI_INTERNALS__ === "undefined" &&
    typeof window.__TAURI__ === "undefined" &&
    !('tauri' in window)
  );
};

interface TabProps {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const Tab: React.FC<TabProps> = ({ isActive, onClick, children }) => (
  <button
    onClick={onClick}
    className={`tab-button ${isActive ? 'active' : 'inactive'}`}
  >
    {children}
  </button>
);

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileItem[];
}

interface GitStatus {
  branch: string;
  modified: string[];
  untracked: string[];
  staged: string[];
  isGitRepo: boolean;
}

interface FileTreeProps {
  fileTree: FileItem[];
  onFileClick: (path: string) => void;
  currentProject: string;
  onRefresh: () => void;
  onOpenCommitDialog?: () => void;
  onLoadSubdirectory?: (dirPath: string) => Promise<FileItem[]>;
}

interface FileTreeItemProps {
  item: FileItem;
  level: number;
  onFileClick: (path: string) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  currentProject: string;
  gitStatus?: GitStatus;
  onStageFile?: (filePath: string) => void;
  onUnstageFile?: (filePath: string) => void;
  onRenameFile?: (oldPath: string, newName: string) => void;
  onDeleteFile?: (filePath: string) => void;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({
  item,
  level,
  onFileClick,
  expandedFolders,
  onToggleFolder,
  currentProject,
  gitStatus,
  onStageFile,
  onUnstageFile,
  onRenameFile,
  onDeleteFile
}) => {
  const isExpanded = expandedFolders.has(item.path);
  const paddingLeft = level * 16 + 8;

  const handleClick = () => {
    console.log('🖱️ FileTreeItem clicked:', item.name, 'isDirectory:', item.isDirectory, 'path:', item.path);
    if (item.isDirectory) {
      console.log('📁 Toggling folder:', item.path);
      onToggleFolder(item.path);
    } else {
      console.log('📄 Attempting to open file:', item.path);
      onFileClick(item.path);
    }
  };

  const getGitStatus = () => {
    if (!gitStatus?.isGitRepo || item.isDirectory) return null;

    const relativePath = item.path.replace(currentProject + '/', '').replace(currentProject + '\\', '');

    if (gitStatus.staged.includes(relativePath)) return 'staged';
    if (gitStatus.modified.includes(relativePath)) return 'modified';
    if (gitStatus.untracked.includes(relativePath)) return 'untracked';

    return null;
  };

  const gitStatusType = getGitStatus();

  const getFileIcon = (name: string, isDirectory: boolean) => {
    if (isDirectory) {
      return isExpanded ? '📂' : '📁';
    }

    const ext = name.split('.').pop()?.toLowerCase();

    // Add Git status overlay only if gitStatus is available
    let baseIcon = '📄';
    switch (ext) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        baseIcon = '🟨';
        break;
      case 'py':
        baseIcon = '🐍';
        break;
      case 'rs':
        baseIcon = '🦀';
        break;
      case 'json':
        baseIcon = '📄';
        break;
      case 'md':
        baseIcon = '📝';
        break;
      case 'css':
      case 'scss':
        baseIcon = '🎨';
        break;
      case 'html':
        baseIcon = '🌐';
        break;
    }

    // Add Git status indicator only if gitStatus is available
    if (gitStatus && gitStatusType === 'modified') return baseIcon + ' 🔄';
    if (gitStatus && gitStatusType === 'staged') return baseIcon + ' ✅';
    if (gitStatus && gitStatusType === 'untracked') return baseIcon + ' ➕';

    return baseIcon;
  };

  const handleRename = () => {
    const newName = prompt('Enter new name:', item.name);
    if (newName && newName !== item.name) {
      onRenameFile?.(item.path, newName);
    }
  };

  const handleDelete = () => {
    onDeleteFile?.(item.path);
  };

  const handleStage = () => {
    const relativePath = item.path.replace(currentProject + '/', '').replace(currentProject + '\\', '');
    onStageFile?.(relativePath);
  };

  const handleUnstage = () => {
    const relativePath = item.path.replace(currentProject + '/', '').replace(currentProject + '\\', '');
    onUnstageFile?.(relativePath);
  };

  return (
    <div>
      <div
        className="group relative file-tree-item"
        style={{ paddingLeft }}
        onClick={handleClick}
      >
        <span className="mr-2">{getFileIcon(item.name, item.isDirectory)}</span>
        <span className={`truncate ${item.isDirectory ? 'folder' : ''}`}>
          {item.name}
        </span>
        {item.isDirectory && (
          <span className="ml-auto text-xs text-muted-foreground">
            {isExpanded ? '▼' : '▶'}
          </span>
        )}

        {/* File operation buttons */}
        <div className="absolute right-1 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 flex space-x-1">
          {gitStatus && gitStatusType === 'modified' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStage();
              }}
              className="p-1 rounded hover:bg-green-500/20 hover:text-green-600 text-xs"
              title="Stage file"
            >
              +
            </button>
          )}
          {gitStatus && gitStatusType === 'staged' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUnstage();
              }}
              className="p-1 rounded hover:bg-orange-500/20 hover:text-orange-600 text-xs"
              title="Unstage file"
            >
              -
            </button>
          )}
          {onRenameFile && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRename();
              }}
              className="p-1 rounded hover:bg-blue-500/20 hover:text-blue-600 text-xs"
              title="Rename"
            >
              ✏️
            </button>
          )}
          {onDeleteFile && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="p-1 rounded hover:bg-red-500/20 hover:text-red-600 text-xs"
              title="Delete"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {item.isDirectory && isExpanded && item.children && (
        <div>
          {item.children.map((child) => (
            <FileTreeItem
              key={child.path}
              item={child}
              level={level + 1}
              onFileClick={onFileClick}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              currentProject={currentProject}
              gitStatus={gitStatus}
              onStageFile={onStageFile}
              onUnstageFile={onUnstageFile}
              onRenameFile={onRenameFile}
              onDeleteFile={onDeleteFile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FileTree: React.FC<FileTreeProps> = ({
  fileTree,
  onFileClick,
  currentProject,
  onRefresh,
  onOpenCommitDialog
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'git'>('files');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);

  // Debug logging
  console.log('FileTree rendering:', { currentProject, fileTree: fileTree.length, activeTab });

  // Load Git status when project changes
  useEffect(() => {
    if (currentProject) {
      loadGitStatus();
    }
  }, [currentProject]);

  const loadGitStatus = async () => {
    try {
      const status = await getGitStatus(currentProject) as GitStatus;
      setGitStatus(status);
    } catch (error) {
      console.error('Failed to load Git status:', error);
    }
  };

  const handleStageFile = async (filePath: string) => {
    try {
      await stageFile(currentProject, filePath);
      await loadGitStatus(); // Refresh status
      onRefresh();
    } catch (error) {
      console.error('Failed to stage file:', error);
    }
  };

  const handleUnstageFile = async (filePath: string) => {
    try {
      await unstageFile(currentProject, filePath);
      await loadGitStatus(); // Refresh status
      onRefresh();
    } catch (error) {
      console.error('Failed to unstage file:', error);
    }
  };

  const renameFile = async (oldPath: string, newName: string) => {
    const newPath = oldPath.replace(/[^/\\]+$/, newName);
    try {
      await renamePath(oldPath, newPath);
      onRefresh();
      await loadGitStatus();
    } catch (error) {
      console.error('Failed to rename file:', error);
      alert('Failed to rename file');
    }
  };

  const deleteFile = async (filePath: string) => {
    if (!confirm(`Are you sure you want to delete "${filePath.split(/[/\\]/).pop()}"?`)) {
      return;
    }

    try {
      await deletePath(filePath);
      onRefresh();
      await loadGitStatus();
    } catch (error) {
      console.error('Failed to delete file:', error);
      alert('Failed to delete file');
    }
  };

  const createNewFile = async () => {
    if (!currentProject) return;

    const fileName = prompt('Enter file name:');
    if (!fileName) return;

    try {
      const filePath = `${currentProject}/${fileName}`;
      await createNewFileAPI(filePath, '');
      onRefresh();
      await loadGitStatus(); // Refresh Git status after creating file
    } catch (error) {
      console.error('Failed to create file:', error);
      alert('Failed to create file');
    }
  };

  const createNewFolder = async () => {
    if (!currentProject) return;

    const folderName = prompt('Enter folder name:');
    if (!folderName) return;

    try {
      const folderPath = `${currentProject}/${folderName}`;
      await createNewDirectory(folderPath);
      onRefresh();
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('Failed to create folder');
    }
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  if (!currentProject) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>No project opened</p>
        <p className="text-sm mt-2">Use Ctrl+O to open a project</p>
      </div>
    );
  }

  // Files Tab Component
  const FilesTab = () => (
    <div className="h-full overflow-auto">
      <div className="p-2 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">FILES</h3>
          <div className="flex space-x-1">
            <button
              onClick={createNewFile}
              className="p-1 rounded hover:bg-accent hover:text-accent-foreground text-xs"
              title="New File"
              disabled={!currentProject}
            >
              📄
            </button>
            <button
              onClick={createNewFolder}
              className="p-1 rounded hover:bg-accent hover:text-accent-foreground text-xs"
              title="New Folder"
              disabled={!currentProject}
            >
              📁
            </button>
          </div>
        </div>
      </div>

      <div className="py-2">
        {!currentProject ? (
          <div className="text-center text-muted-foreground py-8">
            <div className="text-3xl mb-4">📁</div>
            <p className="text-sm">No project opened</p>
            <p className="text-xs mt-2">Use Ctrl+O to open a project</p>
          </div>
        ) : fileTree.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <div className="text-2xl mb-4">📂</div>
            <p className="text-sm">Project folder is empty</p>
            <p className="text-xs mt-2">Add files to get started</p>
          </div>
        ) : (
          fileTree.map((item) => (
            <FileTreeItem
              key={item.path}
              item={item}
              level={0}
              onFileClick={onFileClick}
              expandedFolders={expandedFolders}
              onToggleFolder={toggleFolder}
              currentProject={currentProject}
              gitStatus={undefined} // No Git status in files tab
              onStageFile={undefined}
              onUnstageFile={undefined}
              onRenameFile={renameFile}
              onDeleteFile={deleteFile}
            />
          ))
        )}
      </div>
    </div>
  );

  // Git Tab Component
  const GitTab = () => (
    <div className="h-full overflow-auto">
      <div className="p-2 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">GIT</h3>
          {gitStatus?.isGitRepo && (
            <span className="text-xs bg-accent/50 px-2 py-1 rounded">
              {gitStatus.branch}
            </span>
          )}
        </div>
      </div>

      {!currentProject ? (
        <div className="text-center text-muted-foreground py-8">
          <div className="text-3xl mb-4">🔀</div>
          <p className="text-sm">No project opened</p>
          <p className="text-xs mt-2">Open a project to see Git status</p>
        </div>
      ) : gitStatus?.isGitRepo ? (
        <>
          {/* Git Status Summary */}
          <div className="p-2 border-b border-border">
            <div className="space-y-1">
              {gitStatus.staged.length > 0 && (
                <div className="text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-green-600">Staged ({gitStatus.staged.length})</span>
                    <button
                      onClick={() => onOpenCommitDialog?.()}
                      className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Commit
                    </button>
                  </div>
                </div>
              )}

              {gitStatus.modified.length > 0 && (
                <div className="text-xs">
                  <span className="text-orange-600">Modified ({gitStatus.modified.length})</span>
                </div>
              )}

              {gitStatus.untracked.length > 0 && (
                <div className="text-xs">
                  <span className="text-blue-600">Untracked ({gitStatus.untracked.length})</span>
                </div>
              )}

              {gitStatus.staged.length === 0 && gitStatus.modified.length === 0 && gitStatus.untracked.length === 0 && (
                <div className="text-xs text-muted-foreground">
                  Working tree clean
                </div>
              )}
            </div>
          </div>

          {/* Git File Tree */}
          <div className="py-2">
            {fileTree.map((item) => (
              <FileTreeItem
                key={item.path}
                item={item}
                level={0}
                onFileClick={onFileClick}
                expandedFolders={expandedFolders}
                onToggleFolder={toggleFolder}
                currentProject={currentProject}
                gitStatus={gitStatus}
                onStageFile={handleStageFile}
                onUnstageFile={handleUnstageFile}
                onRenameFile={undefined} // No rename in Git tab
                onDeleteFile={undefined} // No delete in Git tab
              />
            ))}
          </div>
        </>
      ) : (
        <div className="text-center text-muted-foreground py-8">
          <div className="text-2xl mb-4">📁</div>
          <p className="text-sm">Not a Git repository</p>
          <p className="text-xs mt-1">Initialize Git to see status</p>
          <button
            onClick={async () => {
              if (currentProject) {
                try {
                  await initGitRepo(currentProject);
                  // Refresh Git status after initialization
                  await loadGitStatus();
                } catch (error) {
                  console.error('Failed to initialize Git repository:', error);
                  alert('Failed to initialize Git repository');
                }
              }
            }}
            className="mt-3 px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Initialize Git Repository
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Mock data warning */}
      {isMockDataMode() && (
        <div className="px-2 py-1 text-xs text-orange-600 border-b border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800">
          ⚠️ Using mock data - Run with "npm run tauri:dev" for real files
        </div>
      )}
      
      {/* Development mode info */}
      {process.env.NODE_ENV === 'development' && !isMockDataMode() && (
        <div className="px-2 py-1 text-xs text-green-600 border-b border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
          ✅ Using real file system - Files: {fileTree.length}
        </div>
      )}

      {/* Tab Navigation - Always visible */}
      <div className="tab-navigation">
        <Tab isActive={activeTab === 'files'} onClick={() => setActiveTab('files')}>
          📁 Files
        </Tab>
        <Tab isActive={activeTab === 'git'} onClick={() => setActiveTab('git')}>
          🔀 Git
        </Tab>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'files' ? <FilesTab /> : <GitTab />}
      </div>
    </div>
  );
};

export default FileTree;
