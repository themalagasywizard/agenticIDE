# How to Run the IDE with Real File System Operations

## The Issue

If you're seeing mock data instead of real files and folders, it means the application is not running in Tauri mode. This happens when you run the app with `npm run dev` instead of `npm run tauri:dev`.

## Solution

To see real file system operations (actual files and folders), you must run the application in Tauri mode:

### ✅ Correct Way (Use Real File System)
```bash
npm run tauri:dev
```

### ❌ Incorrect Way (Uses Mock Data)
```bash
npm run dev
```

## What's the Difference?

- `npm run dev` - Runs only the frontend in the browser using Vite. This mode uses mock data because Tauri APIs are not available in a regular browser.
- `npm run tauri:dev` - Runs the full Tauri application (frontend + backend). This mode can access the real file system through Tauri's Rust backend.

## How to Verify It's Working

When running with `npm run tauri:dev`, check the browser console (F12). You should see:

✅ **Good signs (real file system):**
```
Tauri detection check: { hasTauriInternals: true, ... }
✅ Tauri FS successfully returned entries: [...]
✅ Tauri FS successfully returned content, length: 1234
```

❌ **Bad signs (mock data):**
```
Tauri not detected! Make sure you're running the app with "npm run tauri:dev"
🔄 Falling back to mock readDir for path: ...
Tauri fs API not available in development mode - returning mock content
```

## Building for Production

For production builds:
```bash
npm run tauri:build
```

This will create a standalone executable that always uses real file system operations.
