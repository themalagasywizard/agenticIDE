import React, { useState, useEffect } from 'react';

interface GitCredentialDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (username: string, password: string) => void;
  defaultUsername?: string;
}

const GitCredentialDialog: React.FC<GitCredentialDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  defaultUsername = 'git',
}) => {
  const [username, setUsername] = useState(defaultUsername);
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (isOpen) {
      setUsername(defaultUsername || 'git');
      setPassword('');
    }
  }, [isOpen, defaultUsername]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10004]">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Git Credentials</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your GitHub credentials to authenticate this push
          </p>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label htmlFor="git-username" className="block text-sm font-medium text-foreground mb-2">
              Username
            </label>
            <input
              id="git-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="git or your GitHub username"
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="git-password" className="block text-sm font-medium text-foreground mb-2">
              Personal Access Token
            </label>
            <input
              id="git-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Paste your GitHub PAT"
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Tip: For HTTPS, the token is used as the password.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end space-x-3 bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(username.trim() || 'git', password)}
            disabled={!username.trim() || !password}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default GitCredentialDialog;

