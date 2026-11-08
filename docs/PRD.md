# Tab Hoarders: Product Requirements Document

| | |
|---|---|
| Status | **v1.0, signed off by owner on 2026-11-08. Decisions D1-D11 approved.** |
| Owner | gafi |
| Date | 2026-11-08 |
| Platform | Chromium-based desktop browsers, Manifest V3 extension. **Google Chrome is the priority and build target.** Helium is the secondary browser (Side Panel verified). [D11] |

Items marked **[D#]** refer to the decisions in section 12.

---

## 1. Summary

Tab Hoarders is a Chrome extension that adds a persistent sidebar (Chrome Side Panel) holding a tree of arbitrarily nested folders. Folders contain saved URLs. Users can save the current tab into a folder, open any saved URL, and reopen every URL in a folder, all without leaving the page they are on or opening a separate bookmark-manager page.

It borrows the vertical, nested-folder interaction model of Arc Browser. It does not replace Chrome's tab strip (see 3. Non-goals and 10. Constraints).

## 2. Goals and success criteria

**Goals**
1. Make organizing and revisiting groups of URLs a one-click, in-context action.
2. Provide a fast, keyboard-and-mouse friendly tree UI that handles deep nesting.
3. Keep user data local, durable, and recoverable.

**Success criteria (MVP)**
- A user can create a folder, save the current tab into it, and reopen it in under 5 seconds each, from a cold start, with no instructions.
- A tree of 1,000 saved items across 100 folders renders and scrolls without visible lag (see NFR-1).
- Zero data loss across browser restarts, extension reloads, and Chrome updates in the test matrix.
- Install warning lists no host-access permission.

## 3. Non-goals (MVP)

- Replacing or hiding Chrome's native tab strip.
- Forcing the panel to the left side (the user controls this in Chrome settings).
- Live open-tabs list, pinned tabs, spaces/profiles, split view.
- Cross-device sync or any server component.
- Non-Chromium browsers (Firefox, Safari). Scope is Chromium-based browsers only. [D11]
- Search, command palette, keyboard shortcut customization.
- Import/export UI (the data format will be designed to allow it later).
- Tab-group integration, duplicate detection, page snapshots, notes.

## 4. Target user

A power user who keeps many tabs open for ongoing work (research, projects, reading lists) and wants Arc-style organization in Chrome. Comfortable with desktop browsers; no technical knowledge assumed.

## 5. Terminology

| Term | Meaning |
|---|---|
| **Folder** | A named container. Can contain folders and items. Unlimited nesting depth in the data model. |
| **Item** | A saved URL with a title and favicon. Leaf node. |
| **Node** | Folder or item. |
| **Tree** | All nodes, rooted at a single invisible root. |
| **Panel** | The Chrome side panel hosting the UI. |

## 6. User stories

1. As a user, I open the sidebar from the toolbar icon and see my folder tree.
2. As a user, I create folders and subfolders to any depth.
3. As a user, I save the tab I am viewing into a folder.
4. As a user, I click a saved item to go to it.
5. As a user, I open all URLs in a folder (and its subfolders) at once.
6. As a user, I rename, move, reorder, and delete folders and items by drag-and-drop or menu.
7. As a user, I close and reopen Chrome and find my tree unchanged.

## 7. Functional requirements

Priority: **P0** = required for MVP, **P1** = desirable in MVP if cheap, **P2** = post-MVP.

### 7.1 Panel

| ID | Requirement | Pri |
|---|---|---|
| FR-1 | Clicking the extension's toolbar icon opens the side panel. | P0 |
| FR-2 | The panel shows the full tree on open, with each folder's expanded/collapsed state restored. | P0 |
| FR-3 | An empty state explains the first action ("Create a folder" / "Save this tab"). | P0 |
| FR-4 | The panel stays open while the user switches tabs and navigates. | P0 |
| FR-5 | Multiple windows show the same tree. A change in one window appears in the others without a reload. | P0 |

### 7.2 Folders

| ID | Requirement | Pri |
|---|---|---|
| FR-10 | Create a folder at root or inside any folder. | P0 |
| FR-11 | Rename a folder inline. Empty names are rejected. | P0 |
| FR-12 | Delete a folder. If it is non-empty, require confirmation stating how many folders and items will be deleted. | P0 |
| FR-13 | Expand/collapse a folder. Folder state persists. | P0 |
| FR-14 | Nesting depth is not artificially limited. Rendering remains correct at depth 20. | P0 |
| FR-15 | A folder cannot be moved into itself or any of its descendants. | P0 |
| FR-16 | Duplicate folder names are allowed, including as siblings. [D6] | P0 |

### 7.3 Items

| ID | Requirement | Pri |
|---|---|---|
| FR-20 | "Save current tab" saves the active tab of the current window as an item in a chosen folder (default: last used folder, else root). | P0 |
| FR-21 | An item stores URL, title, favicon reference, and creation time. | P0 |
| FR-22 | Only `http:` and `https:` pages can be saved. Others (`chrome://`, `file://`, `about:`, `chrome-extension://`) show a clear "can't save this page" message. [D7] | P0 |
| FR-23 | Clicking an item opens its URL. If a tab in the current window already shows the same page, focus it. Otherwise open a new tab. "Same page" means the same URL, ignoring the `#fragment` and a trailing slash; a different query string is a different page. An exact match is preferred when several tabs qualify. [D1] | P0 |
| FR-24 | Rename an item (edits the stored title only). | P0 |
| FR-25 | Delete an item without confirmation, with a visible Undo for a few seconds. | P1 |
| FR-26 | The same URL may be saved multiple times, in any folders. [D5] | P0 |
| FR-27 | Right-click menu on a page: "Save to Tab Hoarders" (opens a folder picker). | P1 |

### 7.4 Open all

| ID | Requirement | Pri |
|---|---|---|
| FR-30 | "Open all" on a folder opens every item in it, recursively through subfolders, in tree order. [D4] | P0 |
| FR-31 | Tabs are opened in the background (not focused), in the current window. | P0 |
| FR-32 | If the count exceeds 20, ask for confirmation showing the number of tabs. [D8] | P0 |
| FR-33 | Opening is batched so the browser stays responsive. | P0 |

### 7.5 Organization

| ID | Requirement | Pri |
|---|---|---|
| FR-40 | Drag and drop to reorder siblings and to move nodes between folders, with a visible drop indicator showing the target position. | P0 |
| FR-41 | Dropping onto a collapsed folder moves the node into it (appended at the end). | P0 |
| FR-42 | Invalid drops (FR-15) are visibly rejected. | P0 |
| FR-43 | Keyboard navigation of the tree (arrows, Enter, F2 to rename, Delete). | P1 |
| FR-44 | Move via context menu ("Move to...") as a non-drag alternative. | P1 |

### 7.6 Persistence

| ID | Requirement | Pri |
|---|---|---|
| FR-50 | All data is stored locally in the browser profile and survives restarts and extension updates. | P0 |
| FR-51 | Every mutation is saved immediately. There is no manual save. | P0 |
| FR-52 | The stored data carries a schema version so future migrations are possible. | P0 |
| FR-53 | If stored data is unreadable or fails validation, the panel does not overwrite it. It shows an error and keeps the raw data. | P0 |

## 8. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | **Performance:** with 1,000 items / 100 folders, the panel is interactive within 300 ms of opening, and drag interactions stay smooth. |
| NFR-2 | **Reliability:** two quick successive mutations (for example, from two windows) must not lose either. |
| NFR-3 | **Privacy:** no network requests initiated by the extension, no analytics, no remote code. Data never leaves the device. |
| NFR-4 | **Permissions:** minimal set only (see section 10). No host permissions, no content scripts. |
| NFR-5 | **Accessibility:** tree uses proper ARIA tree semantics, visible focus, sufficient color contrast, light and dark mode following the system. |
| NFR-6 | **Compatibility:** the extension is built and tested against current stable Google Chrome on macOS first. Helium is checked as a secondary browser. Other Chromium-based browsers (including Edge) are not tested and not supported in the MVP. Minimum Chromium version to be pinned at implementation (Side Panel requires Chromium 114+). [D11] |
| NFR-7 | **Testability:** tree logic is isolated from Chrome APIs so it can be unit-tested without a browser. |

## 9. Data model (conceptual)

Flat map of nodes keyed by id, plus a small settings record. No nested blob.

| Field | Folder | Item | Notes |
|---|---|---|---|
| `id` | yes | yes | Generated, immutable. |
| `type` | `folder` | `item` | |
| `parentId` | yes | yes | Root children use the root id. |
| `name` / `title` | yes | yes | User-editable. |
| `childIds` (ordered) | yes | no | Defines sibling order. |
| `url` | no | yes | |
| `createdAt` | yes | yes | |
| `expanded` | yes | no | UI state. May be stored separately. |

Top-level record also holds `schemaVersion`. Storage: `chrome.storage.local`, accessed only through one repository module. [D2]

## 10. Constraints and permissions

**Platform constraints (cannot be changed by the extension)**
- The native horizontal tab strip stays visible.
- Panel side (left/right) is the user's Chrome setting.
- The panel opens only after a user action and shares the single side-panel slot with Chrome's built-in panels.
- The Manifest V3 service worker is short-lived and must hold no state in memory.

**Permissions (proposed)**
| Permission | Why |
|---|---|
| `sidePanel` | Host the UI. |
| `storage` | Persist the tree. |
| `tabs` | Read the active tab's URL/title, and find an already-open tab. |
| `favicon` | Show page icons via Chrome's favicon API. |
| `contextMenus` (P1 only) | FR-27. |
| `unlimitedStorage` (only if needed) | Avoid the default storage quota. |

## 11. Out of scope for later consideration

Live tabs list, sync (optionally via `chrome.storage.sync` for small settings only, or a backend), import/export, search, tab groups, duplicate detection, keyboard shortcuts, multi-select, Chrome Web Store publishing assets.

Smaller improvements noted in the M3 review, not a priority: Undo for folder deletes (empty folders currently delete without confirmation or Undo), pausing the Undo timer while hovered, and renaming by double-click or F2.

## 12. Decisions

| # | Decision | Status |
|---|---|---|
| D1 | Items are saved URLs, not live tabs. Click focuses an existing tab with the same URL, else opens a new one. | Approved |
| D2 | Storage: `chrome.storage.local` with our own schema, behind a repository layer. No sync in MVP. | Approved |
| D3 | Stack: TypeScript + Vite-based extension tooling (WXT) + **React**. | Approved (React) |
| D4 | "Open all" is recursive through subfolders. | Approved |
| D5 | Same URL may exist multiple times. | Approved |
| D6 | Duplicate folder names allowed. | Approved |
| D7 | Only `http(s)` pages are saveable. | Approved |
| D8 | Confirm before opening more than 20 tabs. | Approved |
| D9 | Delete: folders confirm when non-empty, items use Undo instead of a dialog. | Approved |
| D10 | MVP excludes the live open-tabs list. | Approved |
| D11 | Browsers: **Google Chrome is the priority and build target.** **Helium** is the secondary browser and stays in scope. Edge was considered and dropped. Helium evidence: the owner ran the probe in `spikes/helium-sidepanel-probe` on 2026-11-08 and the panel opened at 360 px wide. Chrome has not yet been probed; it is checked in M0. | Approved |

## 13. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Users expect Arc's tab-strip replacement and see two tab UIs | Disappointment | State the limitation in the store listing and first-run empty state. |
| Nested drag-and-drop is hard to get right | Schedule and bugs | Use a proven library, write tree-move unit tests first. |
| Concurrent writes from multiple windows overwrite each other | Data loss | Single write path in the repository, re-read before write, covered by a test (NFR-2). |
| Opening many tabs freezes the browser | Poor experience | Background opening, batching, confirmation (FR-31 to FR-33). |
| Storage corruption after a bad migration | Data loss | Schema version, validation, non-destructive failure (FR-52, FR-53). |
| Team is new to extension development | Rework | Spike milestone before feature work. |
| Helium may handle the Side Panel differently from Chrome. Known: its side panel has a fixed 360 px minimum width ([imputnet/helium#673](https://github.com/imputnet/helium/issues/673)). | Features built and tested on Chrome may behave differently in Helium. The tree UI must work at 360 px and wider. | Design the UI for a 360 px minimum. Build and test on Chrome first, then repeat each milestone's manual checks in Helium. The panel opening in Helium is already verified. |

## 14. Milestones

| M | Scope | Exit check |
|---|---|---|
| M0 Spike | Empty extension loads, side panel opens from the icon, a value persists in storage across restart. | Manual check on Chrome first, then Helium. Chrome: icon click opens the panel, panel width noted, storage persists across a browser restart. Helium: panel opening already verified (probe, 2026-11-08); repeat the same checks with the real extension. **Passed 2026-11-08 (owner) in Chrome and Helium:** icon opens the panel, panel is 360 px wide, the open counter kept rising after a full browser restart. |
| M1 Tree core | Pure tree logic and repository, with unit tests. No UI yet. | Unit tests pass, including FR-15. **Met 2026-11-08:** 57 tests pass; owner approved the one-key storage layout. |
| M2 Read-only UI | Render the tree, expand/collapse, empty state. | FR-2, FR-3, FR-13, FR-14. **Passed 2026-11-08 (owner) in Chrome and Helium.** |
| M3 Editing | Create, rename, delete, save current tab, open item. | FR-10 to FR-12, FR-20 to FR-24. **Passed 2026-11-08 (owner) in Chrome and Helium.** FR-23 matching relaxed to "same page" afterwards at the owner's request. |
| M4 Organization | Drag and drop, multi-window sync. | FR-40 to FR-42, FR-5. **Passed 2026-11-08 (owner) in Chrome and Helium**, including live sync between two windows. |
| M5 Open all and hardening | Open all, error states, performance pass, accessibility pass. | FR-30 to FR-33, NFR-1, NFR-5. |

## 15. Test strategy (summary)

- **Unit:** tree operations (add, move, delete, reorder, cycle prevention, ordering), schema validation, URL filtering.
- **Integration:** repository against a mocked `chrome.storage`.
- **End-to-end:** Playwright with the unpacked extension loaded, covering save, open, open all, persistence across restart. Side panel automation is limited, so some panel UI checks may stay manual or run against the panel page opened as a normal tab.
- **Manual matrix:** macOS, Windows, one Chrome version below latest stable, multi-window, large-tree dataset.

## 16. Acceptance of this PRD

The MVP is considered complete when all P0 requirements pass their checks, the milestone exit checks are met, and no known data-loss bug is open.
