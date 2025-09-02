use git2::{Repository, Status, StatusOptions, PushOptions, RemoteCallbacks, Cred, ErrorCode, Config};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::fs;
use anyhow::{Result, anyhow};
use git2::{BranchType};

// Secure credential storage via OS keychain
use keyring::Entry;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitStatus {
    pub branch: String,
    pub modified: Vec<String>,
    pub untracked: Vec<String>,
    pub staged: Vec<String>,
    pub is_git_repo: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitCommit {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: i64,
    // Flags to help UI color commits based on local vs remote
    pub is_on_head: bool,
    pub is_on_upstream: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitConfig {
    pub user_name: Option<String>,
    pub user_email: Option<String>,
    pub is_configured: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitInitResult {
    pub success: bool,
    pub message: String,
    pub needs_config: bool,
    pub git_config: Option<GitConfig>,
}

pub struct GitManager {
    repo: Option<Repository>,
}

impl GitManager {
    pub fn new(repo_path: &Path) -> Self {
        let repo = Repository::open(repo_path).ok();
        Self { repo }
    }

    pub fn is_git_repo(&self) -> bool {
        self.repo.is_some()
    }

    pub fn get_status(&self, _repo_path: &Path) -> Result<GitStatus> {
        let repo = if let Some(ref repo) = self.repo {
            repo
        } else {
            return Ok(GitStatus {
                branch: String::new(),
                modified: Vec::new(),
                untracked: Vec::new(),
                staged: Vec::new(),
                is_git_repo: false,
            });
        };

        // Get current branch - handle unborn branch (newly initialized repo)
        let branch = match repo.head() {
            Ok(head) => head.shorthand().unwrap_or("HEAD").to_string(),
            Err(e) => {
                // Check if it's an unborn branch error
                if e.code() == ErrorCode::UnbornBranch {
                    "main".to_string() // Default to 'main' for new repositories
                } else {
                    return Err(e.into());
                }
            }
        };

        // Get status
        let mut opts = StatusOptions::new();
        opts.include_ignored(false)
            .include_untracked(true)
            .recurse_untracked_dirs(false);

        let statuses = repo.statuses(Some(&mut opts))?;

        let mut modified = Vec::new();
        let mut untracked = Vec::new();
        let mut staged = Vec::new();

        for entry in statuses.iter() {
            let path = entry.path().unwrap_or("").to_string();

            match entry.status() {
                s if s.contains(Status::WT_MODIFIED) => modified.push(path),
                s if s.contains(Status::WT_NEW) => untracked.push(path),
                s if s.contains(Status::INDEX_MODIFIED) => staged.push(path),
                s if s.contains(Status::INDEX_NEW) => staged.push(path),
                _ => {}
            }
        }

        Ok(GitStatus {
            branch,
            modified,
            untracked,
            staged,
            is_git_repo: true,
        })
    }

    pub fn stage_file(&self, file_path: &str) -> Result<()> {
        let repo = self.repo.as_ref().ok_or_else(|| anyhow!("Not a git repository"))?;

        let mut index = repo.index()?;
        index.add_path(Path::new(file_path))?;
        index.write()?;

        Ok(())
    }

    pub fn unstage_file(&self, file_path: &str) -> Result<()> {
        let repo = self.repo.as_ref().ok_or_else(|| anyhow!("Not a git repository"))?;

        let mut index = repo.index()?;
        index.remove_path(Path::new(file_path))?;
        index.write()?;

        Ok(())
    }

    pub fn commit(&self, message: &str) -> Result<String> {
        let repo = self.repo.as_ref().ok_or_else(|| anyhow!("Not a git repository"))?;

        let mut index = repo.index()?;
        // Ensure index is written to disk before creating tree
        index.write()?;
        let tree_id = index.write_tree()?;
        let tree = repo.find_tree(tree_id)?;

        let sig = repo.signature()?;
        
        // Handle initial commit (no parent) vs regular commit (with parent)
        let commit_id = match repo.head() {
            Ok(head) => {
                // Regular commit with parent
                let target = head.target().ok_or_else(|| anyhow!("HEAD has no target"))?;
                let parent = repo.find_commit(target)?;
                repo.commit(
                    Some("HEAD"),
                    &sig,
                    &sig,
                    message,
                    &tree,
                    &[&parent],
                )?
            }
            Err(e) => {
                // Initial commit (no parent) - check if it's an unborn branch
                if e.code() == ErrorCode::UnbornBranch {
                    // Prefer 'main' as default branch reference
                    let head_ref = "refs/heads/main";
                    let id = repo.commit(
                        Some(head_ref),
                        &sig,
                        &sig,
                        message,
                        &tree,
                        &[],
                    )?;
                    // Point HEAD to the new branch explicitly
                    repo.set_head(head_ref)?;
                    id
                } else {
                    return Err(e.into());
                }
            }
        };

        Ok(commit_id.to_string())
    }

    pub fn get_recent_commits(&self, limit: usize) -> Result<Vec<GitCommit>> {
        let repo = self.repo.as_ref().ok_or_else(|| anyhow!("Not a git repository"))?;

        // Check if we have any commits at all (handle unborn branch)
        let mut commits = Vec::new();
        
        match repo.head() {
            Ok(head_ref) => {
                // Determine upstream of current branch if it exists
                let mut upstream_set = std::collections::HashSet::new();
                if let Ok(head_name) = head_ref.shorthand().ok_or_else(|| anyhow!("Invalid HEAD")) {
                    let branch_name = head_name.to_string();
                    let upstream_refname = format!("refs/remotes/origin/{}", branch_name);
                    if let Ok(up_ref) = repo.find_reference(&upstream_refname) {
                        if let Some(up_oid) = up_ref.target() {
                            // Walk remote branch to collect oids (limit to some reasonable size)
                            let mut upwalk = repo.revwalk()?;
                            upwalk.push(up_oid)?;
                            for oid_res in upwalk.take(1000) {
                                if let Ok(oid) = oid_res { upstream_set.insert(oid); }
                            }
                        }
                    }
                }

                // We have commits, proceed normally
                let mut revwalk = repo.revwalk()?;
                revwalk.push_head()?;

                for oid in revwalk.take(limit) {
                    let oid = oid?;
                    let commit = repo.find_commit(oid)?;

                    commits.push(GitCommit {
                        hash: oid.to_string()[..8].to_string(), // Show short hash
                        message: commit.message().unwrap_or("").to_string(),
                        author: commit.author().name().unwrap_or("Unknown").to_string(),
                        timestamp: commit.time().seconds(),
                        is_on_head: true,
                        is_on_upstream: upstream_set.contains(&oid),
                    });
                }
            }
            Err(e) => {
                // No commits yet (unborn branch), return empty list
                if e.code() == ErrorCode::UnbornBranch {
                    // Return empty commits list for newly initialized repos
                } else {
                    return Err(e.into());
                }
            }
        }

        Ok(commits)
    }

    pub fn push(&self, remote_name: &str, branch_name: &str, username: Option<&str>, password: Option<&str>) -> Result<()> {
        let repo = self.repo.as_ref().ok_or_else(|| anyhow!("Not a git repository"))?;

        // Check if there are any commits to push
        if let Ok(head) = repo.head() {
            if head.target().is_none() {
                return Err(anyhow!("No commits to push (repository is empty)"));
            }
        }

        // Find the remote
        let mut remote = match repo.find_remote(remote_name) {
            Ok(r) => r,
            Err(_) => return Err(anyhow!(format!("Remote '{}' not found. Make sure to add the remote first: git remote add {} <url>", remote_name, remote_name))),
        };

        // Resolve credentials: explicit > stored > none
        let stored = load_stored_credentials(repo, remote_name).ok();
        let resolved_username = username
            .map(|s| s.to_string())
            .or_else(|| stored.as_ref().map(|(u, _)| u.clone()));
        let resolved_password = password
            .map(|s| s.to_string())
            .or_else(|| stored.as_ref().map(|(_, p)| p.clone()));

        // Set up callbacks for authentication (support SSH agent, HTTPS with user/pass or PAT, and default creds)
        let mut callbacks = RemoteCallbacks::new();
        callbacks.credentials(move |_url, username_from_url, allowed_types| {
            // If caller provided or stored username/password (or token), prefer that for HTTPS
            if allowed_types.is_user_pass_plaintext() {
                if let (Some(u), Some(p)) = (resolved_username.as_deref(), resolved_password.as_deref()) {
                    return Cred::userpass_plaintext(u, p);
                }
            }
            // Try SSH agent if allowed
            if allowed_types.is_ssh_key() {
                if let Some(u) = username_from_url {
                    if let Ok(cred) = Cred::ssh_key_from_agent(u) { return Ok(cred); }
                }
                if let Some(u) = resolved_username.as_deref() {
                    if let Ok(cred) = Cred::ssh_key_from_agent(u) { return Ok(cred); }
                }
            }
            // Fallback to default credentials (may use OS helpers)
            Cred::default()
        });

        // Set up push options
        let mut push_options = PushOptions::new();
        push_options.remote_callbacks(callbacks);

        // Check if the local branch exists
        let branch_exists = repo.find_branch(branch_name, BranchType::Local).is_ok();
        if !branch_exists {
            return Err(anyhow!("Local branch '{}' does not exist. Create it first: git checkout -b {}", branch_name, branch_name));
        }

        // Push the branch
        let refspec = format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name);
        if let Err(e) = remote.push(&[&refspec], Some(&mut push_options)) {
            let error_msg = e.message();
            if error_msg.contains("authentication") || error_msg.contains("403") || error_msg.contains("401") {
                return Err(anyhow!("Authentication failed. Please check your credentials or Personal Access Token."));
            } else if error_msg.contains("non-fast-forward") {
                return Err(anyhow!("Push rejected - remote branch has diverged. Pull first to merge changes."));
            } else if error_msg.contains("no upstream") {
                return Err(anyhow!("Branch '{}' has no upstream branch set. The push may have succeeded but you should set the upstream: git branch --set-upstream-to=origin/{}", branch_name, branch_name));
            } else {
                return Err(anyhow!("Push failed: {}", error_msg));
            }
        }

        // Try to set upstream if not set yet
        if let Ok(mut branch) = repo.find_branch(branch_name, BranchType::Local) {
            let upstream_ref = format!("{}/{}", remote_name, branch_name);
            let _ = branch.set_upstream(Some(&upstream_ref)); // ignore error if already set
        }

        Ok(())
    }

    pub fn pull(&self, remote_name: &str, _branch_name: &str) -> Result<()> {
        let repo = self.repo.as_ref().ok_or_else(|| anyhow!("Not a git repository"))?;

        // Find the remote
        let mut remote = repo.find_remote(remote_name)?;

        // Set up callbacks for authentication
        let mut callbacks = RemoteCallbacks::new();
        callbacks.credentials(|_url, username_from_url, _allowed_types| {
            Cred::ssh_key_from_agent(username_from_url.unwrap_or("git"))
        });

        // Fetch from remote
        let refspecs = remote.fetch_refspecs()?;
        let refspecs: Vec<&str> = refspecs.iter().filter_map(|s| s).collect();
        remote.fetch(&refspecs, None, None)?;

        // For now, we'll just fetch. Merging would require more complex logic
        // to handle conflicts and different merge strategies
        Ok(())
    }
}

/// Create a keyring entry identifier based on remote URL and username
fn keyring_entry(remote_url: &str, username: &str) -> Result<Entry, keyring::Error> {
    // Use remote URL as service namespace; include app prefix
    let service = format!("agentic-ide:git:{}", remote_url);
    Entry::new(&service, username)
}

/// Load stored credentials (username, token) for a given remote
fn load_stored_credentials(repo: &Repository, remote_name: &str) -> Result<(String, String)> {
    let remote = repo.find_remote(remote_name)?;
    let remote_url = remote.url().ok_or_else(|| anyhow!("Remote URL is missing or invalid"))?;

    // Try common usernames: prefer stored list by probing a few likely usernames
    // We don’t have a way to list keyring entries, so we try a set
    let candidate_users = ["git", "github", "oauth", "token"];
    for user in candidate_users.iter() {
        if let Ok(entry) = keyring_entry(remote_url, user) {
            if let Ok(secret) = entry.get_password() {
                return Ok((user.to_string(), secret));
            }
        }
    }

    Err(anyhow!("No stored credentials found"))
}

/// Save credentials (username + token) to OS keychain for a given remote
pub fn save_git_credentials(repo_path: &Path, remote_name: &str, username: &str, password: &str) -> Result<()> {
    let repo = Repository::open(repo_path)?;
    let remote = repo.find_remote(remote_name)?;
    let remote_url = remote.url().ok_or_else(|| anyhow!("Remote URL is missing or invalid"))?;
    let entry = keyring_entry(remote_url, username)?;
    entry.set_password(password)?;
    Ok(())
}

/// Clear stored credentials for a given remote and username
pub fn clear_git_credentials(repo_path: &Path, remote_name: &str, username: &str) -> Result<()> {
    let repo = Repository::open(repo_path)?;
    let remote = repo.find_remote(remote_name)?;
    let remote_url = remote.url().ok_or_else(|| anyhow!("Remote URL is missing or invalid"))?;
    let entry = keyring_entry(remote_url, username)?;
    // Ignore not found errors
    let _ = entry.delete_password();
    Ok(())
}

/// Check if a directory is already a Git repository
pub fn is_git_repository(repo_path: &Path) -> bool {
    Repository::open(repo_path).is_ok()
}

/// Get Git configuration for the repository
pub fn get_git_config(repo_path: &Path) -> Result<GitConfig> {
    let repo = Repository::open(repo_path)?;
    let config = repo.config()?;
    
    let user_name = config.get_string("user.name").ok();
    let user_email = config.get_string("user.email").ok();
    
    let is_configured = user_name.is_some() && user_email.is_some();
    
    Ok(GitConfig {
        user_name,
        user_email,
        is_configured,
    })
}

/// Set Git configuration for the repository
pub fn set_git_config(repo_path: &Path, name: &str, email: &str) -> Result<()> {
    let repo = Repository::open(repo_path)?;
    let mut config = repo.config()?;
    
    config.set_str("user.name", name)?;
    config.set_str("user.email", email)?;
    
    Ok(())
}

/// Enhanced Git repository initialization with proper setup
pub fn init_git_repo_enhanced(repo_path: &Path) -> Result<GitInitResult> {
    // Check if already a git repository
    if is_git_repository(repo_path) {
        // Already a repository, check configuration
        match get_git_config(repo_path) {
            Ok(config) => {
                if config.is_configured {
                    return Ok(GitInitResult {
                        success: true,
                        message: "Git repository already exists and is properly configured".to_string(),
                        needs_config: false,
                        git_config: Some(config),
                    });
                } else {
                    return Ok(GitInitResult {
                        success: true,
                        message: "Git repository exists but needs user configuration".to_string(),
                        needs_config: true,
                        git_config: Some(config),
                    });
                }
            }
            Err(_) => {
                return Ok(GitInitResult {
                    success: true,
                    message: "Git repository exists but configuration could not be read".to_string(),
                    needs_config: true,
                    git_config: None,
                });
            }
        }
    }

    // Initialize new repository
    match Repository::init(repo_path) {
        Ok(_) => {
            // Create initial .gitignore file with common patterns
            let gitignore_path = repo_path.join(".gitignore");
            let gitignore_content = create_default_gitignore();
            
            if let Err(e) = fs::write(&gitignore_path, gitignore_content) {
                eprintln!("Warning: Could not create .gitignore: {}", e);
            }

            // Check if git is configured globally
            match Config::open_default() {
                Ok(global_config) => {
                    let has_global_name = global_config.get_string("user.name").is_ok();
                    let has_global_email = global_config.get_string("user.email").is_ok();
                    
                    if has_global_name && has_global_email {
                        // Global config exists, repository is ready
                        Ok(GitInitResult {
                            success: true,
                            message: "Git repository initialized successfully with global configuration".to_string(),
                            needs_config: false,
                            git_config: get_git_config(repo_path).ok(),
                        })
                    } else {
                        // No global config, need to set up user info
                        Ok(GitInitResult {
                            success: true,
                            message: "Git repository initialized. Please configure user name and email.".to_string(),
                            needs_config: true,
                            git_config: Some(GitConfig {
                                user_name: None,
                                user_email: None,
                                is_configured: false,
                            }),
                        })
                    }
                }
                Err(_) => {
                    // Could not read global config, assume we need local config
                    Ok(GitInitResult {
                        success: true,
                        message: "Git repository initialized. Please configure user name and email.".to_string(),
                        needs_config: true,
                        git_config: Some(GitConfig {
                            user_name: None,
                            user_email: None,
                            is_configured: false,
                        }),
                    })
                }
            }
        }
        Err(e) => Ok(GitInitResult {
            success: false,
            message: format!("Failed to initialize Git repository: {}", e),
            needs_config: false,
            git_config: None,
        })
    }
}

/// Create a default .gitignore file with common patterns
fn create_default_gitignore() -> String {
    "# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
package-lock.json

# Build outputs
dist/
build/
target/
*.exe
*.dll
*.so
*.dylib

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE and editor files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Logs
*.log
logs/

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Temporary folders
tmp/
temp/
".to_string()
}

/// Configure or update a remote URL
pub fn set_remote(repo_path: &Path, remote_name: &str, url: &str) -> Result<()> {
    let repo = Repository::open(repo_path)?;

    // Check if remote exists first, without borrowing the Remote
    let remote_exists = repo.find_remote(remote_name).is_ok();

    if remote_exists {
        repo.remote_set_url(remote_name, url)?;
    } else {
        repo.remote(remote_name, url)?;
    }

    Ok(())
}

/// Legacy function for backward compatibility
pub fn init_git_repo(repo_path: &Path) -> Result<()> {
    match init_git_repo_enhanced(repo_path) {
        Ok(result) => {
            if result.success {
                Ok(())
            } else {
                Err(anyhow!(result.message))
            }
        }
        Err(e) => Err(e)
    }
}

