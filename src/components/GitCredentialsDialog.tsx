import React, { useState, useEffect } from 'react';
import { getGitCredentials, setGitCredentials, deleteGitCredentials } from '../tauri-api';

interface GitCredentials {
  username: string;
  token: string;
  remoteUrl: string;
}

interface GitCredentialsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  onCredentialsSaved: () => void;
}

const GitCredentialsDialog: React.FC<GitCredentialsDialogProps> = ({
  isOpen,
  onClose,
  projectPath,
  onCredentialsSaved
}) => {
  const [credentials, setCredentials] = useState<GitCredentials>({
    username: '',
    token: '',
    remoteUrl: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCredentials, setHasCredentials] = useState(false);

  // Load existing credentials when dialog opens
  useEffect(() => {
    if (isOpen && projectPath) {
      loadCredentials();
    }
  }, [isOpen, projectPath]);

  const loadCredentials = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const existingCredentials = await getGitCredentials(projectPath);
      if (existingCredentials) {
        setCredentials({
          username: existingCredentials.username || '',
          token: '', // Don't show the actual token for security
          remoteUrl: existingCredentials.remoteUrl || ''
        });
        setHasCredentials(true);
      } else {
        setCredentials({
          username: '',
          token: '',
          remoteUrl: ''
        });
        setHasCredentials(false);
      }
    } catch (error) {
      console.error('Failed to load Git credentials:', error);
      setError('Failed to load existing credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!credentials.username.trim() || !credentials.token.trim()) {
      setError('Both username and token are required');
      return;
    }

    if (!credentials.remoteUrl.trim()) {
      setError('Remote URL is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await setGitCredentials(projectPath, credentials);
      onCredentialsSaved();
      onClose();
    } catch (error) {
      console.error('Failed to save Git credentials:', error);
      setError('Failed to save credentials. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete these credentials? You will need to re-enter them for future pushes.')) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await deleteGitCredentials(projectPath);
      setCredentials({
        username: '',
        token: '',
        remoteUrl: ''
      });
      setHasCredentials(false);
      onCredentialsSaved();
      onClose();
    } catch (error) {
      console.error('Failed to delete Git credentials:', error);
      setError('Failed to delete credentials. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setCredentials({
      username: '',
      token: '',
      remoteUrl: ''
    });
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[10004] flex items-center justify-center" onClick={handleBackdropClick}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

      {/* Dialog positioned in editor area */}
      <div className="relative bg-card border border-border rounded-lg shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Git Credentials</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Store your GitHub/GitLab credentials for seamless pushing
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {isLoading && (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <p className="text-sm text-muted-foreground mt-2">Loading credentials...</p>
            </div>
          )}

          {!isLoading && (
            <>
              {error && (
                <div className="p-3 bg-destructive/20 border border-destructive/30 rounded text-destructive text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="remoteUrl" className="block text-sm font-medium text-foreground mb-2">
                  Remote URL
                </label>
                <input
                  id="remoteUrl"
                  type="url"
                  value={credentials.remoteUrl}
                  onChange={(e) => setCredentials(prev => ({ ...prev, remoteUrl: e.target.value }))}
                  placeholder="https://github.com/username/repo.git"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The URL of your Git repository
                </p>
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-foreground mb-2">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="your-username"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Your GitHub/GitLab username
                </p>
              </div>

              <div>
                <label htmlFor="token" className="block text-sm font-medium text-foreground mb-2">
                  Personal Access Token
                </label>
                <input
                  id="token"
                  type="password"
                  value={credentials.token}
                  onChange={(e) => setCredentials(prev => ({ ...prev, token: e.target.value }))}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Your Personal Access Token (PAT) - stored securely
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                  How to get a Personal Access Token:
                </h4>
                <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                  <li>• GitHub: Settings → Developer settings → Personal access tokens</li>
                  <li>• GitLab: User Settings → Access Tokens</li>
                  <li>• Select scopes: repo, workflow (GitHub) or api, read/write (GitLab)</li>
                </ul>
              </div>
            </>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-between">
          <div>
            {hasCredentials && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded disabled:opacity-50"
              >
                Delete Credentials
              </button>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSaving || !credentials.username.trim() || !credentials.token.trim() || !credentials.remoteUrl.trim()}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : hasCredentials ? 'Update Credentials' : 'Save Credentials'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GitCredentialsDialog;
