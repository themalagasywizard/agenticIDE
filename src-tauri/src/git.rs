use git2::{Repository, Status, StatusOptions};
use serde::{Deserialize, Serialize};
use std::path::Path;
use anyhow::{Result, anyhow};

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

    pub fn get_status(&self, repo_path: &Path) -> Result<GitStatus> {
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

        // Get current branch
        let branch = repo.head()?
            .shorthand()
            .unwrap_or("HEAD")
            .to_string();

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
        let tree_id = index.write_tree()?;
        let tree = repo.find_tree(tree_id)?;

        let head = repo.head()?;
        let parent = repo.find_commit(head.target().unwrap())?;

        let sig = repo.signature()?;
        let commit_id = repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            message,
            &tree,
            &[&parent],
        )?;

        Ok(commit_id.to_string())
    }

    pub fn get_recent_commits(&self, limit: usize) -> Result<Vec<GitCommit>> {
        let repo = self.repo.as_ref().ok_or_else(|| anyhow!("Not a git repository"))?;

        let mut revwalk = repo.revwalk()?;
        revwalk.push_head()?;

        let mut commits = Vec::new();

        for oid in revwalk.take(limit) {
            let oid = oid?;
            let commit = repo.find_commit(oid)?;

            commits.push(GitCommit {
                hash: oid.to_string(),
                message: commit.message().unwrap_or("").to_string(),
                author: commit.author().name().unwrap_or("").to_string(),
                timestamp: commit.time().seconds(),
            });
        }

        Ok(commits)
    }
}

pub fn init_git_repo(repo_path: &Path) -> Result<()> {
    Repository::init(repo_path)?;
    Ok(())
}
