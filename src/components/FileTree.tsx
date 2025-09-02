import React, { useState, useEffect } from 'react';
import {
  createNewFile as createNewFileAPI,
  createNewDirectory,
  deletePath,
  renamePath,
  getGitStatus,
  initGitRepoEnhanced,
  getGitConfig,
  isGitRepository
} from '../tauri-api';
import GitChanges from './GitChanges';
import GitHistory from './GitHistory';
import GitConfigDialog from './GitConfigDialog';

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

// Tab component removed - no longer needed in new layout

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
  onLoadSubdirectory?: (dirPath: string) => Promise<FileItem[]>;
  gitStatus?: GitStatus;
  showGitPanel?: boolean;
  onGitPanelToggle?: (show: boolean) => void;
  onOpenCommitDialog?: () => void;
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
  loadedDirectories?: Map<string, FileItem[]>;
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
  onDeleteFile,
  loadedDirectories
}) => {
  const isExpanded = expandedFolders.has(item.path);
  const paddingLeft = level * 16 + 8;
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean } | null>(null);

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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      visible: true
    });
  };

  const handleContextMenuAction = (action: 'rename' | 'delete') => {
    if (action === 'rename' && onRenameFile) {
      handleRename();
    } else if (action === 'delete' && onDeleteFile) {
      handleDelete();
    }
    setContextMenu(null);
  };

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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
        onContextMenu={handleContextMenu}
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

        {/* Git status indicators (only for Git tab) */}
        {gitStatus && (
          <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex space-x-1">
            {gitStatusType === 'modified' && (
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
            {gitStatusType === 'staged' && (
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
          </div>
        )}
      </div>

      {item.isDirectory && isExpanded && loadedDirectories && loadedDirectories.has(item.path) && (
        <div>
          {loadedDirectories.get(item.path)!.map((child) => (
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
              loadedDirectories={loadedDirectories}
            />
          ))}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu?.visible && (onRenameFile || onDeleteFile) && (
        <div
          className="fixed z-[10002] bg-card border border-border rounded-md shadow-lg py-1 min-w-32"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {onRenameFile && (
            <button
              onClick={() => handleContextMenuAction('rename')}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              ✏️ Rename
            </button>
          )}
          {onDeleteFile && (
            <button
              onClick={() => handleContextMenuAction('delete')}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-destructive"
            >
              🗑️ Delete
            </button>
          )}
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
  onLoadSubdirectory,
  gitStatus: externalGitStatus,
  showGitPanel,
  onGitPanelToggle
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [loadedDirectories, setLoadedDirectories] = useState<Map<string, FileItem[]>>(new Map());
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initialConfig, setInitialConfig] = useState<{ name: string | null; email: string | null }>({ name: null, email: null });
  const [activeTab, setActiveTab] = useState<'files' | 'sourceControl'>('files');
  const [historyRefreshKey, setHistoryRefreshKey] = useState<number>(0);

  // Sync external toggle with local tab state
  useEffect(() => {
    if (showGitPanel) {
      setActiveTab('sourceControl');
    } else {
      setActiveTab('files');
    }
  }, [showGitPanel]);

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
      setGitStatus(null);
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

  const toggleFolder = async (path: string) => {
    const isCurrentlyExpanded = expandedFolders.has(path);

    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (isCurrentlyExpanded) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });

    // If expanding and not already loaded, load the subdirectory contents
    if (!isCurrentlyExpanded && onLoadSubdirectory && !loadedDirectories.has(path)) {
      try {
        console.log('📁 Loading subdirectory contents for:', path);
        const subItems = await onLoadSubdirectory(path);
        console.log('📁 Loaded subdirectory items:', subItems.length);

        setLoadedDirectories(prev => {
          const newMap = new Map(prev);
          newMap.set(path, subItems);
          return newMap;
        });
      } catch (error) {
        console.error('❌ Failed to load subdirectory:', error);
      }
    }
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
              loadedDirectories={loadedDirectories}
            />
          ))
        )}
      </div>
    </div>
  );

  // GitTab removed - now using GitChanges directly in the main layout

  // Prefer local git status (fresh after actions), fall back to external from App
  const currentGitStatus = gitStatus || externalGitStatus;
  const totalChanges = currentGitStatus ? 
    (currentGitStatus.staged?.length || 0) + (currentGitStatus.modified?.length || 0) + (currentGitStatus.untracked?.length || 0) : 0;

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Mock data warning */}
      {isMockDataMode() && (
        <div className="px-2 py-1 text-xs text-orange-600 border-b border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800">
          ⚠️ Using mock data - Run with "npm run tauri:dev" for real files
        </div>
      )}

      {/* Project directory display */}
      {currentProject && (
        <div className="px-2 py-1 text-xs text-muted-foreground border-b border-border bg-muted/30">
          📂 {currentProject}
        </div>
      )}

      {/* Tabs header */}
      <div className="px-2 py-1 border-b border-border bg-muted/30">
        <div className="flex items-center space-x-2">
          <button
            className={`px-2 py-1 text-xs rounded ${activeTab === 'files' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}`}
            onClick={() => { setActiveTab('files'); onGitPanelToggle?.(false); }}
          >
            📁 Files
          </button>
          <button
            className={`px-2 py-1 text-xs rounded ${activeTab === 'sourceControl' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}`}
            onClick={() => { setActiveTab('sourceControl'); onGitPanelToggle?.(true); }}
          >
            🔀 Source Control {totalChanges > 0 ? <span className="ml-1 px-1 bg-orange-500/20 text-orange-600 rounded">{totalChanges}</span> : null}
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'files' && (
          <div className="flex-1 overflow-hidden">
            <FilesTab />
          </div>
        )}

        {activeTab === 'sourceControl' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Not a git repo -> initialize flow */}
            {!currentGitStatus?.isGitRepo ? (
              <div className="px-3 py-2 bg-muted/30 border-b border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">📁 No Git Repository</span>
                  <button
                    onClick={async () => {
                      if (isInitializing) return;
                      setIsInitializing(true);
                      try {
                        console.log('🔧 Starting enhanced Git initialization...');
                        const result = await initGitRepoEnhanced(currentProject);
                        console.log('✅ Git initialization result:', result);
                        if (result.success) {
                          try {
                            const cfg: any = await getGitConfig(currentProject);
                            setInitialConfig({ name: cfg.user_name ?? null, email: cfg.user_email ?? null });
                          } catch (e) {
                            console.warn('Could not prefetch git config:', e);
                            setInitialConfig({ name: null, email: null });
                          }
                          setIsConfigDialogOpen(true);
                          await loadGitStatus();
                          onRefresh();
                        } else {
                          alert(`Failed to initialize Git repository: ${result.message}`);
                        }
                      } catch (error) {
                        console.error('Failed to initialize Git repository:', error);
                        alert(`Failed to initialize Git repository: ${error}`);
                      } finally {
                        setIsInitializing(false);
                      }
                    }}
                    disabled={isInitializing}
                    className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isInitializing ? '⏳ Initializing...' : '🔧 Initialize Git'}
                  </button>
                </div>
              </div>
            ) : (
              // Git repo view: top changes, bottom history
              <>
                <div className="flex-1 overflow-y-auto border-b border-border">
                  <GitChanges
                    currentProject={currentProject}
                    onFileClick={onFileClick}
                    onRefresh={() => { loadGitStatus(); onRefresh(); setHistoryRefreshKey((k) => k + 1); }}
                    compact={false}
                  />
                </div>
                <div className="border-t border-border" style={{ height: 320 }}>
                  <GitHistory currentProject={currentProject} gitBranch={currentGitStatus.branch} compact={false} refreshKey={historyRefreshKey} />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Git Configuration Dialog */}
      <GitConfigDialog
        isOpen={isConfigDialogOpen}
        onClose={() => setIsConfigDialogOpen(false)}
        projectPath={currentProject}
        onConfigComplete={async () => { await loadGitStatus(); onRefresh(); }}
        initialName={initialConfig.name}
        initialEmail={initialConfig.email}
      />
    </div>
  );
};

export default FileTree;
