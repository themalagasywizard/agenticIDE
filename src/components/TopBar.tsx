import React from 'react';

interface TopBarProps {
  projectName: string;
  gitBranch?: string;
  onOpenProject: () => void;
  onOpenRecentProjects: () => void;
  onToggleTheme: () => void;
  isDarkMode: boolean;
}

const TopBar: React.FC<TopBarProps> = ({
  projectName,
  gitBranch,
  onOpenProject,
  onOpenRecentProjects,
  onToggleTheme,
  isDarkMode
}) => {
  return (
    <div className="h-12 border-b border-border bg-card/95 backdrop-blur-sm flex items-center px-4 justify-between shadow-sm">
      <div className="flex items-center space-x-4">
        <h1 className="text-lg font-semibold">Agentic IDE</h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">
            {projectName}
          </span>
          {gitBranch && (
            <div className="flex items-center space-x-1 px-2 py-1 bg-accent/50 rounded text-xs">
              <span className="text-accent-foreground">git:</span>
              <span className="font-medium text-accent-foreground">{gitBranch}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={onOpenProject}
          className="btn-modern btn-primary"
          title="Open Project (Ctrl+O)"
        >
          Open Project
        </button>

        <button
          onClick={onOpenRecentProjects}
          className="btn-modern btn-secondary"
          title="Recent Projects"
        >
          Recent
        </button>

        <button
          onClick={onToggleTheme}
          className="btn-modern btn-ghost p-2"
          title="Toggle Theme"
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>

        <button
          className="btn-modern btn-ghost p-2"
          title="Settings"
        >
          ⚙️
        </button>
      </div>
    </div>
  );
};

export default TopBar;
