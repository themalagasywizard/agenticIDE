import React, { useState, useEffect } from 'react';

interface RecentProject {
  path: string;
  name: string;
  lastOpened: Date;
}

interface RecentProjectsProps {
  onProjectSelect: (path: string) => void;
  onOpenNewProject: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const RecentProjects: React.FC<RecentProjectsProps> = ({
  onProjectSelect,
  onOpenNewProject,
  isOpen,
  onClose
}) => {
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  // Load recent projects from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('agentic-ide-recent-projects');
    if (stored) {
      try {
        const projects = JSON.parse(stored).map((project: any) => ({
          ...project,
          lastOpened: new Date(project.lastOpened)
        }));
        setRecentProjects(projects);
      } catch (error) {
        console.error('Failed to load recent projects:', error);
      }
    }
  }, []);

  // Save recent projects to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('agentic-ide-recent-projects', JSON.stringify(recentProjects));
  }, [recentProjects]);

  const addRecentProject = (path: string) => {
    const projectName = path.split(/[/\\]/).pop() || path;
    const newProject: RecentProject = {
      path,
      name: projectName,
      lastOpened: new Date()
    };

    // Remove existing entry if it exists
    setRecentProjects(prev =>
      [newProject, ...prev.filter(p => p.path !== path)].slice(0, 10) // Keep only 10 most recent
    );
  };

  const removeRecentProject = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentProjects(prev => prev.filter(p => p.path !== path));
  };

  const formatLastOpened = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card-modern shadow-modern-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">Recent Projects</h2>
          <button
            onClick={onClose}
            className="btn-modern btn-ghost p-2"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {recentProjects.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📁</div>
              <p className="text-muted-foreground mb-4">No recent projects</p>
                              <button
                  onClick={() => {
                    onClose();
                    onOpenNewProject();
                  }}
                  className="btn-modern btn-primary"
                >
                  Open Project
                </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {recentProjects.length} recent project{recentProjects.length !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={() => {
                    onClose();
                    onOpenNewProject();
                  }}
                  className="btn-modern btn-secondary"
                >
                  Open New Project
                </button>
              </div>

              <div className="grid gap-2">
                {recentProjects.map((project) => (
                  <div
                    key={project.path}
                    className="group flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 cursor-pointer transition-all duration-200"
                    onClick={() => {
                      onProjectSelect(project.path);
                      onClose();
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <span className="text-lg">📁</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium truncate">{project.name}</h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {project.path}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Last opened {formatLastOpened(project.lastOpened)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => removeRecentProject(project.path, e)}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded hover:bg-destructive/20 hover:text-destructive transition-all duration-150"
                      title="Remove from recent projects"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expose addRecentProject function to parent components */}
      {(window as any).addRecentProject = addRecentProject}
    </div>
  );
};

// Helper function to add a project to recent projects (can be called from outside)
export const addRecentProject = (path: string) => {
  if ((window as any).addRecentProject) {
    (window as any).addRecentProject(path);
  }
};

export default RecentProjects;
