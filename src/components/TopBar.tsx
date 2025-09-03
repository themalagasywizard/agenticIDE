import React from 'react';
import { Sun, Moon, PanelLeft, PanelBottom, Settings } from 'lucide-react';

interface TopBarProps {
  projectName: string;
  gitBranch?: string;
  onOpenProject: () => void;
  onOpenRecentProjects: () => void;
  onToggleTheme: () => void;
  isDarkMode: boolean;
  onSaveFile?: () => void;
  onSaveProjectAs?: () => void;
  hasUnsavedChanges?: boolean;
  onToggleSidebar: () => void;
  onToggleTerminal: () => void;
  showSidebar: boolean;
  showTerminal: boolean;
}

const TopBar: React.FC<TopBarProps> = ({
  projectName,
  gitBranch,
  onOpenProject,
  onOpenRecentProjects,
  onToggleTheme,
  isDarkMode,
  onSaveFile,
  onSaveProjectAs,
  hasUnsavedChanges,
  onToggleSidebar,
  onToggleTerminal,
  showSidebar,
  showTerminal,
}) => {
  return (
    <div className="h-12 border-b border-border bg-card/95 backdrop-blur-sm flex items-center px-4 justify-between shadow-sm relative z-[10000]">
      <div className="flex items-center space-x-4">
        <h1 className="text-lg font-semibold">Agentic IDE</h1>

        {/* File Menu */}
        <div className="relative group">
          <button className="px-3 py-1 text-sm hover:bg-accent hover:text-accent-foreground rounded transition-colors">
            File
          </button>
          <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-md shadow-lg py-1 min-w-40 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-[10001]">
            <button
              onClick={onSaveFile}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${hasUnsavedChanges ? 'font-medium' : 'opacity-60'}`}
              disabled={!hasUnsavedChanges}
            >
              💾 Save {hasUnsavedChanges && '•'}
            </button>
            <button
              onClick={onSaveProjectAs}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              📁 Save Project As...
            </button>
            <div className="border-t border-border my-1"></div>
            <button
              onClick={onOpenProject}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              📂 Open Project...
            </button>
            <button
              onClick={onOpenRecentProjects}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              🕒 Recent Projects
            </button>
          </div>
        </div>

        {/* Edit Menu */}
        <div className="relative group">
          <button className="px-3 py-1 text-sm hover:bg-accent hover:text-accent-foreground rounded transition-colors">
            Edit
          </button>
          <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-md shadow-lg py-1 min-w-40 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-[10001]">
            <button className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
              ↶ Undo
            </button>
            <button className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
              ↷ Redo
            </button>
            <div className="border-t border-border my-1"></div>
            <button className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
              ✂️ Cut
            </button>
            <button className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
              📋 Copy
            </button>
            <button className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
              📄 Paste
            </button>
          </div>
        </div>

        {gitBranch && (
          <div className="flex items-center space-x-1 px-2 py-1 bg-accent/50 rounded text-xs">
            <span className="text-accent-foreground">git:</span>
            <span className="font-medium text-accent-foreground">{gitBranch}</span>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={onToggleTheme}
          className="btn-modern btn-ghost p-2"
          title="Toggle Theme"
          aria-label="Toggle Theme"
        >
          {isDarkMode ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </button>

        <button
          onClick={onToggleSidebar}
          className="btn-modern btn-ghost p-2"
          title={showSidebar ? 'Hide Left Panel' : 'Show Left Panel'}
          aria-label={showSidebar ? 'Hide Left Panel' : 'Show Left Panel'}
        >
          <PanelLeft className="h-5 w-5" />
        </button>

        <button
          onClick={onToggleTerminal}
          className="btn-modern btn-ghost p-2"
          title={showTerminal ? 'Hide Terminal' : 'Show Terminal'}
          aria-label={showTerminal ? 'Hide Terminal' : 'Show Terminal'}
        >
          <PanelBottom className="h-5 w-5" />
        </button>

        <button
          className="btn-modern btn-ghost p-2"
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default TopBar;
