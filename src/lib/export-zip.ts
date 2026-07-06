import JSZip from "jszip";
import type { CodeFramework, StylingOption } from "@/components/ExportDialog";

export interface BuildOptions {
  code: string;
  framework: CodeFramework;
  styling: StylingOption;
  projectName: string;
  /** Multi-screen flows (App Uplift feature A): when 2+ screens carry code,
   *  the React scaffold becomes a multi-page app — one component per screen
   *  under src/screens/ plus an App.tsx shell with a tiny state router that
   *  also provides window.ccNavigate for generated nav elements. */
  screens?: Array<{ name: string; code: string }>;
}

export async function buildExportZip(opts: BuildOptions): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder(opts.projectName) ?? zip;

  if (opts.framework === "html") {
    writeHtmlBundle(folder, opts);
  } else {
    writeReactScaffold(folder, opts);
  }

  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

// ─── React + Vite scaffold ──────────────────────────────────────────────────
// One scaffold serves react / vue / nextjs choices: the generator always
// emits React+Tailwind today, so a Vite + React project is what actually
// runs. Vue / Next.js callers get the same scaffold plus a README note.

function writeReactScaffold(folder: JSZip, opts: BuildOptions) {
  const files = buildReactScaffoldFiles(opts);
  for (const [path, content] of Object.entries(files)) {
    folder.file(path, content);
  }
}

/**
 * The Vite + React scaffold as a flat path → content map. Shared by the ZIP
 * export (above) and the "Open in StackBlitz" action (open-in-stackblitz.ts),
 * so both always ship the identical project.
 */
export function buildReactScaffoldFiles(
  opts: BuildOptions
): Record<string, string> {
  const useTailwind = opts.styling === "tailwind";
  const useStyledComponents = opts.styling === "styled-components";
  const projectName = sanitizeNpmName(opts.projectName);

  // Multi-screen: only kicks in when 2+ screens actually carry code; a single
  // non-empty screen (or none) falls back to the classic single-App layout.
  const codedScreens = (opts.screens ?? []).filter((s) => s.code.trim());
  const multiScreen =
    codedScreens.length > 1 ? buildMultiScreenFiles(codedScreens) : null;

  return {
    ...(multiScreen ?? { "src/App.tsx": opts.code.trim() + "\n" }),
    "src/main.tsx": mainTsx(useTailwind),
    "src/index.css": indexCss(opts.styling),
    "index.html": viteIndexHtml(opts.projectName),
    "vite.config.ts": viteConfig(useTailwind),
    "tsconfig.json": tsconfigJson(),
    "tsconfig.node.json": tsconfigNodeJson(),
    "package.json": packageJson({
      projectName,
      useTailwind,
      useStyledComponents,
    }),
    ".gitignore": gitignore(),
    "README.md": reactReadme(opts),
  };
}

/**
 * Turn a user-facing screen name into a safe PascalCase component/file name.
 * Word tails are lowercased so "HOME" and "Home" collide in `taken` — screen
 * files land on case-insensitive filesystems (Windows/macOS), where Home.tsx
 * and HOME.tsx are the same file. Dedupe appends 2, 3, ...
 */
