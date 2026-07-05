import { buildReactScaffoldFiles, type BuildOptions } from "@/lib/export-zip";

/**
 * Open the generated project live-editable in StackBlitz via their POST API
 * (https://developer.stackblitz.com/platform/api/post-api). No SDK dependency:
 * we build a hidden form whose fields StackBlitz reads as the project
 * definition, submit it into a new tab, then remove the form.
 *
 * - React/Vue/Next output ships the same Vite + React scaffold as the ZIP
 *   export (template "node" → runs in WebContainers, `npm install && vite`
 *   happens automatically in the browser).
 * - HTML output ships a single index.html on the static "html" template.
 */
export function openInStackBlitz(opts: BuildOptions): void {
  if (opts.framework === "html") {
    submitProject({
      files: { "index.html": opts.code.trim() + "\n" },
      title: opts.projectName,
      template: "html",
      openFile: "index.html",
    });
    return;
  }

  submitProject({
    files: buildReactScaffoldFiles(opts),
    title: opts.projectName,
    template: "node",
    openFile: "src/App.tsx",
  });
}

interface StackBlitzProject {
  files: Record<string, string>;
  title: string;
  template: "node" | "html";
  openFile: string;
}

function submitProject(project: StackBlitzProject): void {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = `https://stackblitz.com/run?file=${encodeURIComponent(project.openFile)}`;
  form.target = "_blank";
  form.style.display = "none";

  const addField = (name: string, value: string) => {
    // Textarea, not <input>: file contents contain newlines and quotes that
    // survive a textarea's value verbatim.
    const field = document.createElement("textarea");
    field.name = name;
    field.value = value;
    form.appendChild(field);
  };

  addField("project[title]", project.title);
  addField("project[description]", "Exported from CodeCanvas");
  addField("project[template]", project.template);
  for (const [path, content] of Object.entries(project.files)) {
    addField(`project[files][${path}]`, content);
  }

  document.body.appendChild(form);
  form.submit();
  form.remove();
}
