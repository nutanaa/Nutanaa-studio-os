# Nutanaa Studio OS — Local Development Runbook

How to run the whole system locally, and how to debug it when something
breaks. Written from the actual issues hit getting this running the
first time — keep this updated as new ones come up.

---

## 1. What you're running

Two separate processes, always both running together:

| Process | What it is | Where it lives |
|---|---|---|
| **Backend** | FastAPI wrapping the Python `runtime/` core (agents, providers, workflows) | `backend/api/main.py` |
| **Editor** | VS Code fork with the Nutanaa sidebar (Agent Explorer, Dashboard, etc.) | `editor/` |

The editor is a **client** of the backend — it does nothing useful on
its own. Always start the backend first.

---

## 2. Prerequisites (one-time setup per machine)

- **Node 24.18.0** for the editor — check with `node -v`. If it doesn't
  match `editor/.nvmrc`, run `nvm use <version-in-.nvmrc>`.
  - Note: this can change if `editor/` is ever re-synced from a
    different VS Code release tag — always re-check `.nvmrc` after a
    `git subtree pull`.
- **Python 3.13** for the backend.
- **Ollama** installed and at least one model pulled:
  ```powershell
  ollama pull llama3.1:8b
  ollama list
  ```
- Python dependencies installed:
  ```powershell
  cd C:\Users\purushotham\git\Nutanaa-studio-os
  pip install -r requirements/base.txt
  ```

---

## 3. Running it — every time

**Terminal 1 — backend** (leave running):
```powershell
cd C:\Users\purushotham\git\Nutanaa-studio-os
ollama serve
```
Leave this terminal open, or if Ollama already runs as a background
service on your machine, skip this step.

**Terminal 2 — backend API** (leave running):
```powershell
cd C:\Users\purushotham\git\Nutanaa-studio-os
uvicorn backend.api.main:app --host 127.0.0.1 --port 8787 --reload
```
Wait for `Nutanaa runtime started; API ready.` before moving on.

**Terminal 3 — editor**:
```powershell
cd C:\Users\purushotham\git\Nutanaa-studio-os\editor
.\scripts\code.bat
```
This is also the **rebuild** command — there's no separate build step.
Every launch recompiles whatever changed since the last one. If a
previous editor window is still open, close it before relaunching.

---

## 4. Verifying the backend is actually working

```powershell
curl.exe http://127.0.0.1:8787/health
curl.exe http://127.0.0.1:8787/providers
curl.exe http://127.0.0.1:8787/agents
```

Send the chat agent a real message (use `Invoke-RestMethod`, not
`curl.exe -d`, for POST bodies — see §6):
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8787/agents/chat-assistant/execute" -Method Post -ContentType "application/json" -Body '{"input": "Say hello in one sentence."}'
```

If that returns real text from your model, backend + provider + agent
are all genuinely working end to end.

---

## 5. In the editor, confirm it's actually connected

- Activity Bar → Nutanaa icon → **Dashboard**: should say
  `Runtime: Connected`. If it says `Connection failed`, the backend
  isn't running or isn't reachable — check Terminal 2.
- **Agent Explorer**: should show `chat-assistant`, not "Not connected."
- If views are missing or scattered into the wrong sidebar/panel: run
  Command Palette (`Ctrl+Shift+P`) → **Reset View Locations**.

---

## 6. Known gotchas (hit these already — don't repeat the debugging)

### PowerShell vs Git Bash
Don't mix shells mid-task. `Test-Path`, `Invoke-RestMethod`,
`Select-String` are PowerShell-only. `./scripts/code.bat` (forward
slash) works in Git Bash; `.\scripts\code.bat` (backslash) is the
PowerShell form — using the wrong slash style in the wrong shell fails
silently with a confusing "command not found."

### Pasting multiple commands at once
Never paste several commands as one block if any of them are meant to
run separately — terminals can silently glue two lines into one
malformed command (this caused the `--squashcp` and the corrupted
`requirements/base.txt` incidents). Run one command, wait for the
prompt to return, then run the next.

### `curl.exe -d` and JSON bodies in PowerShell
PowerShell's own argument parsing mangles escaped `\"` before curl ever
sees it. Use `Invoke-RestMethod -Body '...'` with single quotes
instead — see §4.

### Absolute vs relative paths
When bouncing between `editor/` and the repo root, prefer full paths
(`C:\Users\purushotham\git\Nutanaa-studio-os\...`) over `..\..\` —
easy to miscount directory levels under pressure.

### TypeScript compile errors after editing `contrib/nutanaa`
Read the file path and line number in the error, open exactly that
file, check what changed. Common causes seen so far:
- A `namespace` block accidentally duplicated in `constants.ts`
  (`Cannot redeclare block-scoped variable`) — search for the same
  `namespace` name appearing twice, delete one.
- A `getChildren()` return type mismatch (`readonly X[]` vs `X[]`) —
  usually means the code was written against a different VS Code
  version's interface than what's currently checked out.
- `Cannot find module or type declarations for side-effect import` —
  usually means `editor/` is on a VS Code version that doesn't have a
  file the code expects (see §7, main vs stable release tags).

### Runtime module-not-found errors when *launching* (not compiling)
If TypeScript compiles clean but launching throws
`ERR_MODULE_NOT_FOUND`, try a clean rebuild first:
```powershell
cd editor
Remove-Item -Recurse -Force out, out-build -ErrorAction SilentlyContinue
.\scripts\code.bat
```
Stale build cache causes this more often than an actual missing file.

### Native module build failures (`node-gyp`, `tree-sitter`, C++ errors)
Usually a Node version mismatch against `editor/.nvmrc`. Check both:
```powershell
Get-Content editor\.nvmrc
node -v
```
Fix with `nvm install <version>` then `nvm use <version>`, delete
`node_modules`, reinstall.

---

## 7. `editor/` version policy

`editor/` is tracked as a **git subtree** from `microsoft/vscode`, not
a plain clone — this is what lets new VS Code releases be pulled in
later:
```powershell
git subtree pull --prefix=editor editor-upstream <tag> --squash
```

**Use a stable release tag, not `main`.** `main` is Microsoft's
bleeding-edge branch and can be mid-refactor/broken on any given
commit (this happened once already, with an unfinished `agentHost`
subsystem). Check available tags with:
```powershell
git ls-remote --tags https://github.com/microsoft/vscode.git
```

After ever re-pointing `editor/` at a new tag, your Nutanaa
customizations need to be re-applied on top (they don't survive a
`git rm -r editor` + re-add automatically) — back up
`src/vs/workbench/contrib/nutanaa`, `workbench.desktop.main.ts`'s
activation line, and `product.json` first, every time.

---

## 8. Architecture reminders (why things are wired this way)

- `runtime/` never talks to the editor directly — `backend/api` is the
  only bridge, over HTTP + WebSocket. Any future client (web app,
  mobile app) goes through the same bridge, never a new one.
- Nothing in this system fabricates fake data when something isn't
  connected — providers/agents report themselves honestly as
  unhealthy/empty rather than showing placeholder success. If you see
  a view showing fake-looking data, that's a bug to fix, not a feature
  to preserve.
- `canMoveView: false` locks every Nutanaa view to its container —
  don't flip these back to `true`.