export function screenComponentName(name: string, taken?: Set<string>): string {
  let base = name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
  if (!base) base = "Screen";
  if (/^\d/.test(base)) base = "Screen" + base;
  if (!taken) return base;
  let candidate = base;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${base}${n}`;
    n += 1;
  }
  taken.add(candidate);
  return candidate;
}

/**
 * Multi-page scaffold: src/screens/<Component>.tsx per screen + an App.tsx
 * shell holding the active screen in state. The shell defines
 * window.ccNavigate(name) — the same hook the preview iframe provides — so
 * generated nav elements keep working in the exported app, matched against
 * screen names case-insensitively.
 */
function buildMultiScreenFiles(
  screens: Array<{ name: string; code: string }>
): Record<string, string> {
  const taken = new Set<string>();
  const entries = screens.map((s) => ({
    displayName: s.name,
    component: screenComponentName(s.name, taken),
    code: s.code.trim() + "\n",
  }));

  const files: Record<string, string> = {};
  for (const e of entries) {
    files[`src/screens/${e.component}.tsx`] = e.code;
  }

  const imports = entries
    .map((e) => `import ${e.component} from "./screens/${e.component}";`)
    .join("\n");
  const registry = entries
    .map((e) => `  ${JSON.stringify(e.displayName)}: ${e.component},`)
    .join("\n");

  files["src/App.tsx"] = `import { useState, useEffect } from "react";
${imports}

const SCREENS: Record<string, () => JSX.Element> = {
${registry}
};

const FIRST_SCREEN = ${JSON.stringify(entries[0].displayName)};

export default function App() {
  const [screen, setScreen] = useState(FIRST_SCREEN);

  useEffect(() => {
    // Generated nav elements call window.ccNavigate("Screen Name").
    (window as unknown as { ccNavigate?: (name: string) => void }).ccNavigate =
      (name) => {
        const wanted = String(name).trim().toLowerCase();
        const match = Object.keys(SCREENS).find(
          (k) => k.trim().toLowerCase() === wanted
        );
        if (match) setScreen(match);
      };
  }, []);

  const Active = SCREENS[screen] ?? SCREENS[FIRST_SCREEN];
  return <Active />;
}
`;

  return files;
}

function mainTsx(_useTailwind: boolean): string {
  return `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`;
}

function indexCss(styling: StylingOption): string {
  if (styling === "tailwind") {
    return `@import "tailwindcss";\n\nhtml, body, #root {\n  min-height: 100vh;\n}\n`;
  }
  return `* { box-sizing: border-box; }\nhtml, body, #root { margin: 0; min-height: 100vh; font-family: system-ui, -apple-system, sans-serif; }\n`;
}

function viteIndexHtml(title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

function viteConfig(useTailwind: boolean): string {
  if (useTailwind) {
    return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
`;
  }
  return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`;
}

function tsconfigJson(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",
        strict: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
        noFallthroughCasesInSwitch: true,
      },
      include: ["src"],
      references: [{ path: "./tsconfig.node.json" }],
    },
    null,
    2
  );
}

function tsconfigNodeJson(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        composite: true,
        skipLibCheck: true,
        module: "ESNext",
        moduleResolution: "bundler",
        allowSyntheticDefaultImports: true,
        strict: true,
      },
      include: ["vite.config.ts"],
    },
    null,
    2
  );
}

interface PackageJsonOpts {
  projectName: string;
  useTailwind: boolean;
  useStyledComponents: boolean;
}

function packageJson(opts: PackageJsonOpts): string {
  const dependencies: Record<string, string> = {
    react: "^19.0.0",
    "react-dom": "^19.0.0",
  };
  if (opts.useStyledComponents) {
    dependencies["styled-components"] = "^6.1.13";
  }

  const devDependencies: Record<string, string> = {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    typescript: "^5.6.3",
    vite: "^6.0.0",
  };
  if (opts.useTailwind) {
    devDependencies["@tailwindcss/vite"] = "^4.0.0";
    devDependencies["tailwindcss"] = "^4.0.0";
  }
  if (opts.useStyledComponents) {
    devDependencies["@types/styled-components"] = "^5.1.34";
  }

  return JSON.stringify(
    {
      name: opts.projectName,
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: {
        dev: "vite",
        // StackBlitz's node template boots with `npm install && npm start`;
        // without a start script the dev server never launches and the
        // preview shows "Starting dev server" forever.
        start: "vite",
        build: "tsc -b && vite build",
        preview: "vite preview",
      },
      stackblitz: {
        startCommand: "npm run dev",
      },
      dependencies,
      devDependencies,
    },
    null,
    2
  );
}

function gitignore(): string {
  return `node_modules\ndist\n.DS_Store\n*.log\n.vite\n`;
}

function reactReadme(opts: BuildOptions): string {
  const stylingLabel =
    opts.styling === "tailwind"
      ? "Tailwind CSS v4"
      : opts.styling === "styled-components"
        ? "styled-components"
        : "plain CSS";

  const frameworkNote =
    opts.framework === "react"
      ? ""
      : `\n> Note: you picked **${opts.framework}** in the export dialog, but the generator currently emits React + Tailwind. This scaffold is Vite + React so the code runs as-is. Future versions will support ${opts.framework} natively.\n`;

  return `# ${opts.projectName}

Exported from CodeCanvas · React 19 + Vite · ${stylingLabel}.
${frameworkNote}
## Run it

\`\`\`bash
pnpm install   # or: npm install / yarn
pnpm dev       # or: npm run dev / yarn dev
\`\`\`

Then open the URL Vite prints (usually http://localhost:5173).

## What's in here

- \`src/App.tsx\` — your generated component (the code you saw in the canvas).
- \`src/main.tsx\` — React 19 root that mounts \`<App />\`.
- \`src/index.css\` — ${
    opts.styling === "tailwind"
      ? "Tailwind v4 entry (single @import line)."
      : "minimal resets."
  }
- \`vite.config.ts\` — Vite + React${opts.styling === "tailwind" ? " + Tailwind" : ""} plugin setup.

Feel free to rename the default export or drop \`App.tsx\` into an existing project.
`;
}

