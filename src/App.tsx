import React, { useState, useEffect } from 'react';
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
  const [isFileSearchOpen, setIsFileSearchOpen] = useState<boolean>(false);
  const [isRecentProjectsOpen, setIsRecentProjectsOpen] = useState<boolean>(false);
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState<boolean>(false);
  const [gitStatus, setGitStatus] = useState<any>(null);
  const [gitBranch, setGitBranch] = useState<string>('');

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
        if (activeFileIndex !== -1) {
          saveFile(activeFileIndex);
        }
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
      } else {
        setGitBranch('');
      }
    } catch (error) {
      console.error('Failed to detect Git status:', error);
      setGitBranch('');
      setGitStatus(null);
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
      // Check if file is already open
      const existingIndex = openFiles.findIndex(file => file.path === filePath);
      if (existingIndex !== -1) {
        setActiveFileIndex(existingIndex);
        return;
      }

      const content = await readTextFile(filePath);
      const newFile = { path: filePath, content, isModified: false };
      setOpenFiles(prev => [...prev, newFile]);
      setActiveFileIndex(openFiles.length);
    } catch (error) {
      console.error('Failed to open file:', error);
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

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <TopBar
        projectName={currentProject.split('/').pop() || currentProject.split('\\').pop() || 'No Project'}
        gitBranch={gitBranch}
        onOpenProject={openProject}
        onOpenRecentProjects={() => setIsRecentProjectsOpen(true)}
        onToggleTheme={toggleTheme}
        isDarkMode={isDarkMode}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className="border-r border-border bg-card"
          style={{ width: sidebarWidth }}
        >
          <FileTree
            fileTree={fileTree}
            onFileClick={openFile}
            currentProject={currentProject}
            onRefresh={() => loadFileTree(currentProject)}
            onOpenCommitDialog={() => setIsCommitDialogOpen(true)}
            onLoadSubdirectory={loadSubdirectory}
          />
        </div>

        {/* Resizer */}
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

          {/* Terminal */}
          <div
            className="border-t border-border bg-card"
            style={{ height: terminalHeight }}
          >
            <Terminal currentProject={currentProject} />
          </div>
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
