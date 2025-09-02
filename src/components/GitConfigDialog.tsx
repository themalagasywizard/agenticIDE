import React, { useState, useEffect } from 'react';
import { setGitConfig } from '../tauri-api';

interface GitConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  onConfigComplete: () => void;
  initialName?: string | null;
  initialEmail?: string | null;
}

const GitConfigDialog: React.FC<GitConfigDialogProps> = ({
  isOpen,
  onClose,
  projectPath,
  onConfigComplete,
  initialName,
  initialEmail
}) => {
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setUserName(initialName || '');
      setUserEmail(initialEmail || '');
      setError(null);
    }
  }, [isOpen, initialName, initialEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userName.trim() || !userEmail.trim()) {
      setError('Both name and email are required');
      return;
    }

    if (!userEmail.includes('@') || !userEmail.includes('.')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await setGitConfig(projectPath, userName.trim(), userEmail.trim());
      onConfigComplete();
      onClose();
    } catch (error) {
      console.error('Failed to set Git configuration:', error);
      setError('Failed to set Git configuration. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setUserName('');
    setUserEmail('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Configure Git</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Set up your Git identity for this repository
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 bg-destructive/20 border border-destructive/30 rounded text-destructive text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="userName" className="block text-sm font-medium text-foreground mb-2">
              Full Name
            </label>
            <input
              id="userName"
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={isLoading}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="userEmail" className="block text-sm font-medium text-foreground mb-2">
              Email Address
            </label>
            <input
              id="userEmail"
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="john.doe@example.com"
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={isLoading}
            />
          </div>

          <div className="text-xs text-muted-foreground">
            💡 This information will be used for Git commits in this repository
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end space-x-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !userName.trim() || !userEmail.trim()}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Setting up...' : 'Configure Git'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GitConfigDialog;
