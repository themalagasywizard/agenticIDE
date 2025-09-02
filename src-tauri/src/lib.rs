mod git;
mod fs;

use std::path::Path;
use git::{GitManager, GitStatus};
use fs::FileItem;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_os::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_git_status,
      stage_file,
      unstage_file,
      commit_changes,
      get_recent_commits,
      init_git_repo,
      init_git_repo_enhanced,
      get_git_config,
      set_git_config,
      is_git_repository,
      git_push,
      git_pull,
      save_git_credentials_cmd,
      clear_git_credentials_cmd,
      list_directory,
      create_file,
      create_directory,
      rename_path,
      delete_path,
      move_path,
      read_file_content,
      write_file_content
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

// Git Commands
#[tauri::command]
async fn get_git_status(project_path: String) -> Result<GitStatus, String> {
  let git_manager = GitManager::new(Path::new(&project_path));
  match git_manager.get_status(Path::new(&project_path)) {
    Ok(status) => Ok(status),
    Err(e) => Err(format!("Failed to get git status: {}", e)),
  }
}

#[tauri::command]
async fn stage_file(project_path: String, file_path: String) -> Result<(), String> {
  let git_manager = GitManager::new(Path::new(&project_path));
  match git_manager.stage_file(&file_path) {
    Ok(_) => Ok(()),
    Err(e) => Err(format!("Failed to stage file: {}", e)),
  }
}

#[tauri::command]
async fn unstage_file(project_path: String, file_path: String) -> Result<(), String> {
  let git_manager = GitManager::new(Path::new(&project_path));
  match git_manager.unstage_file(&file_path) {
    Ok(_) => Ok(()),
    Err(e) => Err(format!("Failed to unstage file: {}", e)),
  }
}

#[tauri::command]
async fn commit_changes(project_path: String, message: String) -> Result<String, String> {
  let git_manager = GitManager::new(Path::new(&project_path));
  match git_manager.commit(&message) {
    Ok(hash) => Ok(hash),
    Err(e) => Err(format!("Failed to commit: {}", e)),
  }
}

#[tauri::command]
async fn get_recent_commits(project_path: String, limit: usize) -> Result<Vec<git::GitCommit>, String> {
  let git_manager = GitManager::new(Path::new(&project_path));
  match git_manager.get_recent_commits(limit) {
    Ok(commits) => Ok(commits),
    Err(e) => Err(format!("Failed to get commits: {}", e)),
  }
}

#[tauri::command]
async fn init_git_repo(project_path: String) -> Result<(), String> {
  match git::init_git_repo(Path::new(&project_path)) {
    Ok(_) => Ok(()),
    Err(e) => Err(format!("Failed to initialize git repository: {}", e)),
  }
}

#[tauri::command]
async fn init_git_repo_enhanced(project_path: String) -> Result<git::GitInitResult, String> {
  match git::init_git_repo_enhanced(Path::new(&project_path)) {
    Ok(result) => Ok(result),
    Err(e) => Err(format!("Failed to initialize git repository: {}", e)),
  }
}

#[tauri::command]
async fn get_git_config(project_path: String) -> Result<git::GitConfig, String> {
  match git::get_git_config(Path::new(&project_path)) {
    Ok(config) => Ok(config),
    Err(e) => Err(format!("Failed to get git config: {}", e)),
  }
}

#[tauri::command]
async fn set_git_config(project_path: String, name: String, email: String) -> Result<(), String> {
  match git::set_git_config(Path::new(&project_path), &name, &email) {
    Ok(_) => Ok(()),
    Err(e) => Err(format!("Failed to set git config: {}", e)),
  }
}

#[tauri::command]
async fn is_git_repository(project_path: String) -> Result<bool, String> {
  Ok(git::is_git_repository(Path::new(&project_path)))
}

