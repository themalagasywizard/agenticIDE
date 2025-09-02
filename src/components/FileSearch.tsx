import React, { useState, useEffect, useRef } from 'react';

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileItem[];
}

interface FileSearchProps {
  fileTree: FileItem[];
  onFileSelect: (path: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  path: string;
  name: string;
  score: number;
}

const FileSearch: React.FC<FileSearchProps> = ({
  fileTree,
  onFileSelect,
  isOpen,
  onClose
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Flatten file tree into searchable list
  const flattenFiles = (tree: FileItem[], basePath = ''): SearchResult[] => {
    const files: SearchResult[] = [];

    const processItem = (item: FileItem, currentPath: string) => {
      if (!item.isDirectory) {
        files.push({
          path: currentPath,
          name: item.name,
          score: 0
        });
      }

      if (item.children) {
        item.children.forEach(child => {
          processItem(child, currentPath ? `${currentPath}/${child.name}` : child.name);
        });
      }
    };

    tree.forEach(item => processItem(item, item.name));
    return files;
  };

  // Fuzzy search algorithm
  const fuzzySearch = (text: string, pattern: string): number => {
    if (!pattern) return 1;
    if (!text) return 0;

    const textLower = text.toLowerCase();
    const patternLower = pattern.toLowerCase();

    let score = 0;
    let patternIndex = 0;

    for (let i = 0; i < textLower.length && patternIndex < patternLower.length; i++) {
      if (textLower[i] === patternLower[patternIndex]) {
        score += 1 + (patternIndex === 0 ? 2 : 0); // Bonus for matching start
        patternIndex++;
      }
    }

    return patternIndex === patternLower.length ? score / textLower.length : 0;
  };

  // Search files based on query
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    const allFiles = flattenFiles(fileTree);
    const searchResults = allFiles
      .map(file => ({
        ...file,
        score: fuzzySearch(file.name, query) + fuzzySearch(file.path, query) * 0.5
      }))
      .filter(file => file.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Limit to top 10 results

    setResults(searchResults);
    setSelectedIndex(0);
  }, [query, fileTree]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % Math.max(results.length, 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev === 0 ? Math.max(results.length - 1, 0) : prev - 1);
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            onFileSelect(results[selectedIndex].path);
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onFileSelect, onClose]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-20 z-50">
      <div className="card-modern shadow-modern-lg w-96 max-w-[90vw] max-h-96 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold">Quick Open</h3>
          <button
            onClick={onClose}
            className="btn-modern btn-ghost p-1"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-border">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files..."
            className="input-modern w-full"
          />
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-80 overflow-y-auto">
          {results.length === 0 && query.trim() ? (
            <div className="p-4 text-center text-muted-foreground">
              No files found
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              Type to search files...
            </div>
          ) : (
            results.map((result, index) => (
              <div
                key={result.path}
                className={`px-4 py-2 cursor-pointer border-l-2 transition-colors ${
                  index === selectedIndex
                    ? 'bg-accent text-accent-foreground border-l-primary'
                    : 'hover:bg-accent/50 border-l-transparent'
                }`}
                onClick={() => {
                  onFileSelect(result.path);
                  onClose();
                }}
              >
                <div className="font-medium truncate">{result.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {result.path}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/50 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>↑↓ Navigate • Enter Select • Esc Close</span>
            <span>{results.length} results</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileSearch;
