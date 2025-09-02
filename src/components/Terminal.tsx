import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '../tauri-api';

interface TerminalProps {
  currentProject: string;
}

interface CommandBlock {
  id: string;
  command: string;
  output: string;
  timestamp: Date;
  exitStatus: number | null;
  isRunning: boolean;
  isGitCommand?: boolean;
  gitMetadata?: {
    operation: string;
    branch?: string;
    commitHash?: string;
    affectedFiles?: string[];
  };
}

const Terminal: React.FC<TerminalProps> = ({ currentProject }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [commandBlocks, setCommandBlocks] = useState<CommandBlock[]>([]);
  const [currentCommand, setCurrentCommand] = useState('');

  useEffect(() => {
    // Focus input on mount
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const executeCommand = async (command: string): Promise<{ output: string; exitStatus: number; gitMetadata?: any }> => {
    try {
      const cmd = command.toLowerCase().trim();

      // Check if it's a Git command
      if (cmd.startsWith('git ')) {
        return await executeGitCommand(command);
      }

      // Regular commands
      switch (cmd) {
        case 'clear':
          return { output: '', exitStatus: 0 };
        case 'pwd':
          return { output: currentProject || '/', exitStatus: 0 };
        case 'ls':
          if (currentProject) {
            return {
              output: `Contents of ${currentProject}:\n(File listing would be implemented here)`,
              exitStatus: 0
            };
          } else {
            return { output: 'No project opened', exitStatus: 1 };
          }
        case 'help':
          return {
            output: 'Available commands:\n  clear - Clear terminal\n  pwd - Print working directory\n  ls - List directory contents\n  help - Show this help',
            exitStatus: 0
          };
        default:
          return {
            output: `Command not found: ${command}\nType "help" for available commands`,
            exitStatus: 127
          };
      }
    } catch (error) {
      return { output: `Error executing command: ${error}`, exitStatus: 1 };
    }
  };

  const executeGitCommand = async (command: string): Promise<{ output: string; exitStatus: number; gitMetadata?: any }> => {
    const parts = command.split(' ');
    const gitCommand = parts[1];
    const args = parts.slice(2);

    let gitMetadata: any = {
      operation: gitCommand,
    };

    switch (gitCommand) {
      case 'status':
        gitMetadata.operation = 'status';
        return {
          output: 'On branch main\nYour branch is up to date with \'origin/main\'.\n\nChanges to be committed:\n  (use "git restore --staged <file>..." to unstage)\n        modified:   src/App.tsx\n\nChanges not staged for commit:\n  (use "git add <file>..." to update what will be committed)\n        modified:   src/components/Terminal.tsx\n\nUntracked files:\n  (use "git add <file>..." to include in what will be committed)\n        .gitignore.new',
          exitStatus: 0,
          gitMetadata
        };

      case 'add':
        gitMetadata.operation = 'add';
        gitMetadata.affectedFiles = args;
        return {
          output: args.length > 0 ? `Added ${args.join(', ')} to staging area` : 'Nothing specified, nothing added',
          exitStatus: 0,
          gitMetadata
        };

      case 'commit':
        gitMetadata.operation = 'commit';
        const messageIndex = args.indexOf('-m');
        if (messageIndex !== -1 && messageIndex + 1 < args.length) {
          const message = args[messageIndex + 1];
          gitMetadata.commitMessage = message;
          return {
            output: `[main ${Date.now().toString(36)}] ${message}\n 1 file changed, 2 insertions(+)`,
            exitStatus: 0,
            gitMetadata
          };
        }
        return {
          output: 'Aborting commit due to empty commit message',
          exitStatus: 1,
          gitMetadata
        };

      case 'log':
        gitMetadata.operation = 'log';
        return {
          output: 'commit abc123def456\nAuthor: Developer <dev@example.com>\nDate:   Mon Jan 1 12:00:00 2024 +0000\n\n    Initial commit\n\ncommit def456ghi789\nAuthor: Developer <dev@example.com>\nDate:   Sun Dec 31 23:59:59 2023 +0000\n\n    Update README',
          exitStatus: 0,
          gitMetadata
        };

      case 'branch':
        gitMetadata.operation = 'branch';
        return {
          output: '* main\n  develop\n  feature/new-ui',
          exitStatus: 0,
          gitMetadata
        };

      default:
        return {
          output: `git: '${gitCommand}' is not a git command. See 'git --help'`,
          exitStatus: 1,
          gitMetadata
        };
    }
  };

  const runCommand = async (command: string) => {
    const blockId = Date.now().toString();
    const isGitCommand = command.toLowerCase().trim().startsWith('git ');

    // Create new command block
    const newBlock: CommandBlock = {
      id: blockId,
      command,
      output: '',
      timestamp: new Date(),
      exitStatus: null,
      isRunning: true,
      isGitCommand,
    };

    setCommandBlocks(prev => [...prev, newBlock]);

    try {
      const result = await executeCommand(command);

      // Update block with results and Git metadata
      setCommandBlocks(prev =>
        prev.map(block =>
          block.id === blockId
            ? {
                ...block,
                output: result.output,
                exitStatus: result.exitStatus,
                isRunning: false,
                gitMetadata: result.gitMetadata
              }
            : block
        )
      );
    } catch (error) {
      setCommandBlocks(prev =>
        prev.map(block =>
          block.id === blockId
            ? { ...block, output: `Error: ${error}`, exitStatus: 1, isRunning: false }
            : block
        )
      );
    }
  };

  const rerunCommand = async (blockId: string) => {
    const block = commandBlocks.find(b => b.id === blockId);
    if (!block) return;

    await runCommand(block.command);
  };

  const clearTerminal = () => {
    setCommandBlocks([]);
  };

  const handleCommandSubmit = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && currentCommand.trim()) {
      runCommand(currentCommand.trim());
      setCurrentCommand('');
    }
  };

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">TERMINAL</span>
          <span className="text-xs text-muted-foreground">
            {currentProject ? `~${currentProject.split(/[/\\]/).pop()}` : 'No project'}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            className="p-1 rounded hover:bg-accent hover:text-accent-foreground text-xs"
            title="New Terminal"
          >
            +
          </button>
          <button
            className="p-1 rounded hover:bg-accent hover:text-accent-foreground text-xs"
            title="Clear Terminal"
            onClick={clearTerminal}
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Command Blocks */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 terminal-scroll">
        {commandBlocks.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <p>Welcome to Agentic IDE Terminal</p>
            <p className="text-sm mt-2">Type commands below to get started</p>
          </div>
        )}

        {commandBlocks.map((block) => (
          <div
            key={block.id}
            className={`command-block ${
              block.isGitCommand
                ? 'bg-purple-500/10 border-purple-500/30'
                : block.isRunning
                ? 'running'
                : block.exitStatus === 0
                ? 'success'
                : 'error'
            }`}
          >
            {/* Command Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="text-muted-foreground">$</span>
                <span className="font-medium">{block.command}</span>
                {block.isGitCommand && (
                  <span className="px-2 py-1 text-xs bg-purple-600 text-white rounded">
                    git {block.gitMetadata?.operation}
                  </span>
                )}
                {block.isRunning && (
                  <span className="text-blue-500 animate-pulse">●</span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted-foreground">
                  {block.timestamp.toLocaleTimeString()}
                </span>
                {block.isGitCommand && block.gitMetadata?.affectedFiles && (
                  <span className="text-xs text-purple-600">
                    {block.gitMetadata.affectedFiles.length} files
                  </span>
                )}
                <button
                  onClick={() => rerunCommand(block.id)}
                  className="px-2 py-1 text-xs bg-accent hover:bg-accent/80 rounded transition-colors"
                  title="Rerun command"
                >
                  ↻
                </button>
                <button
                  className="px-2 py-1 text-xs bg-accent hover:bg-accent/80 rounded transition-colors"
                  title="Explain (placeholder)"
                >
                  💡
                </button>
              </div>
            </div>

            {/* Command Output */}
            {block.output && (
              <div className="bg-muted/50 rounded p-2 whitespace-pre-wrap font-mono text-sm">
                {block.output}
              </div>
            )}

            {/* Exit Status */}
            {block.exitStatus !== null && !block.isRunning && (
              <div className="mt-2 text-xs">
                <span
                  className={`px-2 py-1 rounded ${
                    block.exitStatus === 0
                      ? 'bg-green-500/20 text-green-600'
                      : 'bg-red-500/20 text-red-600'
                  }`}
                >
                  Exit {block.exitStatus}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Command Input */}
      <div className="border-t border-border p-2 bg-background">
        <div className="flex items-center space-x-2">
          <span className="text-muted-foreground font-mono">$</span>
          <input
            ref={inputRef}
            type="text"
            value={currentCommand}
            onChange={(e) => setCurrentCommand(e.target.value)}
            onKeyDown={handleCommandSubmit}
            placeholder="Type a command..."
            className="command-input"
            autoFocus
          />
        </div>
      </div>
    </div>
  );
};

export default Terminal;
