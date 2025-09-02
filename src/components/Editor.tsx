import React, { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';

interface FileData {
  path: string;
  content: string;
  isModified: boolean;
}

interface EditorProps {
  files: FileData[];
  activeFileIndex: number;
  onFileSelect: (index: number) => void;
  onFileClose: (index: number) => void;
  onFileSave: (index: number) => void;
  onContentChange: (index: number, content: string) => void;
}

const CodeEditor: React.FC<EditorProps> = ({
  files,
  activeFileIndex,
  onFileSelect,
  onFileClose,
  onFileSave,
  onContentChange
}) => {
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;

    // Add keyboard shortcuts
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => {
        if (activeFileIndex !== -1) {
          onFileSave(activeFileIndex);
        }
      }
    );

    // Add Ctrl+Tab for tab switching
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Tab,
      () => {
        switchToNextTab();
      }
    );

    // Add Ctrl+Shift+Tab for previous tab
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Tab,
      () => {
        switchToPreviousTab();
      }
    );

    // Add Ctrl+W for closing current file
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW,
      () => {
        if (activeFileIndex !== -1) {
          onFileClose(activeFileIndex);
        }
      }
    );
  };

  const switchToNextTab = () => {
    if (files.length <= 1) return;
    const nextIndex = (activeFileIndex + 1) % files.length;
    onFileSelect(nextIndex);
  };

  const switchToPreviousTab = () => {
    if (files.length <= 1) return;
    const prevIndex = activeFileIndex === 0 ? files.length - 1 : activeFileIndex - 1;
    onFileSelect(prevIndex);
  };

  const getFileName = (path: string) => {
    return path.split(/[/\\]/).pop() || path;
  };

  const getFileExtension = (path: string) => {
    const fileName = getFileName(path);
    return fileName.split('.').pop()?.toLowerCase() || '';
  };

  const getLanguageFromExtension = (extension: string) => {
    const languageMap: { [key: string]: string } = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      rs: 'rust',
      json: 'json',
      md: 'markdown',
      css: 'css',
      scss: 'scss',
      html: 'html',
      xml: 'xml',
      yaml: 'yaml',
      yml: 'yaml',
      sh: 'shell',
      bash: 'shell',
      sql: 'sql',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      go: 'go',
      php: 'php',
      rb: 'ruby',
    };
    return languageMap[extension] || 'plaintext';
  };

  if (files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-card border-b border-border">
        <div className="text-center text-muted-foreground">
          <p className="text-lg mb-2">Welcome to Agentic IDE</p>
          <p className="text-sm">Open a file from the explorer or use Ctrl+O to open a project</p>
        </div>
      </div>
    );
  }

  const activeFile = files[activeFileIndex];

  return (
    <div className="flex-1 flex flex-col">
      {/* Tab Bar */}
      <div className="flex bg-card border-b border-border overflow-x-auto scrollbar-hide">
        {files.map((file, index) => (
          <div
            key={file.path}
            className={`group relative flex items-center px-4 py-2 text-sm border-r border-border/50 cursor-pointer transition-all duration-150 hover:bg-accent/50 ${
              index === activeFileIndex
                ? 'bg-background text-foreground shadow-sm border-b-2 border-b-primary'
                : 'bg-card text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => onFileSelect(index)}
            title={file.path}
          >
            <span className="truncate max-w-40 font-medium">
              {getFileName(file.path)}
            </span>
            {file.isModified && (
              <span className="ml-2 text-orange-500 font-bold">●</span>
            )}
            <button
              className="ml-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive transition-all duration-150"
              onClick={(e) => {
                e.stopPropagation();
                onFileClose(index);
              }}
              title="Close file (Ctrl+W)"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Editor */}
      <div className="flex-1 editor-container">
        {activeFile && (
          <Editor
            height="100%"
            language={getLanguageFromExtension(getFileExtension(activeFile.path))}
            value={activeFile.content}
            onChange={(value) => {
              if (value !== undefined) {
                onContentChange(activeFileIndex, value);
              }
            }}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              lineNumbers: 'on',
              roundedSelection: false,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              insertSpaces: true,
              wordWrap: 'on',
              theme: document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light',
            }}
            theme={document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light'}
          />
        )}
      </div>
    </div>
  );
};

export default CodeEditor;