// ─── Standalone HTML bundle ─────────────────────────────────────────────────
// Single file, no install. Uses CDN React + Babel + (optional) Tailwind so
// the user can double-click index.html and see their UI.

function writeHtmlBundle(folder: JSZip, opts: BuildOptions) {
  folder.file("index.html", standaloneHtml(opts));
  folder.file("README.md", htmlReadme(opts));
}

function standaloneHtml(opts: BuildOptions): string {
  const useTailwind = opts.styling === "tailwind";
  const transformed = stripImportsAndDefaultExport(opts.code);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(opts.projectName)}</title>
    <script crossorigin src="https://unpkg.com/react@19/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@19/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
${useTailwind ? `    <script src="https://unpkg.com/@tailwindcss/browser@4"></script>\n` : ""}    <style>
      html, body, #root { margin: 0; min-height: 100vh; font-family: system-ui, -apple-system, sans-serif; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="text/babel" data-presets="react,typescript">
${indent(transformed.code, "      ")}

      ReactDOM.createRoot(document.getElementById("root")).render(
        React.createElement(${transformed.defaultName})
      );
    </script>
  </body>
</html>
`;
}

function htmlReadme(opts: BuildOptions): string {
  return `# ${opts.projectName}

Standalone HTML export from CodeCanvas.

Double-click \`index.html\` to open it in your browser. React, ${opts.styling === "tailwind" ? "Tailwind, " : ""}and Babel are pulled in from CDN, so no install is required.

> Heads up: this uses in-browser Babel for JSX. Fine for prototyping; for production, use the React + Vite ZIP export instead.
`;
}

// Strip `import ... from "..."` lines and rewrite `export default X` to a
// plain declaration so the snippet can run inline under in-browser Babel
// (which has no module resolution).
function stripImportsAndDefaultExport(code: string): {
  code: string;
  defaultName: string;
} {
  let out = code.replace(/^\s*import[^;]*;?\s*$/gm, "");
  let defaultName = "App";

  // 1. `export default function Name(...)` / `export default class Name`.
  //    Check this BEFORE the bare-identifier case so we don't capture
  //    the keyword as the name.
  const fnMatch = out.match(
    /export\s+default\s+(function|class)\s+([A-Za-z_$][\w$]*)/
  );
  if (fnMatch) {
    defaultName = fnMatch[2];
    out = out.replace(/export\s+default\s+/, "");
    return { code: out.trim(), defaultName };
  }

  // 2. `export default Name;` — a bare identifier followed by semicolon or
  //    end-of-line. The trailing `(?=[;\s]*$)` is what stops us from
  //    matching `React` inside `React.memo(...)`.
  const namedMatch = out.match(
    /export\s+default\s+([A-Za-z_$][\w$]*)(?=\s*;|\s*$)/m
  );
  if (namedMatch) {
    defaultName = namedMatch[1];
    out = out.replace(/export\s+default\s+[A-Za-z_$][\w$]*\s*;?/, "");
    return { code: out.trim(), defaultName };
  }

  // 3. Anything else (`export default React.memo(...)`, arrow fn, etc.) —
  //    rewrite as a const assignment so the expression has a name we can
  //    render.
  if (/export\s+default\s+/.test(out)) {
    out = out.replace(/export\s+default\s+/, `const ${defaultName} = `);
  }

  return { code: out.trim(), defaultName };
}

// ─── small utils ────────────────────────────────────────────────────────────

function sanitizeNpmName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "codecanvas-export";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function indent(s: string, prefix: string): string {
  return s
    .split("\n")
    .map((line) => (line.length ? prefix + line : line))
    .join("\n");
}
