# Maarij Frontend — Task Fix Plan

> Engineering fix guide for all known issues across completed frontend tasks.
> Generated from staff-engineer audit of M1–M14. May 2026.
> Each section is self-contained and execution-ready.

---

## Table of Contents

- [M1 — useProjectSave.ts](#m1--useprojectsavets)
- [M2 — useVersionHistory.ts](#m2--useversionhistoryts)
- [M3 — Project Rename Not Persisting](#m3--project-rename-not-persisting)
- [M4 — Dashboard Card Actions / Delete / Fallback Insert](#m4--dashboard-card-actions--delete--fallback-insert)
- [M5 — Empty States Structure](#m5--empty-states-structure)
- [M6 — Onboarding Tour](#m6--onboarding-tour)
- [M7 — Profile Page](#m7--profile-page)
- [M10 — Toast System](#m10--toast-system)
- [M14 — Keyboard Shortcuts Hook](#m14--keyboard-shortcuts-hook)

---

## M1 — `useProjectSave.ts`

### Issue 1: Supabase client not memoized

#### 1. Issue
`createClient()` is called bare in the hook body with no memoization. Every render of any component that calls `useProjectSave()` creates a new Supabase client reference.

#### 2. Why it matters
- Every `useCallback` in the hook lists `supabase` as a dependency. Since `supabase` is a new object reference each render, all callbacks (`saveProject`, `updateProject`, etc.) get new references on every render too.
- Any `useEffect` in a consumer that lists these callbacks in its dep array will fire every render instead of only when the logic changes.
- In `useAutoSave` specifically (see Issue 2), this causes the debounce to reset on every render.

#### 3. Root cause
```ts
// WRONG — line 70 of useProjectSave.ts
const supabase = createClient(); // new reference every render
```
The correct pattern is already demonstrated in `useVersionHistory.ts` line 54 but was never applied to `useProjectSave`.

#### 4. Fix
**File:** `src/hooks/useProjectSave.ts`

Add `useMemo` import, then wrap `createClient()`:

```ts
// Add useMemo to imports (line 1)
import { useState, useCallback, useEffect, useRef, useMemo } from "react";

// Replace line 70:
// BEFORE:
const supabase = createClient();

// AFTER:
const supabase = useMemo(() => createClient(), []);
```

Apply the same fix in `useAutoSave` — but see Issue 2 for a better structural fix.

#### 5. How to verify fix
- Open React DevTools Profiler.
- Draw on the canvas to trigger re-renders.
- Confirm `useProjectSave` callbacks are NOT re-created on every render (they should only show as changed when their logic actually changes).
- Auto-save should fire exactly once after 3 seconds of inactivity, not reset on each render.

#### 6. Risk if not fixed
Auto-save debounce is broken. Canvas changes may never actually auto-save if the component is re-rendering frequently (e.g., during active drawing).

---

### Issue 2: `useAutoSave` reinstantiates `useProjectSave` internally

#### 1. Issue
`useAutoSave` calls `useProjectSave()` inside its own body. This creates a completely separate hook instance — with its own state, its own `supabase` client, and callbacks that change reference every render.

#### 2. Why it matters
- The `useEffect` inside `useAutoSave` has `updateProject` in its dep array.
- `updateProject` gets a new reference every render (because the `useProjectSave()` inside is a fresh call).
- The debounce `clearTimeout` + `setTimeout` inside the effect fires **on every render**, not just when canvas data changes.
- In practice, the auto-save never fires during active drawing because each Konva render resets the timer.

#### 3. Root cause
```ts
// useAutoSave — line 251
const { updateProject, isSaving } = useProjectSave(); // fresh instance every call
```
`updateProject` changes reference → `useEffect` dependency changes → timeout resets.

#### 4. Fix
**File:** `src/hooks/useProjectSave.ts`

Change `useAutoSave` to accept `updateProject` as a parameter rather than calling the hook internally. The canonical usage point (canvas page) already has a `useProjectSave` instance — pass `updateProject` down.

```ts
// REPLACE the useAutoSave signature:
export function useAutoSave(
  projectId: string | null,
  canvasData: CanvasData,
  updateProject: (projectId: string, canvasData: CanvasData) => Promise<boolean>,
  delay: number = 3000
) {
  const timeoutRef = useRef<NodeJS.Timeout>(undefined);
  const lastSavedDataRef = useRef<string>("");

  useEffect(() => {
    if (!projectId || projectId.startsWith("temp-") || !canvasData) return;

    const currentDataStr = JSON.stringify(canvasData);
    if (currentDataStr === lastSavedDataRef.current) return;

    const hasContent =
      (canvasData.lines && canvasData.lines.length > 0) ||
      (canvasData.shapes && canvasData.shapes.length > 0);
    if (!hasContent) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      const success = await updateProject(projectId, canvasData);
      if (success) {
        lastSavedDataRef.current = currentDataStr;
      }
    }, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [projectId, canvasData, delay, updateProject]);
}
```

**File:** `src/app/canvas/page.tsx` — find where `useAutoSave` is called and update:
```ts
// BEFORE (whatever the current call looks like):
useAutoSave(projectId, canvasData);

// AFTER — pass updateProject from the existing useProjectSave instance:
const { saveProject, updateProject, updateProjectTitle, isSaving, lastSaved } = useProjectSave();
useAutoSave(currentProjectId, canvasData, updateProject);
```

Note: remove `isSaving` from `useAutoSave`'s return value since the hook no longer holds its own save state.

#### 5. How to verify fix
- Open canvas, draw something, then stop drawing.
- Wait exactly 3 seconds — a save request should appear in DevTools Network tab.
- Continue drawing rapidly — confirm the save does NOT fire every few milliseconds.
- Save should only fire 3 seconds after the last canvas change.

#### 6. Risk if not fixed
Auto-save never triggers during drawing sessions. User work is silently not saved unless they manually press Ctrl+S.

---

### Issue 3: `deleteProject` bypasses the `delete_project()` cascade function

#### 1. Issue
`useProjectSave.deleteProject()` does a raw `.delete()` on the `projects` table directly. The documented `delete_project(project_id uuid)` DB function exists specifically to cascade-delete related `iterations` records.

#### 2. Why it matters
If the `iterations` table FK does not have `ON DELETE CASCADE` in the migration, deleted projects leave orphaned iteration rows in the DB. This wastes storage and can cause FK errors if those iterations are ever referenced.

#### 3. Root cause
```ts
// useProjectSave.ts line 188-205
const { error: deleteError } = await supabase
  .from("projects")
  .delete()
  .eq("id", projectId); // bypasses delete_project() RPC
```

#### 4. Fix
**File:** `src/hooks/useProjectSave.ts` — `deleteProject` function:

```ts
const deleteProject = useCallback(
  async (projectId: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .rpc("delete_project", { project_id: projectId });

      if (deleteError) throw deleteError;
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete project";
      setError(errorMessage);
      console.error("Delete project error:", err);
      return false;
    }
  },
  [supabase]
);
```

Apply the same change to the direct delete call in `dashboard/page.tsx` `handleConfirmDelete` (line ~375):
```ts
// BEFORE:
const deleteRequest = supabase
  .from("projects")
  .delete()
  .eq("id", projectId)
  .select("id")
  .abortSignal(controller.signal);

// AFTER — use the RPC:
const deleteRequest = supabase
  .rpc("delete_project", { project_id: projectId })
  .abortSignal(controller.signal);
```

Note: The RPC response shape differs from `.delete().select("id")`. Remove the `data.length === 0` check and rely on error absence as success signal.

#### 5. How to verify fix
- Create a project, open it, trigger code generation (this creates an `iterations` row).
- Go to dashboard, delete the project.
- In Supabase Studio → Table Editor → `iterations` — confirm no orphaned rows with the deleted `project_id`.

#### 6. Risk if not fixed
Orphaned `iterations` rows accumulate over time. If iterations ever get displayed or queried without project context, this causes ghost data or query errors.

---

### Issue 4: `updated_at` set client-side

#### 1. Issue
`updateProject` manually constructs `updated_at: new Date().toISOString()` on the frontend. This should come from the database.

#### 2. Why it matters
Clock skew between client and server causes incorrect sort order on the dashboard (projects sorted by `updated_at desc`). A client with a slightly wrong clock can make a freshly-saved project appear older than it is.

#### 3. Root cause
```ts
// updateProject — line 134
updated_at: new Date().toISOString(), // client clock, not DB clock
```

#### 4. Fix
**File:** `src/hooks/useProjectSave.ts`

Remove `updated_at` from the update payload — Supabase/Postgres should handle this via a `DEFAULT now()` or a trigger. If the column doesn't auto-update, the correct fix is a Postgres trigger (Bilal's domain), not setting it on the client. For now, removing it is safer than setting a potentially wrong timestamp:

```ts
const updateData: {
  canvas_data: CanvasData;
  thumbnail_url?: string;
} = {
  canvas_data: canvasData,
  // updated_at removed — should be handled by DB trigger
};
```

If this breaks the sort order (projects stop showing as recently updated), Bilal needs to add a `BEFORE UPDATE` trigger on the `projects` table.

#### 5. How to verify fix
- Update a project.
- In Supabase Studio, confirm `updated_at` reflects the server time, not a client timestamp.

#### 6. Risk if not fixed
Dashboard sort order can be incorrect for users with inaccurate system clocks.

---

## M2 — `useVersionHistory.ts`

### Issue 1: `canvas_data: any` throughout

#### 1. Issue
The `canvas_data` field is typed as `any` in `ProjectVersion`, method signatures, and return types. The `CanvasData` type already exists in `useProjectSave.ts` and is the correct type.

#### 2. Why it matters
- No TypeScript errors when malformed data is passed as canvas data.
- Autocomplete doesn't work on canvas data objects.
- Silent bugs when the canvas data shape changes — TypeScript won't flag mismatches.

#### 3. Root cause
`CanvasData` from `useProjectSave.ts` was never imported. The author used `any` as a shortcut.

#### 4. Fix
**File:** `src/hooks/useVersionHistory.ts`

```ts
// Add import at top:
import { type CanvasData } from "@/hooks/useProjectSave";

// Update ProjectVersion interface:
interface ProjectVersion {
  id: string;
  project_id: string;
  version_number: number;
  canvas_data: CanvasData;  // was: any
  generated_code?: string;
  prompt_used?: string | null;
  created_at: string;
  description?: string;
}

// Update UseVersionHistoryReturn interface:
interface UseVersionHistoryReturn {
  // ...
  createVersion: (
    projectId: string,
    canvasData: CanvasData,  // was: any
    description?: string
  ) => Promise<boolean>;
  restoreVersion: (versionId: string) => Promise<CanvasData | null>;  // was: any
  compareVersions: (
    v1Id: string,
    v2Id: string
  ) => Promise<{ v1: CanvasData; v2: CanvasData } | null>;  // was: any
}
```

#### 5. How to verify fix
- Run `pnpm tsc --noEmit` — should produce no new type errors.
- Pass a wrong-shaped object to `createVersion` — TypeScript should now error.

#### 6. Risk if not fixed
Silent data corruption if canvas data format changes. TypeScript offers zero protection on version history operations.

---

### Issue 2: `compareVersions` silently swallows Supabase errors

#### 1. Issue
`compareVersions` destructures only `{ data }` from each Supabase query, discarding the `error` field. If a query fails (e.g., row not found, permission denied), the error is thrown away and the function throws a generic "Version not found" message.

#### 2. Why it matters
When debugging version history issues, the actual Supabase error (RLS policy violation, wrong UUID format, etc.) is invisible. All failures look identical.

#### 3. Root cause
```ts
// compareVersions — line 197
const [{ data: v1 }, { data: v2 }] = await Promise.all([
  supabase.from(versionsTable).select("*").eq("id", v1Id).single(),
  supabase.from(versionsTable).select("*").eq("id", v2Id).single(),
]);
// `error` from each query is never checked
```

#### 4. Fix
**File:** `src/hooks/useVersionHistory.ts` — `compareVersions`:

```ts
const compareVersions = useCallback(
  async (v1Id: string, v2Id: string): Promise<{ v1: CanvasData; v2: CanvasData } | null> => {
    setError(null);
    try {
      const [result1, result2] = await Promise.all([
        supabase.from(versionsTable).select("*").eq("id", v1Id).single(),
        supabase.from(versionsTable).select("*").eq("id", v2Id).single(),
      ]);

      if (result1.error) throw result1.error;
      if (result2.error) throw result2.error;
      if (!result1.data || !result2.data) throw new Error("Version not found");

      return {
        v1: result1.data.canvas_data as CanvasData,
        v2: result2.data.canvas_data as CanvasData,
      };
    } catch (err) {
      const errorMessage = getSupabaseErrorMessage(err, "Failed to compare versions");
      setError(errorMessage);
      console.error("Compare versions error:", errorMessage, err);
      return null;
    }
  },
  [supabase, versionsTable]
);
```

#### 5. How to verify fix
- Call `compareVersions` with a non-existent UUID.
- The `error` state should contain the actual Supabase error message, not just "Version not found".

#### 6. Risk if not fixed
Version comparison failures are undiagnosable in production. Any RLS issue or data problem surfaces as a generic error.

---

### Issue 3: `createVersion` triggers full refetch instead of optimistic update

#### 1. Issue
After inserting a new version, `createVersion` calls `await fetchVersions(projectId)` (line 116) — a second full roundtrip to the DB.

#### 2. Why it matters
The version history panel flickers (loading state) after every checkpoint save. The inserted row is already known at the time of insertion — refetching is unnecessary latency.

#### 3. Root cause
`fetchVersions` is called to refresh the list, but the inserted row's data (minus `version_number` which is DB-generated) is already available client-side.

#### 4. Fix
**File:** `src/hooks/useVersionHistory.ts` — `createVersion`:

```ts
// AFTER successful insert, fetch only the new row instead of all versions:
const { data: newVersion, error: fetchNewError } = await supabase
  .from(versionsTable)
  .select("*")
  .eq("project_id", projectId)
  .order("version_number", { ascending: false })
  .limit(1)
  .single();

if (fetchNewError) throw fetchNewError;

const mapped = {
  ...newVersion,
  description: newVersion?.prompt_used ?? newVersion?.description,
};

setVersions((prev) => [mapped, ...prev]);
// Remove the: await fetchVersions(projectId);
```

#### 5. How to verify fix
- Open version history panel, save a checkpoint.
- The new version should appear immediately at the top without any loading spinner.

#### 6. Risk if not fixed
Minor UX: loading flicker on every checkpoint. Not functionally broken.

---

## M3 — Project Rename Not Persisting

### Issue 1: `handleRenameProject` in dashboard only updates local state

#### 1. Issue
The dashboard's `handleRenameProject` function does an optimistic local state update only. It never calls `updateProjectTitle` from `useProjectSave`. After a page refresh, the original name is restored from the database.

#### 2. Why it matters
This is the definition of a broken feature. Users cannot rename projects. Any rename is silently discarded on reload.

#### 3. Root cause
```ts
// dashboard/page.tsx — line 493
const handleRenameProject = async (id: string, newName: string) => {
  setProjects((current) =>
    current.map((project) =>
      project.id === id ? { ...project, title: newName } : project
    )
  );
  // DB call missing — updateProjectTitle is never called
};
```

#### 4. Fix
**File:** `src/app/dashboard/page.tsx`

First, add `useProjectSave` to the dashboard:
```ts
import { useProjectSave } from "@/hooks/useProjectSave";

// Inside DashboardPage component:
const { updateProjectTitle } = useProjectSave();
```

Then fix `handleRenameProject`:
```ts
const handleRenameProject = async (id: string, newName: string) => {
  const trimmed = newName.trim();
  if (!trimmed) return; // don't save empty titles

  // Optimistic update
  setProjects((current) =>
    current.map((project) =>
      project.id === id ? { ...project, title: trimmed } : project
    )
  );

  // Persist to DB
  const success = await updateProjectTitle(id, trimmed);
  if (!success) {
    // Roll back optimistic update on failure
    setProjects((current) =>
      current.map((project) =>
        project.id === id
          ? { ...project, title: projects.find((p) => p.id === id)?.title ?? project.title }
          : project
      )
    );
  }
};
```

#### 5. How to verify fix
- Rename a project on the dashboard.
- Refresh the page.
- Confirm the new name is still showing.
- Open Supabase Studio → `projects` table — confirm the `title` column was updated.

#### 6. Risk if not fixed
Rename is completely non-functional. Users lose their renames on every refresh. This is a shipped broken feature.

---

### Issue 2: `onRename` prop defined but never used in `ProjectCard`

#### 1. Issue
`ProjectCardProps` includes `onRename: (id: string, newName: string) => void` but the `ProjectCard` component function never destructures or uses it. There is no rename UI in the card.

#### 2. Why it matters
The rename feature has no trigger point in the UI. Even with the DB fix above (Issue 1), users have no way to invoke rename from a project card.

#### 3. Root cause
The prop was defined in the interface but was never implemented in the component body. No inline edit, no context menu item, no rename button.

#### 4. Fix
**File:** `src/components/dashboard/ProjectCard.tsx`

Add an inline-editable title. The simplest production-safe approach: double-click the title to enter edit mode.

```tsx
// Add local edit state inside ProjectCard:
const [isEditing, setIsEditing] = useState(false);
const [editValue, setEditValue] = useState(project.title);
const inputRef = useRef<HTMLInputElement>(null);

// Focus input when editing starts
useEffect(() => {
  if (isEditing) inputRef.current?.select();
}, [isEditing]);

const commitRename = () => {
  setIsEditing(false);
  const trimmed = editValue.trim();
  if (trimmed && trimmed !== project.title) {
    onRename(project.id, trimmed);
  } else {
    setEditValue(project.title); // reset if empty or unchanged
  }
};

// Replace the static title h3 element:
{isEditing ? (
  <input
    ref={inputRef}
    value={editValue}
    onChange={(e) => setEditValue(e.target.value)}
    onBlur={commitRename}
    onKeyDown={(e) => {
      if (e.key === "Enter") commitRename();
      if (e.key === "Escape") { setEditValue(project.title); setIsEditing(false); }
    }}
    onClick={(e) => e.preventDefault()} // prevent card link navigation
    className="w-full truncate bg-transparent text-[13px] font-semibold text-[var(--cc-text-primary)] outline-none ring-1 ring-[var(--cc-accent)] rounded px-0.5"
    maxLength={100}
    aria-label="Rename project"
  />
) : (
  <h3
    className="truncate text-[13px] font-semibold text-[var(--cc-text-primary)] cursor-text"
    title={project.title}
    onDoubleClick={(e) => { e.preventDefault(); setIsEditing(true); }}
  >
    {project.title}
  </h3>
)}
```

Also destructure `onRename` in the component function:
```ts
export default function ProjectCard({
  project,
  onRequestDelete,
  onRename,  // ADD THIS
  onToggleStar,
  isStarred,
  deleteDisabled = false,
}: ProjectCardProps)
```

#### 5. How to verify fix
- Double-click a project title on the dashboard.
- An input field should appear with the current title selected.
- Type a new name, press Enter.
- Confirm name updates in UI.
- Refresh page — confirm new name persists (requires Issue 1 fix above).
- Press Escape during rename — original name should be restored.

#### 6. Risk if not fixed
Rename is a documented completed task (M3) but is completely absent from the UI. It does not exist from the user's perspective.

---

### Issue 3: No input validation in `updateProjectTitle`

#### 1. Issue
`updateProjectTitle` in `useProjectSave.ts` will save an empty string or whitespace-only string as the project title.

#### 2. Why it matters
Empty title strings break the dashboard display and could cause DB constraint violations if a `NOT NULL` check is added later.

#### 3. Root cause
No guard at the hook level.

#### 4. Fix
**File:** `src/hooks/useProjectSave.ts` — `updateProjectTitle`:

```ts
const updateProjectTitle = useCallback(
  async (projectId: string, title: string): Promise<boolean> => {
    const trimmed = title.trim();
    if (!trimmed) return false; // reject empty/whitespace titles

    setIsSaving(true);
    setError(null);
    // ... rest of function uses trimmed
    const { error: updateError } = await supabase
      .from("projects")
      .update({ title: trimmed, updated_at: new Date().toISOString() })
      .eq("id", projectId);
    // ...
  },
  [supabase]
);
```

#### 5. How to verify fix
- Try to rename a project to an empty string or spaces only.
- The save should be rejected silently; the old title should be restored.

#### 6. Risk if not fixed
Empty project titles in the database.

---

## M4 — Dashboard Card Actions / Delete / Fallback Insert

### Issue 1: `handleConfirmDelete` bypasses `delete_project()` RPC

#### 1. Issue
The dashboard delete flow calls `.delete()` directly on the `projects` table. The `delete_project()` DB function documented in CLAUDE_CONTEXT handles cascade deletion of `iterations`. Without it, orphaned `iterations` rows may remain.

#### 2. Why it matters
Each deleted project potentially leaves its version history in the DB. Over time this accumulates. If a cascade is not set up natively on the FK, this is orphaned data that can't be retrieved or properly cleaned.

#### 3. Root cause
See M1 Issue 3. The dashboard delete is a duplicate of the same problem.

#### 4. Fix
**File:** `src/app/dashboard/page.tsx` — `handleConfirmDelete` (around line 365):

```ts
// BEFORE:
const deleteRequest = supabase
  .from("projects")
  .delete()
  .eq("id", projectId)
  .select("id")
  .abortSignal(controller.signal);

const { data, error } = await deleteRequest;

if (error) throw error;
if (!data || data.length === 0) {
  throw new Error("Delete did not remove any records.");
}

// AFTER:
const { error } = await supabase
  .rpc("delete_project", { project_id: projectId })
  .abortSignal(controller.signal);

if (error) throw error;
// RPC success = project + iterations deleted; no row count needed
```

#### 5. How to verify fix
- Create a project, open it, generate code (creates an `iterations` row).
- Delete the project from the dashboard.
- Check Supabase Studio → `iterations` — no row with the deleted project's `project_id` should remain.

#### 6. Risk if not fixed
DB bloat from orphaned iteration records. Potential FK constraint errors if schema is tightened later.

---

### Issue 2: Legacy fallback insert in `handleCreateProject`

#### 1. Issue
`handleCreateProject` has a fallback that inserts using `name` (wrong column):

```ts
// dashboard/page.tsx lines ~237-255
const legacyInsert = await supabase
  .from("projects")
  .insert({
    user_id: user.id,
    name: "Untitled Project", // canonical schema uses "title"
    canvas_data: {},
  })
```

#### 2. Why it matters
- If the canonical insert fails for a non-schema reason (e.g., RLS policy), this fallback creates a project with a null/missing `title` column.
- The column `name` does not exist in the canonical schema — this either silently fails or creates a project that appears as "Untitled Project" on the legacy path but with the wrong DB field.
- The existence of this fallback masks insert errors that should be surfaced to the user.

#### 3. Root cause
Defensive code added during M1 migration was never removed after the schema was confirmed unified.

#### 4. Fix
**File:** `src/app/dashboard/page.tsx` — `handleCreateProject`

Delete the entire fallback block. If the canonical insert fails, surface the error:

```ts
const handleCreateProject = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    const { data: createdProject, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        title: "Untitled Project",
        canvas_data: {},
        framework: "react",
      })
      .select()
      .single();

    if (error) throw error;
    if (!createdProject?.id) return;

    const normalizedProject = normalizeProject(createdProject);
    setProjects((current) => [normalizedProject, ...current]);
    setRecentActivity(recordProjectActivity(normalizedProject.id, "created"));
    router.push(`/canvas?id=${normalizedProject.id}`);
  } catch (error) {
    console.error("Error creating project:", error);
    // Optionally show a toast: toast.error("Failed to create project")
  }
};
```

#### 5. How to verify fix
- Click "New project" — project should be created and you're redirected to canvas.
- In Supabase Studio, confirm the new row has `title = "Untitled Project"` (not null/name).

#### 6. Risk if not fixed
Silent project creation failures. The legacy path creates ambiguous DB state with potentially wrong column usage.

---

### Issue 3: `supabase = createClient()` in dashboard component body

#### 1. Issue
Same as M1 Issue 1 — `supabase` is created fresh on each render in `dashboard/page.tsx` line 76.

#### 2. Why it matters
`fetchProjects` and `persistOnboardingCompletion` callbacks include `supabase` in their deps. Since `supabase` changes reference on every render, these callbacks also change reference every render — defeating the purpose of `useCallback`.

#### 3. Root cause
```ts
// dashboard/page.tsx line 76
const supabase = createClient(); // no useMemo
```

#### 4. Fix
**File:** `src/app/dashboard/page.tsx`

```ts
// Add useMemo to imports, then:
const supabase = useMemo(() => createClient(), []);
```

#### 5. How to verify fix
React DevTools Profiler: confirm `fetchProjects` callback is not recreated on every render.

#### 6. Risk if not fixed
Potential unnecessary re-renders and subtle useCallback dep chain bugs.

---

### Issue 4: Delete errors use inline banner instead of Toast

#### 1. Issue
When a delete fails, `deleteError` state shows an inline alert above the project grid. The rest of the app uses the Toast system for all feedback. This is visually inconsistent and the banner can be visually missed.

#### 2. Why it matters
UX inconsistency — success/error feedback pattern is different between delete and every other operation.

#### 3. Root cause
The Toast system (M10) was implemented separately. The delete error handling predates or was not updated to use it.

#### 4. Fix
**File:** `src/app/dashboard/page.tsx`

Import `useToast` and replace the `deleteError` state with toast calls:

```ts
import { useToast } from "@/components/ui/Toast";

// Inside DashboardPage:
const toast = useToast();

// Remove: const [deleteError, setDeleteError] = useState<string | null>(null);

// In handleConfirmDelete catch block, replace setDeleteError with:
toast.error(
  isAbortError
    ? "Delete timed out. Please try again."
    : "Could not delete the project. Please try again."
);
```

Remove the `deleteError` JSX banner block from the render output (lines ~755-765).

#### 5. How to verify fix
- Simulate a delete failure (e.g., temporarily revoke DB permissions or simulate network error).
- A toast notification should appear bottom-right with the error message.
- No inline banner should appear.

#### 6. Risk if not fixed
Inconsistent error feedback pattern. Minor but visible to users.

---

### Issue 5: `console.debug` left in production

#### 1. Issue
Unconditional `console.debug` calls log project IDs and titles to the browser console:
```ts
// dashboard/page.tsx lines ~346-349
console.debug("[delete-project] optimistic remove", {
  projectId,
  projectTitle: deleteDialogProject.title,
});
```

#### 2. Why it matters
Leaks user data (project names and IDs) to any browser developer tools session. Not appropriate for production.

#### 3. Root cause
Debug logging added during development was never removed.

#### 4. Fix
**File:** `src/app/dashboard/page.tsx`

Delete both `console.debug` blocks (lines ~346-349 and ~389-392). Also delete the `ONBOARDING_DEBUG_KEY` constant and its associated `console.debug` block (lines ~175-186).

The onboarding debug key (`codecanvas:onboarding:debug`) was a developer escape hatch — fine during development, must not ship.

#### 5. How to verify fix
- Open DevTools Console, delete a project — no debug messages should appear.

#### 6. Risk if not fixed
PII (project names) in console logs. Technically a data hygiene issue.

---

## M5 — Empty States Structure

### Issue 1: Single ternary-heavy block for two distinct states

#### 1. Issue
The empty state block in `dashboard/page.tsx` (lines ~771-813) uses nested ternaries to handle both "no projects at all" and "no search results" states from a single JSX tree. The title, body copy, and button action all vary via ternary.

#### 2. Why it matters
Adding a third state (e.g., "projects loading but filtered") requires touching three separate ternary conditions inside one block. The current pattern does not scale.

#### 3. Root cause
Both states were implemented in the same render branch as a shortcut.

#### 4. Fix
**File:** `src/app/dashboard/page.tsx`

Extract the two states as named components or conditional renders:

```tsx
{filteredProjects.length === 0 && (
  projects.length === 0
    ? <EmptyProjectsState onCreateProject={handleCreateProject} />
    : <NoSearchResultsState
        onClearFilters={() => {
          setSearchQuery("");
          setFrameworkFilter("all");
          setDateFilter("all");
          setSortBy("recent");
        }}
      />
)}
```

Each component is a simple function defined at the bottom of the file (or in a separate small file). This makes each state independently editable.

#### 5. How to verify fix
- With no projects: empty state shows "No projects yet" with "Create project" button.
- With projects but active search returning nothing: shows "No projects match these filters" with "Clear filters" button.
- Both states are visually identical to before.

#### 6. Risk if not fixed
Low risk now, technical debt when a third empty state is needed.

---

### Issue 2: "Clear filters" button missing `type="button"`

#### 1. Issue
The clear filters button in the empty state has no `type` attribute. Default button type in a form context is `type="submit"`.

#### 2. Why it matters
If this component is ever wrapped in a form element (possible in future layout changes), the button will submit the form instead of clearing filters.

#### 3. Root cause
Missing attribute. Defensive coding habit.

#### 4. Fix
**File:** `src/app/dashboard/page.tsx` — the clear filters button:

```tsx
<button
  type="button"  // ADD THIS
  onClick={...}
  className="..."
>
  Clear filters
</button>
```

#### 5. How to verify fix
HTML inspector should show `type="button"` on the element.

#### 6. Risk if not fixed
Negligible right now. Fragile against layout changes.

---

## M6 — Onboarding Tour

### Issue 1: No focus trap in `OnboardingTour` dialog

#### 1. Issue
`OnboardingTour.tsx` renders with `role="dialog"` and `aria-modal="true"` but keyboard focus is not trapped inside the tooltip. Tab keypress cycles through the underlying canvas toolbar and page elements while the tour is showing.

#### 2. Why it matters
- Keyboard-only users can escape the modal and interact with the blocked UI.
- Screen reader users will navigate outside the intended dialog scope.
- Accessibility: WCAG 2.4.3 requires focus to be contained in modal dialogs.
- The delete dialog in `dashboard/page.tsx` correctly implements a focus trap — inconsistency makes the app look half-finished.

#### 3. Root cause
The keyboard event handler in `OnboardingTour` only handles Arrow keys and Escape (lines 119-145). There is no Tab handler.

#### 4. Fix
**File:** `src/components/onboarding/OnboardingTour.tsx`

Add a Tab trap to the existing `onKeyDown` effect:

```ts
// Inside the keyboard useEffect, add Tab handling:
if (event.key === "Tab") {
  const dialog = tooltipRef.current;
  if (!dialog) return;

  const focusable = dialog.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])'
  );
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey) {
    if (active === first || !dialog.contains(active)) {
      event.preventDefault();
      last.focus();
    }
  } else {
    if (active === last || !dialog.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }
}
```

Also add initial focus when the tour opens — focus the "Next" or "Finish" button on mount:

```ts
// In the useEffect that runs when isOpen changes:
useEffect(() => {
  if (isOpen && tooltipRef.current) {
    const firstButton = tooltipRef.current.querySelector<HTMLButtonElement>("button");
    firstButton?.focus();
  }
}, [isOpen]);
```

Apply the same fix to the **onboarding prompt dialog** in `dashboard/page.tsx` (lines ~936-1007):
- Add `onKeyDown` handler for Escape (to close) and Tab (to trap focus).
- Add `tabIndex={-1}` to the `motion.div` dialog element.
- Auto-focus the "Skip" or "Start walkthrough" button when it opens.

#### 5. How to verify fix
- Start the onboarding tour.
- Press Tab repeatedly — focus should cycle only through the tooltip buttons (Back, Next/Finish, Skip).
- Focus should never reach the canvas toolbar while the tour is active.
- Press Escape — tour should skip/close.
- Screen reader (NVDA/VoiceOver) should announce the dialog correctly.

#### 6. Risk if not fixed
Broken accessibility for keyboard and screen reader users. For a university FYP demo, this is a visible quality gap.

---

### Issue 2: Clicks pass through backdrop when highlight is active

#### 1. Issue
When `highlightRect` is set, the dark overlay is created via CSS `box-shadow` on the highlight ring element. The full-screen div behind it is transparent with no `onClick` or `pointer-events` interception. Users can click through the overlay onto underlying UI elements.

#### 2. Why it matters
During the tour, users can accidentally click "Run Detection" or other canvas buttons through the overlay. This disrupts the tour flow and can cause unexpected state changes.

#### 3. Root cause
```tsx
// OnboardingTour.tsx line 226-228
{highlightRect ? (
  <div className="absolute inset-0" />  // no pointer capture, no onClick
) : ( ... dark overlay ... )}
```

The highlight ring uses `shadow-[0_0_0_9999px_rgba(0,0,0,0.72)]` which is visual-only. The underlying DOM is fully interactive.

#### 4. Fix
**File:** `src/components/onboarding/OnboardingTour.tsx`

Change the backdrop div to intercept all pointer events, then use `pointer-events: none` on the highlight ring so clicks on the highlighted element still work normally:

```tsx
{/* Full-screen click interceptor — always present when tour is open */}
<div
  className="absolute inset-0"
  onClick={(e) => e.stopPropagation()} // block all backdrop clicks
  aria-hidden="true"
/>

{/* Dark overlay via box-shadow on the highlight ring */}
{highlightRect ? (
  <motion.div
    initial={{ opacity: 0, scale: 0.98 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.98 }}
    className="pointer-events-none absolute rounded-[16px] ring-2 ring-[#FF6B00] shadow-[0_0_0_9999px_rgba(0,0,0,0.72)]"
    style={highlightStyle}
  />
) : (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="absolute inset-0 bg-black/70"
  />
)}
```

Note: `pointer-events-none` on the highlight ring ensures the highlighted element itself is still clickable if intentional interaction is needed (e.g., for "try it yourself" step types).

#### 5. How to verify fix
- Start the onboarding tour.
- Click anywhere on the dark overlay outside the highlight and tooltip.
- Nothing should happen — no canvas actions should fire.
- The tooltip and highlighted element should remain visible.

#### 6. Risk if not fixed
Users accidentally trigger canvas actions during onboarding. This can leave the canvas page in an unexpected state (code panel open, tool changed) while the tour is still running.

---

### Issue 3: One-frame tooltip position flash on step change

#### 1. Issue
On each step transition, the tooltip briefly renders at `top: 50%, left: 50%` (screen center) before jumping to its computed position. This is because `tooltipPos` is null until the `useEffect` runs after the first paint.

#### 2. Why it matters
Visible flicker on every step advance. Makes the tour feel janky, especially on slower devices.

#### 3. Root cause
Three sequential effects:
1. `highlightRect` is computed when step changes.
2. `tooltipPos` is computed after `highlightRect` is set AND the tooltip DOM has rendered (needs `getBoundingClientRect`).
3. The first render always uses the fallback `top: 50%` position.

#### 4. Fix
**File:** `src/components/onboarding/OnboardingTour.tsx`

Hide the tooltip until `tooltipPos` is computed. Use `opacity-0` for the initial frame so layout is still computed but it's invisible:

```tsx
<motion.div
  ref={tooltipRef}
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: tooltipPos ? 1 : 0, y: tooltipPos ? 0 : 8 }}
  // ...rest of props
  style={{
    top: tooltipPos?.top ?? "50%",
    left: tooltipPos?.left ?? "50%",
    transform: tooltipPos ? "none" : "translate(-50%, -50%)",
  }}
>
```

This makes the tooltip invisible on the first frame (before position is calculated) and visible only once the position is known. The transition from opacity-0 to opacity-1 is already handled by Framer Motion's animate prop.

#### 5. How to verify fix
- Advance through each tour step.
- The tooltip should fade in at the correct position without any center-screen flash.

#### 6. Risk if not fixed
Visual quality issue only. Not functionally broken.

---

### Issue 4: Three localStorage keys for onboarding state

#### 1. Issue
The dashboard uses three separate localStorage keys to track whether a user has seen/completed onboarding:
- `codecanvas:onboarding:seen:{userId}`
- `codecanvas:onboarding:pending:{userId}`
- `codecanvas:onboarding:local:{userId}`

The condition to show the prompt requires ALL four signals to be false (including DB flag). Resetting onboarding for testing requires clearing multiple keys.

#### 2. Why it matters
- Difficult to reason about which key controls what.
- `seen` and `local` serve effectively the same purpose — both suppress the prompt.
- Two writes happen on skip (`setItem(seenKey)` AND `setItem(localKey)`) where one would do.
- If the logic ever needs to be changed, the author has to trace through all four conditions.

#### 3. Root cause
Keys were added incrementally without consolidating the state.

#### 4. Fix
**File:** `src/app/dashboard/page.tsx`

Consolidate to two keys only: `pending` (user opted in, waiting to start tour on canvas) and `dismissed` (user dismissed/completed, never show again):

```ts
const ONBOARDING_PENDING_KEY = `codecanvas:onboarding:pending:${userId}`;
const ONBOARDING_DISMISSED_KEY = `codecanvas:onboarding:dismissed:${userId}`;

// Show prompt when:
// - DB says not completed AND
// - Not already dismissed locally AND
// - Not already pending (already in progress)
const showPrompt =
  !profileCompleted &&
  !localStorage.getItem(ONBOARDING_DISMISSED_KEY) &&
  !localStorage.getItem(ONBOARDING_PENDING_KEY);

// On "Start walkthrough":
localStorage.setItem(ONBOARDING_PENDING_KEY, "true");

// On "Skip" / "Finish":
localStorage.removeItem(ONBOARDING_PENDING_KEY);
localStorage.setItem(ONBOARDING_DISMISSED_KEY, "true");
void persistOnboardingCompletion();
```

Remove `ONBOARDING_STORAGE_PREFIX`, `ONBOARDING_LOCAL_PREFIX`, and `ONBOARDING_DEBUG_KEY` constants entirely.

#### 5. How to verify fix
- New user sees onboarding prompt on first dashboard load.
- Clicking "Skip" suppresses it permanently.
- Clicking "Start walkthrough" redirects to canvas and does NOT show the prompt again on return.
- Debug: clearing `codecanvas:onboarding:dismissed:{userId}` and resetting DB flag should re-show the prompt.

#### 6. Risk if not fixed
Onboarding prompt logic is fragile and hard to maintain. Any future changes to the flow require understanding four interacting keys.

---

## M7 — Profile Page

### Issue 1: `window.location.reload()` after save

#### 1. Issue
After a successful profile save, the page calls `setTimeout(() => { window.location.reload(); }, 1500)`. This causes a full page reload 1.5 seconds after the success message appears.

#### 2. Why it matters
- Full reload = loading flash, network roundtrips, loss of any unsaved state.
- The state is already updated on line 169: `setProfile(updatedProfile)`.
- React state is already correct — the reload is completely redundant.
- From a UX perspective: success message disappears during reload; the user sees the page flash blank.

#### 3. Root cause
```ts
// profile/page.tsx lines 174-176
setTimeout(() => {
  window.location.reload();
}, 1500);
```

#### 4. Fix
**File:** `src/app/profile/page.tsx` — `handleSubmit` success block:

Delete the `setTimeout` + `window.location.reload()` call entirely. The profile state is already updated via `setProfile(updatedProfile)`. Optionally reset `avatarFile` to null (already done on line 171).

```ts
// Keep only this from the success block:
setProfile(updatedProfile);
setAvatarFile(null);
setAvatarUrl(updatedProfile.avatar_url || "");  // sync display URL to saved URL
setMessage({ type: "success", text: "Profile updated successfully!" });
// REMOVE: setTimeout(() => { window.location.reload(); }, 1500);
```

#### 5. How to verify fix
- Update the profile.
- Success toast/message appears.
- Page does NOT reload.
- The new name/avatar is immediately reflected in the UI.

#### 6. Risk if not fixed
Poor UX. Every profile save causes a jarring page flash. Users lose scroll position and any other in-progress state.

---

### Issue 2: Profile page uses a custom header layout instead of `DashboardLayout`

#### 1. Issue
The profile page renders its own header (lines 210-239) with a "← Dashboard" back link and standalone logo, instead of wrapping in `DashboardLayout` like every other authenticated page.

#### 2. Why it matters
- When a user navigates to Profile, the sidebar disappears. They can't jump to Dashboard, Canvas, or other pages without going back first.
- Navigation pattern is inconsistent — the user loses orientation.
- Any global layout changes (sidebar updates, nav items added) need to be separately applied to this page.

#### 3. Root cause
The profile page was built independently without extending `DashboardLayout`.

#### 4. Fix
**File:** `src/app/profile/page.tsx`

Wrap the main content in `DashboardLayout` and remove the bespoke header:

```tsx
import DashboardLayout from "@/components/dashboard/DashboardLayout";

// Remove the <header>...</header> block (lines 210-239)
// Replace the wrapping div structure with:

return (
  <DashboardLayout>
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div ...>
        {/* existing content without the header */}
      </motion.div>
    </div>
  </DashboardLayout>
);
```

#### 5. How to verify fix
- Navigate to Profile from the dashboard.
- The sidebar should remain visible.
- Navigation to Dashboard/Canvas from the sidebar should work while on Profile page.

#### 6. Risk if not fixed
Broken navigation UX. Users feel "lost" when visiting profile settings. Any sidebar changes need duplicate updates.

---

### Issue 3: `Profile` interface expects columns not in documented schema

#### 1. Issue
`profile/page.tsx` defines:
```ts
interface Profile {
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}
```
The `profiles` table per `CLAUDE_CONTEXT.md` only documents `id` and `onboarding_completed`. The profile page silently gets nulls for all fields if these columns don't exist.

#### 2. Why it matters
If `/api/profile` returns data from `auth.users` (which does have `email`, `created_at`) and a separate query to `profiles` (which has `id`, `onboarding_completed`), the merge might not include `full_name` or `avatar_url` unless those columns were added to the DB without updating the context doc.

This is also a documentation gap that could cause the next engineer to create a DB migration thinking these columns are missing.

#### 3. Root cause
Schema documentation in CLAUDE_CONTEXT is incomplete, OR the profile page assumes columns that were never added.

#### 4. Fix (two-part)

**Part A — Verify the actual DB schema:**
Run in Supabase SQL Editor:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
```

If `full_name` and `avatar_url` DO exist: Update `CLAUDE_CONTEXT.md` to document them. No code change needed.

If they DO NOT exist: Add the migration (this is Bilal's domain — flag it as a blocking dependency):
```sql
ALTER TABLE profiles
  ADD COLUMN full_name TEXT,
  ADD COLUMN avatar_url TEXT;
```

**Part B — Update the `Profile` interface** to match reality once confirmed:
```ts
interface Profile {
  id: string;
  email: string;           // from auth.users via API
  full_name: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}
```

#### 5. How to verify fix
- Load the profile page, open DevTools Network tab.
- Inspect the `/api/profile` response — it should return all fields listed in the interface.
- No field should be null due to missing columns.

#### 6. Risk if not fixed
Profile page silently shows empty name and avatar with no error. User thinks the feature is broken.

---

### Issue 4: Blob URL never revoked after avatar preview

#### 1. Issue
When a user selects a file for avatar upload, a blob URL is created via `URL.createObjectURL(file)` (line 91) and stored in `avatarUrl` state. This URL is never revoked — not on save, not on component unmount.

#### 2. Why it matters
Every file selection creates a new in-memory blob object that is never freed. In a long browser session where a user uploads and re-uploads multiple times, this accumulates in memory. Browsers garbage-collect these eventually but only when all references are gone.

#### 3. Root cause
```ts
const previewUrl = URL.createObjectURL(file);
setAvatarUrl(previewUrl);
// URL.revokeObjectURL(previewUrl) never called
```

#### 4. Fix
**File:** `src/app/profile/page.tsx`

Use a ref to track the current blob URL and revoke it when it changes or the component unmounts:

```ts
const blobUrlRef = useRef<string | null>(null);

// In handleFileChange, revoke previous blob before creating new one:
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    // validation checks...

    // Revoke previous preview
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    setAvatarFile(file);
    const previewUrl = URL.createObjectURL(file);
    blobUrlRef.current = previewUrl;
    setAvatarUrl(previewUrl);
    setMessage(null);
  }
};

// Cleanup on unmount:
useEffect(() => {
  return () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }
  };
}, []);

// After successful save, revoke the blob and clear the ref:
setAvatarFile(null);
if (blobUrlRef.current) {
  URL.revokeObjectURL(blobUrlRef.current);
  blobUrlRef.current = null;
}
setAvatarUrl(updatedProfile.avatar_url || "");
```

#### 5. How to verify fix
- Open DevTools → Memory tab.
- Select avatars multiple times without saving.
- Confirm blob URL count does not grow unboundedly.

#### 6. Risk if not fixed
Memory leak in long-lived sessions with repeated avatar selection. Minor in practice but a real bug.

---

### Issue 5: `createClient()` not memoized in profile page

#### 1. Issue
Same pattern as M1/M4 — `const supabase = createClient()` at the top of the component body with no `useMemo`.

#### 2. Why it matters
In `profile/page.tsx`, `supabase` is used in `handleLogout` but not in any `useCallback` or `useEffect` dep array directly. Impact here is lower than on the dashboard, but it's still an inconsistent pattern that should be fixed for correctness.

#### 3. Fix
**File:** `src/app/profile/page.tsx`

```ts
import { useState, useEffect, useMemo } from "react";
// ...
const supabase = useMemo(() => createClient(), []);
```

---

## M10 — Toast System

**Verdict: Solid implementation. No functional issues.**

The Toast system is the best-written piece of code in this task batch. The provider pattern, ARIA attributes, timer cleanup, spring animations, and dismiss API are all implemented correctly.

### Minor: Redundant `aria-live` on `role="alert"` elements

#### 1. Issue
Toast items with `role="alert"` also have `aria-live="assertive"`. `role="alert"` already implies an assertive live region per the ARIA spec. The attribute is not wrong — it's redundant.

#### 2. Fix
This does not need to be fixed. It's harmless and some older screen readers benefit from the explicit attribute. Leave it as-is.

---

## M14 — Keyboard Shortcuts Hook

### Issue 1: `handlers` object in `useEffect` deps causes listener re-attach every render

#### 1. Issue
`useCanvasShortcuts` accepts a `handlers` object and lists it as the sole `useEffect` dependency. If the calling component creates this object as an inline literal on each render (which `canvas/page.tsx` does), the `handlers` reference changes every render — triggering a `removeEventListener` + `addEventListener` cycle on every render.

#### 2. Why it matters
- Wasteful: a `window` event listener is torn down and recreated on every canvas render.
- Fragile: any async handler fired between removal and re-addition is silently dropped.
- During high-frequency Konva renders (drawing), keyboard shortcuts could theoretically be missed.

#### 3. Root cause
```ts
// useCanvasShortcuts.ts line 89-90
useEffect(() => { ... }, [handlers]); // object literal = new ref every render
```

#### 4. Fix
**File:** `src/hooks/useCanvasShortcuts.ts`

Use a ref to always hold the latest handlers without them being in the dep array:

```ts
export function useCanvasShortcuts(handlers: CanvasShortcutHandlers) {
  const handlersRef = useRef(handlers);

  // Keep the ref current without re-registering the listener
  useEffect(() => {
    handlersRef.current = handlers;
  }); // no dep array = runs after every render, just updates the ref

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const h = handlersRef.current; // always latest handlers, no stale closure

      if (isEditableTarget(e.target)) return;

      const mod = e.ctrlKey || e.metaKey;

      if (e.key === "?" && !mod) {
        e.preventDefault();
        h.onToggleShortcuts();
        return;
      }
      // ... rest of handler uses h instead of handlers
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []); // empty deps = register once, never re-attach
}
```

This is the canonical React pattern for event listeners that need access to current props/state without stale closure and without re-registering.

#### 5. How to verify fix
- React DevTools Profiler: confirm `window` event listener is NOT re-registered on canvas renders.
- All keyboard shortcuts should work identically to before.

#### 6. Risk if not fixed
Keyboard shortcuts work correctly in normal usage. The risk is shortcut misses during very high-frequency rendering (active drawing). Low probability but the fix is minimal.

---

## Fix Priority Order

Execute in this order to avoid dependency issues:

| Priority | Task | Reason |
|----------|------|--------|
| 🔴 P0 | M3 Issue 1 — rename not persisting | Broken shipped feature |
| 🔴 P0 | M7 Issue 1 — `window.location.reload()` | Active UX regression |
| 🔴 P0 | M4 Issue 2 — legacy fallback insert | Wrong column name, schema risk |
| 🟠 P1 | M1 Issue 2 — useAutoSave debounce broken | Auto-save may not fire |
| 🟠 P1 | M3 Issue 2 — onRename not wired in ProjectCard | Rename has no UI trigger |
| 🟠 P1 | M6 Issue 1 — no focus trap in onboarding tour | Accessibility violation |
| 🟠 P1 | M6 Issue 2 — clicks pass through backdrop | Tour can be disrupted |
| 🟡 P2 | M1 Issues 1,3,4 — Supabase client, cascade delete, client timestamp | Correctness issues |
| 🟡 P2 | M4 Issues 1,3,4,5 — delete RPC, useMemo, toast errors, debug logs | Correctness + hygiene |
| 🟡 P2 | M7 Issues 2,3,4 — layout, schema, blob leak | UX consistency + hygiene |
| 🟢 P3 | M2 Issues 1,2,3 — types, error handling, refetch | Quality improvements |
| 🟢 P3 | M6 Issues 3,4 — tooltip flash, onboarding keys | Polish |
| 🟢 P3 | M14 Issue 1 — handlers ref pattern | Performance hygiene |
| 🟢 P3 | M5 Issues 1,2 — empty state structure, button type | Code quality |

---

*End of fix plan. All fixes are scoped to existing files with no architecture changes.*
