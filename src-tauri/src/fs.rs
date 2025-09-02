use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;
use notify::{Watcher, RecursiveMode, recommended_watcher};
use std::sync::mpsc::channel;
use std::time::Duration;
use anyhow::Result;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileItem {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: Option<u64>,
    pub modified: Option<i64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileOperation {
    pub operation: String,
    pub path: String,
    pub success: bool,
    pub error: Option<String>,
}

pub struct FileWatcher {
    watcher: notify::RecommendedWatcher,
    _handle: std::thread::JoinHandle<()>,
}

impl FileWatcher {
    pub fn new<F>(callback: F) -> Result<Self>
    where
        F: Fn(notify::Event) + Send + 'static,
    {
        let (tx, rx) = channel();

        let mut watcher = recommended_watcher(move |res| {
            match res {
                Ok(event) => {
                    let _ = tx.send(event);
                }
                Err(e) => println!("Watch error: {:?}", e),
            }
        })?;

        let handle = std::thread::spawn(move || {
            loop {
                match rx.recv() {
                    Ok(event) => callback(event),
                    Err(_) => break,
                }
            }
        });

        Ok(Self {
            watcher,
            _handle: handle,
        })
    }

    pub fn watch(&mut self, path: &Path) -> Result<()> {
        self.watcher.watch(path, RecursiveMode::Recursive)?;
        Ok(())
    }

    pub fn unwatch(&mut self, path: &Path) -> Result<()> {
        self.watcher.unwatch(path)?;
        Ok(())
    }
}

pub fn list_directory(path: &Path) -> Result<Vec<FileItem>> {
    let mut items = Vec::new();

    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let metadata = entry.metadata()?;
        let path_str = entry.path().to_string_lossy().to_string();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files (starting with .)
        if name.starts_with('.') {
            continue;
        }

        items.push(FileItem {
            name,
            path: path_str,
            is_directory: metadata.is_dir(),
            size: if metadata.is_file() { Some(metadata.len()) } else { None },
            modified: metadata.modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64),
        });
    }

    // Sort: directories first, then files alphabetically
    items.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });

    Ok(items)
}

pub fn create_file(file_path: &Path, content: &str) -> Result<()> {
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(file_path, content)?;
    Ok(())
}

pub fn create_directory(dir_path: &Path) -> Result<()> {
    fs::create_dir_all(dir_path)?;
    Ok(())
}

pub fn rename_path(from: &Path, to: &Path) -> Result<()> {
    fs::rename(from, to)?;
    Ok(())
}

pub fn delete_path(path: &Path) -> Result<()> {
    if path.is_dir() {
        fs::remove_dir_all(path)?;
    } else {
        fs::remove_file(path)?;
    }
    Ok(())
}

pub fn move_path(from: &Path, to: &Path) -> Result<()> {
    fs::rename(from, to)?;
    Ok(())
}

pub fn read_file_content(file_path: &Path) -> Result<String> {
    let content = fs::read_to_string(file_path)?;
    Ok(content)
}

pub fn write_file_content(file_path: &Path, content: &str) -> Result<()> {
    fs::write(file_path, content)?;
    Ok(())
}
