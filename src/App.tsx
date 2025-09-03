import { useState, useEffect } from 'react';
import { open, readDir, readTextFile, writeTextFile, getGitStatus } from './tauri-api';
import TopBar from './components/TopBar';
import FileTree from './components/FileTree';
import Editor from './components/Editor';
import Terminal from './components/Terminal';
import FileSearch from './components/FileSearch';
import RecentProjects, { addRecentProject } from './components/RecentProjects';
import GitCommitDialog from './components/GitCommitDialog';
import './styles.css';

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileItem[];
}

function App() {
  const [currentProject, setCurrentProject] = useState<string>('');
  const [fileTree, setFileTree] = useState<FileItem[]>([]);
  const [openFiles, setOpenFiles] = useState<{ path: string; content: string; isModified: boolean }[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(-1);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [sidebarWidth, setSidebarWidth] = useState<number>(250);
  const [terminalHeight, setTerminalHeight] = useState<number>(300);
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  const [showTerminal, setShowTerminal] = useState<boolean>(true);
  const [isFileSearchOpen, setIsFileSearchOpen] = useState<boolean>(false);
  const [isRecentProjectsOpen, setIsRecentProjectsOpen] = useState<boolean>(false);
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState<boolean>(false);
  const [gitStatus, setGitStatus] = useState<any>(null);
  const [gitBranch, setGitBranch] = useState<string>('');
  const [showGitPanel, setShowGitPanel] = useState<boolean>(false);

  // Apply theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+O - Open folder
      if (event.ctrlKey && event.key === 'o' && !event.shiftKey) {
        event.preventDefault();
        openProject();
      }

      // Ctrl+S - Save file
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        saveCurrentFile();
      }

      // Ctrl+Shift+T - New terminal tab (placeholder for now)
      if (event.ctrlKey && event.shiftKey && event.key === 'T') {
        event.preventDefault();
        // TODO: Implement new terminal tab
        console.log('New terminal tab shortcut pressed');
      }

      // Ctrl+P - File search
      if (event.ctrlKey && event.key === 'p') {
        event.preventDefault();
        setIsFileSearchOpen(true);
      }

      // Ctrl+Shift+G - Toggle Source Control (Git) panel
      if (event.ctrlKey && event.shiftKey && event.key === 'G') {
        event.preventDefault();
        if (currentProject && gitStatus?.isGitRepo) {
          setShowGitPanel(!showGitPanel);
        }
      }

      // Ctrl+Enter - Quick commit (when in git context and files are staged)
      if (event.ctrlKey && event.key === 'Enter' && gitStatus?.staged?.length > 0) {
        event.preventDefault();
        setIsCommitDialogOpen(true);
      }

      // Ctrl+K+G - Stage all changes (Cursor-like shortcut)
      if (event.ctrlKey && event.key === 'k') {
        // Wait for next key
        const handleSecondKey = (e: KeyboardEvent) => {
          if (e.key === 'g' || e.key === 'G') {
            e.preventDefault();
            // Stage all modified and untracked files
            if (gitStatus?.modified?.length || gitStatus?.untracked?.length) {
              const allChanges = [...(gitStatus.modified || []), ...(gitStatus.untracked || [])];
              // This would need a "stage all" function - placeholder for now
              console.log('Stage all shortcut triggered for files:', allChanges);
            }
          }
          document.removeEventListener('keydown', handleSecondKey);
        };
        setTimeout(() => {
          document.addEventListener('keydown', handleSecondKey);
          setTimeout(() => document.removeEventListener('keydown', handleSecondKey), 1000);
        }, 100);
      }

      // F5 - Refresh Git status and file tree
      if (event.key === 'F5' && currentProject) {
        event.preventDefault();
        detectGitStatus(currentProject);
        loadFileTree(currentProject);
      }

      // Ctrl+Shift+P - Push changes (when branch has commits)
      if (event.ctrlKey && event.shiftKey && event.key === 'P' && gitStatus?.isGitRepo) {
        event.preventDefault();
        // This would trigger a push operation
        console.log('Push shortcut triggered');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeFileIndex]);

  const openProject = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (selected && typeof selected === 'string') {
        await loadProject(selected);
      }
    } catch (error) {
      console.error('Failed to open project:', error);
    }
  };

  const loadProject = async (projectPath: string) => {
    setCurrentProject(projectPath);
    addRecentProject(projectPath);
    await loadFileTree(projectPath);
    await detectGitStatus(projectPath);
  };

  const detectGitStatus = async (projectPath: string) => {
    try {
      const status = await getGitStatus(projectPath) as any;
      setGitStatus(status);
      if (status.isGitRepo) {
        setGitBranch(status.branch);
        
        // Auto-show git panel if there are changes OR if it's a newly initialized repo
        const totalChanges = (status.staged?.length || 0) + (status.modified?.length || 0) + (status.untracked?.length || 0);
        if (totalChanges > 0 || status.branch === 'main') {
          setShowGitPanel(true);
        }
      } else {
        setGitBranch('');
        setShowGitPanel(false);
      }
    } catch (error) {
      console.error('Failed to detect Git status:', error);
      setGitBranch('');
      setGitStatus(null);
      setShowGitPanel(false);
    }
  };

  const handleCommitComplete = async () => {
    // Refresh Git status after commit
    if (currentProject) {
      await detectGitStatus(currentProject);
    }
  };

  const loadFileTree = async (path: string) => {
    try {
      const entries = await readDir(path);
      console.log('Loaded entries:', entries);
      
      // The readDir function now returns the correct structure from our backend
      const tree: FileItem[] = entries.map((entry) => ({
        name: entry.name,
        path: entry.path,
        isDirectory: entry.children !== undefined,
        children: entry.children, // This will be an empty array for directories, undefined for files
      }));
      
      setFileTree(tree);
    } catch (error) {
      console.error('Failed to load file tree:', error);
    }
  };

  // Function to load subdirectory contents on demand
  const loadSubdirectory = async (dirPath: string): Promise<FileItem[]> => {
    try {
      const entries = await readDir(dirPath);
      return entries.map((entry) => ({
        name: entry.name,
        path: entry.path,
        isDirectory: entry.children !== undefined,
        children: entry.children,
      }));
    } catch (error) {
      console.error('Failed to load subdirectory:', error);
      return [];
    }
  };

  const openFile = async (filePath: string) => {
    try {
      console.log('🔍 Opening file:', filePath);
      
      // Check if file is already open
      const existingIndex = openFiles.findIndex(file => file.path === filePath);
      if (existingIndex !== -1) {
        console.log('📝 File already open at index:', existingIndex);
        setActiveFileIndex(existingIndex);
        return;
      }

      console.log('📖 Reading file content...');
      const content = await readTextFile(filePath);
      console.log('✅ File content loaded, length:', content.length);
      
      const newFile = { path: filePath, content, isModified: false };
      
      // Update state and calculate the correct index
      setOpenFiles(prev => {
        const newOpenFiles = [...prev, newFile];
        const newIndex = newOpenFiles.length - 1; // Index of the newly added file
        console.log('📁 Adding file to openFiles. New array length:', newOpenFiles.length, 'New file index:', newIndex);
        setActiveFileIndex(newIndex);
        return newOpenFiles;
      });
    } catch (error) {
      console.error('❌ Failed to open file:', error);
      alert(`Failed to open file: ${error}`);
    }
  };

  const saveFile = async (index: number) => {
    try {
      const file = openFiles[index];
      await writeTextFile(file.path, file.content);
      setOpenFiles(prev =>
        prev.map((f, i) =>
          i === index ? { ...f, isModified: false } : f
        )
      );
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  };

  const updateFileContent = (index: number, content: string) => {
    setOpenFiles(prev =>
      prev.map((f, i) =>
        i === index ? { ...f, content, isModified: true } : f
      )
    );
  };

  const closeFile = (index: number) => {
    const fileToClose = openFiles[index];

    // Check if file has unsaved changes
    if (fileToClose && fileToClose.isModified) {
      const shouldSave = window.confirm(
        `File "${fileToClose.path.split(/[/\\]/).pop()}" has unsaved changes. Do you want to save before closing?`
      );

      if (shouldSave) {
        // Save the file before closing
        saveFile(index).then(() => {
          // After saving, close the file
          performCloseFile(index);
        });
        return;
      }
    }

    // Close the file
    performCloseFile(index);
  };

  const performCloseFile = (index: number) => {
    setOpenFiles(prev => prev.filter((_, i) => i !== index));
    if (activeFileIndex === index) {
      setActiveFileIndex(-1);
    } else if (activeFileIndex > index) {
      setActiveFileIndex(activeFileIndex - 1);
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  // Save current file
  const saveCurrentFile = () => {
    if (activeFileIndex !== -1) {
      saveFile(activeFileIndex);
    }
  };

  // Save project as new folder
  const saveProjectAs = async () => {
    if (!currentProject) {
      alert('No project to save');
      return;
    }

    try {
      // For now, we'll just copy the current project to a new location
      // In a real implementation, you'd use Tauri's dialog API to let user choose destination
      const newProjectName = prompt('Enter new project name:');
      if (!newProjectName) return;

      // This is a placeholder - in a real implementation you'd:
      // 1. Use Tauri's dialog to choose destination folder
      // 2. Copy all files from current project to new location
      // 3. Update currentProject to new path

      alert(`Save Project As functionality would copy "${currentProject}" to "${newProjectName}"`);
      // TODO: Implement actual project copying logic
    } catch (error) {
      console.error('Failed to save project as:', error);
      alert('Failed to save project');
    }
  };

  // Check if any files have unsaved changes
  const hasUnsavedChanges = openFiles.some(file => file.isModified);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <TopBar
        projectName={currentProject.split('/').pop() || currentProject.split('\\').pop() || 'No Project'}
        gitBranch={gitBranch}
        onOpenProject={openProject}
        onOpenRecentProjects={() => setIsRecentProjectsOpen(true)}
        onToggleTheme={toggleTheme}
        isDarkMode={isDarkMode}
        onSaveFile={saveCurrentFile}
        onSaveProjectAs={saveProjectAs}
        hasUnsavedChanges={hasUnsavedChanges}
        onToggleSidebar={() => setShowSidebar((s) => !s)}
        onToggleTerminal={() => setShowTerminal((t) => !t)}
        showSidebar={showSidebar}
        showTerminal={showTerminal}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {showSidebar && (
          <div
            className="border-r border-border bg-card"
            style={{ width: sidebarWidth }}
          >
            <FileTree
              fileTree={fileTree}
              onFileClick={openFile}
              currentProject={currentProject}
              onRefresh={() => {
                loadFileTree(currentProject);
                if (currentProject) detectGitStatus(currentProject);
              }}
              onOpenCommitDialog={() => setIsCommitDialogOpen(true)}
              onLoadSubdirectory={loadSubdirectory}
              gitStatus={gitStatus}
              showGitPanel={showGitPanel}
              onGitPanelToggle={setShowGitPanel}
            />
          </div>
        )}

        {/* Resizer */}
        {showSidebar && (
          <div
            className="resizer w-1 bg-border hover:bg-accent cursor-col-resize"
            onMouseDown={(e) => {
              const startX = e.clientX;
              const startWidth = sidebarWidth;

              const handleMouseMove = (e: MouseEvent) => {
                const newWidth = startWidth + (e.clientX - startX);
                if (newWidth > 150 && newWidth < 500) {
                  setSidebarWidth(newWidth);
                }
              };

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };

              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <Editor
            files={openFiles}
            activeFileIndex={activeFileIndex}
            onFileSelect={setActiveFileIndex}
            onFileClose={closeFile}
            onFileSave={saveFile}
            onContentChange={updateFileContent}
          />

          {/* Resizer */}
          {showTerminal && (
            <div
              className="resizer-horizontal h-1 bg-border hover:bg-accent cursor-row-resize"
              onMouseDown={(e) => {
                const startY = e.clientY;
                const startHeight = terminalHeight;

                const handleMouseMove = (e: MouseEvent) => {
                  const newHeight = startHeight - (e.clientY - startY);
                  if (newHeight > 150 && newHeight < 600) {
                    setTerminalHeight(newHeight);
                  }
                };

                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };

                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            />
          )}

          {/* Terminal */}
          {showTerminal && (
            <div
              className="border-t border-border bg-card"
              style={{ height: terminalHeight }}
            >
              <Terminal currentProject={currentProject} />
            </div>
          )}
        </div>
      </div>

      {/* File Search Modal */}
      <FileSearch
        fileTree={fileTree}
        onFileSelect={openFile}
        isOpen={isFileSearchOpen}
        onClose={() => setIsFileSearchOpen(false)}
      />

      {/* Recent Projects Modal */}
      <RecentProjects
        onProjectSelect={loadProject}
        onOpenNewProject={openProject}
        isOpen={isRecentProjectsOpen}
        onClose={() => setIsRecentProjectsOpen(false)}
      />

      {/* Git Commit Dialog */}
      {gitStatus && (
        <GitCommitDialog
          isOpen={isCommitDialogOpen}
          onClose={() => setIsCommitDialogOpen(false)}
          projectPath={currentProject}
          gitStatus={gitStatus}
          onCommitComplete={handleCommitComplete}
        />
      )}
    </div>
  );
}

export default App;
