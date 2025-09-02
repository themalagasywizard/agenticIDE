import React, { useState, useEffect } from 'react';
import { 
  getGitStatus, 
  stageFile, 
  unstageFile, 
  commitChanges,
  initGitRepo,
  gitPush,
  gitPull
} from '../tauri-api';

interface GitStatus {
  branch: string;
  modified: string[];
  untracked: string[];
  staged: string[];
  isGitRepo: boolean;
}

interface GitChangesProps {
  currentProject: string;
  onFileClick: (path: string) => void;
  onRefresh: () => void;
  compact?: boolean;
}

const GitChanges: React.FC<GitChangesProps> = ({ 
  currentProject, 
  onFileClick, 
  onRefresh,
  compact = false
}) => {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // Load Git status when project changes
  useEffect(() => {
    if (currentProject) {
      loadGitStatus();
    }
  }, [currentProject]);

  const loadGitStatus = async () => {
    if (!currentProject) return;
    
    try {
      const status = await getGitStatus(currentProject);
      setGitStatus(status);
    } catch (error) {
      console.error('Failed to load Git status:', error);
      setGitStatus(null);
    }
  };

  const handleStageFile = async (filePath: string) => {
    try {
      await stageFile(currentProject, filePath);
      await loadGitStatus();
      onRefresh();
    } catch (error) {
      console.error('Failed to stage file:', error);
    }
  };

  const handleUnstageFile = async (filePath: string) => {
    try {
      await unstageFile(currentProject, filePath);
      await loadGitStatus();
      onRefresh();
    } catch (error) {
      console.error('Failed to unstage file:', error);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      alert('Please enter a commit message');
      return;
    }

    setIsCommitting(true);
    try {
      await commitChanges(currentProject, commitMessage.trim());
      setCommitMessage('');
      await loadGitStatus();
      onRefresh();
    } catch (error) {
      console.error('Failed to commit changes:', error);
      alert('Failed to commit changes');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleInitGit = async () => {
    setIsInitializing(true);
    try {
      await initGitRepo(currentProject);
      
      // Force refresh git status multiple times to ensure UI updates
      await loadGitStatus();
      
      // Wait a bit and refresh again to ensure UI is updated
      setTimeout(async () => {
        await loadGitStatus();
        onRefresh();
      }, 100);
      
      onRefresh();
    } catch (error) {
      console.error('Failed to initialize Git repository:', error);
      alert(`Failed to initialize Git repository: ${error}`);
    } finally {
      setIsInitializing(false);
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return '🟨';
      case 'py':
        return '🐍';
      case 'rs':
        return '🦀';
      case 'json':
        return '📄';
      case 'md':
        return '📝';
      case 'css':
      case 'scss':
        return '🎨';
      case 'html':
        return '🌐';
      default:
        return '📄';
    }
  };

  if (!currentProject) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p className="text-sm">No project opened</p>
      </div>
    );
  }

  if (!gitStatus?.isGitRepo) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <div className="text-2xl mb-4">📁</div>
        <p className="text-sm mb-3">Not a Git repository</p>
        <button
          onClick={handleInitGit}
          disabled={isInitializing}
          className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
        >
          {isInitializing ? 'Initializing...' : 'Initialize Repository'}
        </button>
      </div>
    );
  }

  const totalChanges = gitStatus.staged.length + gitStatus.modified.length + gitStatus.untracked.length;

  return (
    <div className={compact ? "flex flex-col" : "h-full flex flex-col"}>
      {/* Header - only in non-compact mode */}
      {!compact && (
        <div className="px-3 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Source Control</h3>
            <div className="flex items-center space-x-2">
              <span className="text-xs bg-accent/50 px-2 py-1 rounded">
                {gitStatus.branch}
              </span>
              {totalChanges > 0 && (
                <span className="text-xs bg-orange-500/20 text-orange-600 px-2 py-1 rounded">
                  {totalChanges}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Commit Message Input - simplified in compact mode */}
      {gitStatus.staged.length > 0 && (
        <div className={compact ? "p-2 border-b border-border" : "p-3 border-b border-border"}>
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder={compact ? "Commit message..." : "Message (Ctrl+Enter to commit)"}
            className="w-full p-2 text-sm bg-background border border-border rounded resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            rows={compact ? 2 : 3}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                handleCommit();
              }
            }}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              {gitStatus.staged.length} staged change{gitStatus.staged.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleCommit}
              disabled={isCommitting || !commitMessage.trim()}
              className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
            >
              {isCommitting ? 'Committing...' : 'Commit'}
            </button>
          </div>
        </div>
      )}

      {/* Changes List */}
      <div className="flex-1 overflow-y-auto">
        {/* Staged Changes */}
        {gitStatus.staged.length > 0 && (
          <div className="border-b border-border">
            <div className="px-3 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
              <h4 className="text-xs font-medium text-green-700 dark:text-green-300">
                STAGED CHANGES ({gitStatus.staged.length})
              </h4>
            </div>
            {gitStatus.staged.map((file) => (
              <div
                key={file}
                className="flex items-center px-3 py-2 hover:bg-accent/50 cursor-pointer group"
                onClick={() => {
                  const fullPath = file.startsWith(currentProject) ? file : `${currentProject}/${file}`;
                  onFileClick(fullPath);
                }}
              >
                <span className="mr-2">{getFileIcon(file)}</span>
                <span className="flex-1 text-sm truncate">{file}</span>
                <span className="text-xs text-green-600 mr-2">S</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUnstageFile(file);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-orange-500/20 hover:text-orange-600 text-xs"
                  title="Unstage"
                >
                  -
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Modified Changes */}
        {gitStatus.modified.length > 0 && (
          <div className="border-b border-border">
            <div className="px-3 py-2 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
              <h4 className="text-xs font-medium text-orange-700 dark:text-orange-300">
                CHANGES ({gitStatus.modified.length})
              </h4>
            </div>
            {gitStatus.modified.map((file) => (
              <div
                key={file}
                className="flex items-center px-3 py-2 hover:bg-accent/50 cursor-pointer group"
                onClick={() => {
                  const fullPath = file.startsWith(currentProject) ? file : `${currentProject}/${file}`;
                  onFileClick(fullPath);
                }}
              >
                <span className="mr-2">{getFileIcon(file)}</span>
                <span className="flex-1 text-sm truncate">{file}</span>
                <span className="text-xs text-orange-600 mr-2">M</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStageFile(file);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-green-500/20 hover:text-green-600 text-xs"
                  title="Stage"
                >
                  +
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Untracked Changes */}
        {gitStatus.untracked.length > 0 && (
          <div>
            <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
              <h4 className="text-xs font-medium text-blue-700 dark:text-blue-300">
                UNTRACKED FILES ({gitStatus.untracked.length})
              </h4>
            </div>
            {gitStatus.untracked.map((file) => (
              <div
                key={file}
                className="flex items-center px-3 py-2 hover:bg-accent/50 cursor-pointer group"
                onClick={() => {
                  const fullPath = file.startsWith(currentProject) ? file : `${currentProject}/${file}`;
                  onFileClick(fullPath);
                }}
              >
                <span className="mr-2">{getFileIcon(file)}</span>
                <span className="flex-1 text-sm truncate">{file}</span>
                <span className="text-xs text-blue-600 mr-2">U</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStageFile(file);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-green-500/20 hover:text-green-600 text-xs"
                  title="Stage"
                >
                  +
                </button>
              </div>
            ))}
          </div>
        )}

        {/* No Changes */}
        {totalChanges === 0 && (
          <div className="p-4 text-center text-muted-foreground">
            <div className="text-2xl mb-2">✅</div>
            <p className="text-sm">No changes</p>
            <p className="text-xs mt-1">Working tree clean</p>
          </div>
        )}
      </div>

      {/* Quick Actions - only in non-compact mode */}
      {!compact && (
        <div className="p-3 border-t border-border bg-muted/30">
          <div className="flex space-x-2">
            <button
              onClick={loadGitStatus}
              className="flex-1 px-3 py-1 text-xs bg-accent hover:bg-accent/80 rounded"
              title="Refresh (F5)"
            >
              🔄 Refresh
            </button>
            <button
              onClick={async () => {
                try {
                  await gitPull(currentProject);
                  await loadGitStatus();
                  onRefresh();
                } catch (error) {
                  console.error('Pull failed:', error);
                  // Show user-friendly error message
                  const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                  alert(`Pull failed: ${errorMsg}`);
                }
              }}
              className="flex-1 px-3 py-1 text-xs bg-accent hover:bg-accent/80 rounded"
              title="Pull changes"
            >
              ⬇️ Pull
            </button>
            <button
              onClick={async () => {
                try {
                  await gitPush(currentProject);
                  await loadGitStatus();
                  onRefresh();
                } catch (error) {
                  console.error('Push failed:', error);
                  // Show user-friendly error message
                  const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                  alert(`Push failed: ${errorMsg}`);
                }
              }}
              className="flex-1 px-3 py-1 text-xs bg-accent hover:bg-accent/80 rounded"
              title="Push changes"
            >
              ⬆️ Push
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GitChanges;