#[tauri::command]
async fn git_push(project_path: String, remote_name: Option<String>, branch_name: Option<String>, username: Option<String>, password: Option<String>) -> Result<(), String> {
  let remote = remote_name.unwrap_or_else(|| "origin".to_string());
  let branch = branch_name.unwrap_or_else(|| "main".to_string());
  
  let git_manager = GitManager::new(Path::new(&project_path));
  match git_manager.push(&remote, &branch, username.as_deref(), password.as_deref()) {
    Ok(_) => Ok(()),
    Err(e) => Err(format!("Failed to push: {}", e)),
  }
}

#[tauri::command]
async fn git_pull(project_path: String, remote_name: Option<String>, branch_name: Option<String>) -> Result<(), String> {
  let remote = remote_name.unwrap_or_else(|| "origin".to_string());
  let branch = branch_name.unwrap_or_else(|| "main".to_string());
  
  let git_manager = GitManager::new(Path::new(&project_path));
  match git_manager.pull(&remote, &branch) {
    Ok(_) => Ok(()),
    Err(e) => Err(format!("Failed to pull: {}", e)),
  }
}

// Store credentials securely in OS keychain
#[tauri::command]
async fn save_git_credentials_cmd(project_path: String, remote_name: Option<String>, username: String, password: String) -> Result<(), String> {
  let remote = remote_name.unwrap_or_else(|| "origin".to_string());
  match crate::git::save_git_credentials(Path::new(&project_path), &remote, &username, &password) {
    Ok(_) => Ok(()),
    Err(e) => Err(format!("Failed to save credentials: {}", e)),
  }
}

// Clear stored credentials
#[tauri::command]
async fn clear_git_credentials_cmd(project_path: String, remote_name: Option<String>, username: String) -> Result<(), String> {
  let remote = remote_name.unwrap_or_else(|| "origin".to_string());
  match crate::git::clear_git_credentials(Path::new(&project_path), &remote, &username) {
    Ok(_) => Ok(()),
    Err(e) => Err(format!("Failed to clear credentials: {}", e)),
  }
}

// File System Commands
#[tauri::command]
async fn list_directory(path: String) -> Result<Vec<FileItem>, String> {
  match fs::list_directory(Path::new(&path)) {
    Ok(items) => Ok(items),
    Err(e) => Err(format!("Failed to list directory: {}", e)),
  }
}

#[tauri::command]
async fn create_file(file_path: String, content: String) -> Result<(), String> {
  match fs::create_file(Path::new(&file_path), &content) {
    Ok(_) => Ok(()),
    Err(e) => Err(format!("Failed to create file: {}", e)),
  }
}

#[tauri::command]
async fn create_directory(dir_path: String) -> Result<(), String> {
  match fs::create_directory(Path::new(&dir_path)) {
    Ok(_) => Ok(()),
    Err(e) => Err(format!("Failed to create directory: {}", e)),
  }
}

#[tauri::command]
async fn rename_path(from: String, to: String) -> Result<(), String> {
  match fs::rename_path(Path::new(&from), Path::new(&to)) {
    Ok(_) => Ok(()),
    Err(e) => Err(format!("Failed to rename: {}", e)),
  }
}

#[tauri::command]
async fn delete_path(path: String) -> Result<(), String> {
  match fs::delete_path(Path::new(&path)) {
    Ok(_) => Ok(()),
    Err(e) => Err(format!("Failed to delete: {}", e)),
  }
}

#[tauri::command]
async fn move_path(from: String, to: String) -> Result<(), String> {
  match fs::move_path(Path::new(&from), Path::new(&to)) {
    Ok(_) => Ok(()),
    Err(e) => Err(format!("Failed to move: {}", e)),
  }
}

#[tauri::command]
async fn read_file_content(file_path: String) -> Result<String, String> {
  match fs::read_file_content(Path::new(&file_path)) {
    Ok(content) => Ok(content),
    Err(e) => Err(format!("Failed to read file: {}", e)),
  }
}

#[tauri::command]
async fn write_file_content(file_path: String, content: String) -> Result<(), String> {
  match fs::write_file_content(Path::new(&file_path), &content) {
    Ok(_) => Ok(()),
    Err(e) => Err(format!("Failed to write file: {}", e)),
  }
}
