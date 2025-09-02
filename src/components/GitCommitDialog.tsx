import React, { useState, useEffect } from 'react';
import { commitChanges, getRecentCommits } from '../tauri-api';

interface GitStatus {
  branch: string;
  modified: string[];
  untracked: string[];
  staged: string[];
  isGitRepo: boolean;
}

interface GitCommit {
  hash: string;
  message: string;
  author: string;
  timestamp: i64;
}

interface GitCommitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  gitStatus: GitStatus;
  onCommitComplete: () => void;
}

const GitCommitDialog: React.FC<GitCommitDialogProps> = ({
  isOpen,
  onClose,
  projectPath,
  gitStatus,
  onCommitComplete
}) => {
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [recentCommits, setRecentCommits] = useState<GitCommit[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadRecentCommits();
    }
  }, [isOpen]);

  const loadRecentCommits = async () => {
    try {
      const commits = await getRecentCommits(projectPath, 5);
      setRecentCommits(commits);
    } catch (error) {
      console.error('Failed to load recent commits:', error);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      alert('Please enter a commit message');
      return;
    }

    if (gitStatus.staged.length === 0) {
      alert('No staged files to commit');
      return;
    }

    setIsCommitting(true);
    try {
      await commitChanges(projectPath, commitMessage.trim());
      setCommitMessage('');
      onCommitComplete();
      onClose();
    } catch (error) {
      console.error('Failed to commit:', error);
      alert('Failed to commit changes');
    } finally {
      setIsCommitting(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10003]">
      <div className="card-modern shadow-modern-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">Commit Changes</h2>
          <button
            onClick={onClose}
            className="btn-modern btn-ghost p-2"
            disabled={isCommitting}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Staged Files */}
          <div>
            <h3 className="font-medium mb-3">Staged Files ({gitStatus.staged.length})</h3>
            <div className="bg-muted/30 rounded p-3 max-h-32 overflow-y-auto">
              {gitStatus.staged.length === 0 ? (
                <p className="text-muted-foreground">No files staged for commit</p>
              ) : (
                <ul className="space-y-1">
                  {gitStatus.staged.map((file, index) => (
                    <li key={index} className="text-sm flex items-center">
                      <span className="text-green-600 mr-2">✅</span>
                      <span className="font-mono">{file}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Commit Message */}
          <div>
            <label className="block font-medium mb-2">Commit Message</label>
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Enter commit message..."
              className="input-modern w-full h-24 resize-none"
              disabled={isCommitting}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {commitMessage.length}/72 characters (keep under 50 for best practices)
            </p>
          </div>

          {/* Recent Commits */}
          {recentCommits.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">Recent Commits</h3>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {recentCommits.map((commit, index) => (
                  <div key={index} className="bg-muted/20 rounded p-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-sm">{commit.message}</span>
                      <span className="text-xs text-muted-foreground">
                        {commit.hash.substring(0, 7)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {commit.author} • {formatTimestamp(commit.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-border bg-muted/20">
          <button
            onClick={onClose}
            className="btn-modern btn-secondary"
            disabled={isCommitting}
          >
            Cancel
          </button>
          <button
            onClick={handleCommit}
            className="btn-modern btn-primary"
            disabled={isCommitting || !commitMessage.trim() || gitStatus.staged.length === 0}
          >
            {isCommitting ? 'Committing...' : `Commit ${gitStatus.staged.length} file${gitStatus.staged.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GitCommitDialog;

