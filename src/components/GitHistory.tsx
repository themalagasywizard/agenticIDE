import React, { useState, useEffect } from 'react';
import { getRecentCommits } from '../tauri-api';

interface GitCommit {
  hash: string;
  message: string;
  author: string;
  timestamp: number;
}

interface GitHistoryProps {
  currentProject: string;
  gitBranch?: string;
  compact?: boolean;
}

const GitHistory: React.FC<GitHistoryProps> = ({ 
  currentProject, 
  gitBranch, 
  compact = false 
}) => {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentProject) {
      loadCommits();
    }
  }, [currentProject]);

  const loadCommits = async () => {
    if (!currentProject) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const recentCommits = await getRecentCommits(currentProject, 10);
      setCommits(recentCommits || []);
    } catch (err) {
      console.error('Failed to load commits:', err);
      setError('Failed to load commit history');
      setCommits([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const truncateMessage = (message: string, maxLength: number = compact ? 40 : 60) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  };

  if (!currentProject) {
    return null;
  }

  return (
    <div className={compact ? 'flex flex-col' : 'h-full flex flex-col'}>
      {/* Header */}
      {!compact && (
        <div className="px-3 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Commits</h3>
            <div className="flex items-center space-x-2">
              {gitBranch && (
                <span className="text-xs bg-accent/50 px-2 py-1 rounded">
                  {gitBranch}
                </span>
              )}
              <button
                onClick={loadCommits}
                className="text-xs hover:bg-accent/50 px-2 py-1 rounded"
                title="Refresh commits"
              >
                🔄
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Commits List */}
      <div className={compact ? 'overflow-y-auto max-h-32' : 'flex-1 overflow-y-auto'}>
        {loading ? (
          <div className="p-4 text-center text-muted-foreground">
            <div className="text-sm">Loading commits...</div>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-orange-600">
            <div className="text-xs">{error}</div>
            <button 
              onClick={loadCommits}
              className="mt-2 text-xs bg-accent hover:bg-accent/80 px-2 py-1 rounded"
            >
              Retry
            </button>
          </div>
        ) : commits.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <div className="text-2xl mb-2">📝</div>
            <div className="text-sm">No commits yet</div>
            <div className="text-xs mt-1">Make your first commit to see history</div>
          </div>
        ) : (
          commits.map((commit) => (
            <div
              key={commit.hash}
              className="px-3 py-2 hover:bg-accent/30 cursor-pointer border-l-2 border-transparent hover:border-primary/50"
              title={commit.message}
            >
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full mt-1.5 flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {truncateMessage(commit.message)}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-xs text-muted-foreground truncate">
                      {commit.author}
                    </div>
                    <div className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                      {formatDate(commit.timestamp)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 font-mono">
                    {commit.hash}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer with branch actions - only in non-compact mode */}
      {!compact && commits.length > 0 && (
        <div className="p-3 border-t border-border bg-muted/30">
          <div className="flex space-x-2">
            <button
              onClick={loadCommits}
              className="flex-1 px-3 py-1 text-xs bg-accent hover:bg-accent/80 rounded"
              title="Refresh commits"
            >
              🔄 Refresh
            </button>
            <button
              className="flex-1 px-3 py-1 text-xs bg-accent hover:bg-accent/80 rounded"
              title="View all commits"
              onClick={() => {
                // TODO: Open detailed commit view
                console.log('View all commits clicked');
              }}
            >
              📊 View All
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GitHistory;
