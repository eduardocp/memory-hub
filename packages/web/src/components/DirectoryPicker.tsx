import { useState, useEffect } from 'react';
import { Folder, FolderOpen, ChevronRight, ChevronUp, X, Check, Loader2, HardDrive, Monitor } from 'lucide-react';
import axios from 'axios';
import clsx from 'clsx';

interface DirectoryEntry {
  name: string;
  path: string;
}

interface BrowseResponse {
  current: string;
  parent: string | null;
  directories: DirectoryEntry[];
  isDrivesRoot?: boolean;
}

interface DirectoryPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

export function DirectoryPicker({ isOpen, onClose, onSelect, initialPath }: DirectoryPickerProps) {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [directories, setDirectories] = useState<DirectoryEntry[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDrivesRoot, setIsDrivesRoot] = useState(false);

  const fetchDirectories = async (path?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = path ? { path } : {};
      const response = await axios.get<BrowseResponse>('http://localhost:3000/browse', { params });
      setCurrentPath(response.data.current);
      setParentPath(response.data.parent);
      setDirectories(response.data.directories);
      setIsDrivesRoot(response.data.isDrivesRoot || false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load directories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDirectories(initialPath || undefined);
    }
  }, [isOpen, initialPath]);

  const handleSelect = () => {
    onSelect(currentPath);
    onClose();
  };

  const handleNavigate = (path: string) => {
    fetchDirectories(path);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] animate-fade-in p-4">
      <div className="bg-[#1c1c1f] border border-border rounded-2xl w-full max-w-xl shadow-2xl animate-scale-in flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-border/40">
          <div>
            <h3 className="text-lg font-semibold">Select Directory</h3>
            <p className="text-xs text-secondary mt-0.5">Navigate and choose a project folder</p>
          </div>
          <button 
            onClick={onClose}
            className="text-secondary hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current Path */}
        <div className="px-5 py-3 bg-surface/30 border-b border-border/30">
          <div className="flex items-center gap-2 text-sm">
            {isDrivesRoot ? (
              <Monitor size={16} className="text-accent flex-shrink-0" />
            ) : (
              <FolderOpen size={16} className="text-accent flex-shrink-0" />
            )}
            <span className="font-mono text-xs text-secondary truncate" title={currentPath}>
              {currentPath}
            </span>
          </div>
        </div>

        {/* Directory List */}
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-secondary">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-red-400 text-sm">
              <p>{error}</p>
              <button 
                onClick={() => fetchDirectories()}
                className="mt-3 text-xs text-accent hover:underline"
              >
                Go to home directory
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {/* Parent directory */}
              {parentPath && (
                <button
                  onClick={() => handleNavigate(parentPath)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-surface/50 transition-colors text-left group"
                >
                  <ChevronUp size={16} className="text-secondary" />
                  <span className="text-sm text-secondary group-hover:text-white">..</span>
                  <span className="text-xs text-secondary/50 ml-auto">Parent folder</span>
                </button>
              )}

              {/* Directories */}
              {directories.length === 0 && !parentPath ? (
                <div className="py-8 text-center text-secondary/50 text-sm">
                  No subdirectories found
                </div>
              ) : (
                directories.map((dir) => {
                  const isDrive = /^[A-Z]:/.test(dir.name);
                  return (
                    <button
                      key={dir.path}
                      onClick={() => handleNavigate(dir.path)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-surface/50 transition-colors text-left group"
                    >
                      {isDrive ? (
                        <HardDrive size={16} className="text-blue-400/70 group-hover:text-blue-400" />
                      ) : (
                        <Folder size={16} className="text-accent/70 group-hover:text-accent" />
                      )}
                      <span className="text-sm text-white truncate flex-1">{dir.name}</span>
                      <ChevronRight size={14} className="text-secondary/40 group-hover:text-secondary" />
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/40 flex justify-between items-center bg-surface/20">
          <p className="text-xs text-secondary">
            Select the folder above and click "Choose"
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-secondary hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSelect}
              disabled={isDrivesRoot}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                isDrivesRoot 
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                  : "bg-accent text-white hover:bg-accent/80"
              )}
            >
              <Check size={16} />
              Choose This Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
