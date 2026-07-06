/**
 * Iframe document builders for rendering generated code, shared between the
 * canvas LivePreview panel and the public share-link viewer (/p/[id]).
 *
 * NOTE: backend/app/utils/fidelity.py contains Python ports of these builders
 * (Decision #25). If you change the wrapper HTML here, mirror it there, or the
 * fidelity score stops measuring what the user actually sees.
 */

export type PreviewLanguage = "html" | "react" | "vue";

/**
 * Element↔Code Linker bridge (App Uplift feature C). Generated code carries
 * data-cc-id="cc-N" attributes (stamped by the Gemini prompt, N = component
 * number in the detection list). This script makes the rendered preview
 * interactive both ways:
 *  - click inside the preview → posts {type:"cc-element-click", ccId} to the
 *    parent, which scrolls/flashes the matching code in Monaco;
 *  - {type:"cc-highlight", ccId} from the parent → scrolls the element into
 *    view and flashes an outline on it.
 */
function linkerScript(parentOrigin: string): string {
  return `<script>
  (function () {
    // Multi-screen flows (feature A): generated code calls window.ccNavigate
    // ("Screen Name") from nav elements whose label names another screen. The
    // parent (LivePreview -> canvas page) switches the active screen tab.
    // Defined unconditionally so single-screen code that never calls it is
    // unaffected and multi-screen code never hits a ReferenceError.
    window.ccNavigate = function (screenName) {
      window.parent.postMessage(
        { type: 'cc-navigate', screen: String(screenName || '') },
        '${parentOrigin}'
      );
    };

    // INSPECT mode gate: clicks only map to code while the user has toggled
    // INSPECT on in the preview toolbar. Otherwise the preview behaves like a
    // normal page (typing in inputs, pressing buttons never jumps to code).
    var ccInspect = false;
    var hoverEl = null;

    function clearHover() {
      if (hoverEl) {
        hoverEl.style.outline = hoverEl.__ccPrevOutline || '';
        hoverEl.style.outlineOffset = hoverEl.__ccPrevOffset || '';
        hoverEl = null;
      }
    }

    document.addEventListener('click', function (e) {
      if (!ccInspect) return;
      var t = e.target;
      var el = t && t.closest ? t.closest('[data-cc-id]') : null;
      if (!el) return;
      // Inspecting, not using: suppress the element's own behaviour.
      e.preventDefault();
      e.stopPropagation();
      window.parent.postMessage(
        { type: 'cc-element-click', ccId: el.getAttribute('data-cc-id') },
        '${parentOrigin}'
      );
    }, true);

    document.addEventListener('mouseover', function (e) {
      if (!ccInspect) return;
      var t = e.target;
      var el = t && t.closest ? t.closest('[data-cc-id]') : null;
      if (el === hoverEl) return;
      clearHover();
      if (!el) return;
      el.__ccPrevOutline = el.style.outline;
      el.__ccPrevOffset = el.style.outlineOffset;
      el.style.outline = '2px dashed #4A4B8C';
      el.style.outlineOffset = '2px';
      hoverEl = el;
    }, true);

    window.addEventListener('message', function (e) {
      if (e.origin !== '${parentOrigin}') return;
      var d = e.data || {};
      if (d.type === 'cc-inspect-mode') {
        ccInspect = !!d.enabled;
        document.documentElement.style.cursor = ccInspect ? 'crosshair' : '';
        document.body && (document.body.style.cursor = ccInspect ? 'crosshair' : '');
        if (!ccInspect) clearHover();
        return;
      }
      if (d.type === 'cc-get-rects') {
        // Annotate-on-render (feature B): report every tagged element's
        // viewport-relative box so the parent can resolve which components a
        // drawn markup covers. getBoundingClientRect is viewport-relative,
        // which matches the parent's stroke coordinates (both are measured
        // against the iframe's visible box).
        var rects = [];
        var els = document.querySelectorAll('[data-cc-id]');
        for (var i = 0; i < els.length; i++) {
          var r = els[i].getBoundingClientRect();
          rects.push({
            ccId: els[i].getAttribute('data-cc-id'),
            tag: els[i].tagName.toLowerCase(),
            x: r.left, y: r.top, width: r.width, height: r.height
          });
        }
        var de = document.documentElement;
        window.parent.postMessage(
          { type: 'cc-rects', requestId: d.requestId, rects: rects,
            scrollX: window.scrollX, scrollY: window.scrollY,
            docWidth: Math.max(de.scrollWidth, de.clientWidth),
            docHeight: Math.max(de.scrollHeight, de.clientHeight) },
          '${parentOrigin}'
        );
        return;
      }
      if (d.type !== 'cc-highlight' || !d.ccId) return;
      var el = document.querySelector('[data-cc-id="' + d.ccId + '"]');
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var prevOutline = el.style.outline;
      var prevOffset = el.style.outlineOffset;
      el.style.outline = '2px solid #4A4B8C';
      el.style.outlineOffset = '2px';
      setTimeout(function () {
        el.style.outline = prevOutline;
        el.style.outlineOffset = prevOffset;
      }, 1600);
    });
  })();
  </script>`;
}

/**
 * Gemini sometimes wraps its answer in a markdown code fence (```jsx ... ```)
 * or prefixes a line of prose. Extract the fenced body so we never feed a
 * stray ``` into Babel (which would throw a syntax error). No-op when there
 * is no fence.
 */
export function stripCodeFences(raw: string): string {
  const fenceMatch = raw.match(/```(?:[\w-]*)?\s*\n([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1];
  // Defensive: a lone leading/trailing fence with no closing pair.
  return raw.replace(/^\s*```[\w-]*\s*$/gm, "");
}

/**
 * Build an iframe document for React/JSX code generated by Gemini.
 * The Gemini prompt asks for: a single default-exported functional component,
 * no imports beyond React, Tailwind utility classes for styling.
 *
 * We wrap the code so it works inside a sandboxed iframe by:
 *   - injecting React 18 + ReactDOM + Babel-standalone + Tailwind CDN
 *   - stripping any `import ... from "react"` lines (Babel-standalone won't
 *     resolve them)
 *   - rewriting `export default function NAME` (or `export default NAME`) so
 *     the component name is left as a top-level binding, then mounting it via
 *     ReactDOM.createRoot.
 */
export function buildReactDocument(
  rawCode: string,
  parentOrigin: string
): string {
  let code = stripCodeFences(rawCode);

  // Remove import/require lines - Babel-standalone runs in classic-script mode
  // and can't resolve them. React/ReactDOM are exposed as globals below.
  // Negative lookahead (?!\bfrom\b) prevents the binding group from swallowing
  // the word "from", which broke the old [\w\s,]+ approach.
  code = code.replace(
    /\bimport\b\s+(?:type\s+)?(?:(?!\bfrom\b)[\s\S])*?\bfrom\s+['"][^'"]*['"]\s*;?/g,
    ""
  );
  // Bare side-effect imports: import 'module'
  code = code.replace(/\bimport\s+['"][^'"]+['"]\s*;?/g, "");
  code = code.replace(/^\s*const\s+\w+\s*=\s*require\([^)]+\);?\s*$/gm, "");

  // Find the default-exported component name and strip the `export default`
  // marker so the binding stays in the surrounding scope.
  let componentName: string | null = null;
  const defaultFnMatch = code.match(/export\s+default\s+function\s+(\w+)/);
  if (defaultFnMatch) {
    componentName = defaultFnMatch[1];
    code = code.replace(/export\s+default\s+function/, "function");
  } else {
    const defaultIdentMatch = code.match(/export\s+default\s+(\w+)\s*;?/);
    if (defaultIdentMatch) {
      componentName = defaultIdentMatch[1];
      code = code.replace(/export\s+default\s+\w+\s*;?/, "");
    }
  }

  // Fallback: anonymous arrow exports like `export default () => (...)`
  if (!componentName) {
    componentName = "GeneratedComponent";
    code = code.replace(/export\s+default\s+/, `const ${componentName} = `);
  }

  // Embed the JSX source as a JS string literal so we can compile it at runtime
  // with Babel's CLASSIC runtime. Escaping `</` prevents a literal `</script>`
  // inside the generated code from prematurely closing the inline <script>.
  const sourceLiteral = JSON.stringify(code).replace(/<\//g, "<\\/");
  const nameLiteral = JSON.stringify(componentName);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="script-src 'unsafe-inline' 'unsafe-eval' https:; style-src 'unsafe-inline' https:;">
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Brand Kit fonts: generated code may reference these via font-['Name'] classes; preload them so the preview shows the real face. -->
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Roboto:wght@400;500;700&family=Montserrat:wght@400;600;700&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <!-- Pinned: an unpinned URL silently jumped to Babel 8 (automatic JSX runtime)
       and broke the preview. Bump deliberately, and re-test the classic-runtime
       transform below if you do. -->
  <script src="https://unpkg.com/@babel/standalone@8.0.1/babel.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
    /* Guarantee the preview is scrollable even if generated code sets
       overflow:hidden on html/body (common in Gemini hero layouts). */
    html, body { height: auto !important; min-height: 100%; overflow-y: auto !important; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    const originalLog = console.log;
    console.log = function(...args) {
      originalLog.apply(console, args);
      window.parent.postMessage({ type: 'console', data: args.map(a => String(a)).join(' ') }, '${parentOrigin}');
    };
    window.onerror = function(msg, url, line) {
      window.parent.postMessage({ type: 'error', data: 'Error: ' + msg + ' at line ' + line }, '${parentOrigin}');
      return false;
    };
  </script>
  <script>
    (function () {
      // Babel 8 (loaded from CDN) defaults preset-react to the AUTOMATIC JSX
      // runtime, which injects \`import { jsx } from "react/jsx-runtime"\` into
      // its output. With React loaded as a UMD global and no module resolver,
      // that import fails ("Cannot use import statement outside a module").
      // Forcing the CLASSIC runtime makes Babel emit React.createElement(...)
      // against the global React instead — no imports in the output.
      try {
        var compiled = Babel.transform(${sourceLiteral}, {
          presets: [['react', { runtime: 'classic' }]],
          filename: 'preview.jsx'
        }).code;
        var factory = new Function('React', 'ReactDOM', compiled + '\\nreturn ' + ${nameLiteral} + ';');
        var Component = factory(React, ReactDOM);
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Component));
      } catch (err) {
        document.getElementById('root').innerHTML =
          '<pre style="color:#b00;padding:16px;white-space:pre-wrap;font-family:monospace;">' +
          'Render error: ' + (err && err.message ? err.message : String(err)) +
          '</pre>';
        window.parent.postMessage({ type: 'error', data: String(err) }, '${parentOrigin}');
      }
    })();
  </script>
  ${linkerScript(parentOrigin)}
</body>
</html>`;
}

export function buildHtmlDocument(
  rawCode: string,
  parentOrigin: string
): string {
  const cleaned = stripCodeFences(rawCode);
  if (cleaned.includes("<!DOCTYPE") || cleaned.includes("<html")) {
    // Full document from Gemini: splice the linker bridge in before </body>
    // (or append) so the Element↔Code Linker works on the HTML path too.
    const script = linkerScript(parentOrigin);
    if (/<\/body>/i.test(cleaned)) {
      return cleaned.replace(/<\/body>/i, `${script}\n</body>`);
    }
    return cleaned + script;
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="script-src 'unsafe-inline' 'unsafe-eval' https:; style-src 'unsafe-inline' https:;">
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Brand Kit fonts: generated code may reference these via font-['Name'] classes; preload them so the preview shows the real face. -->
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Roboto:wght@400;500;700&family=Montserrat:wght@400;600;700&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; }
    /* Guarantee the preview is scrollable even if generated code sets
       overflow:hidden on html/body (common in Gemini hero layouts). */
    html, body { height: auto !important; min-height: 100%; overflow-y: auto !important; }
  </style>
</head>
<body>
${cleaned}
<script>
  const originalLog = console.log;
  console.log = function(...args) {
    originalLog.apply(console, args);
    window.parent.postMessage({ type: 'console', data: args.map(a => String(a)).join(' ') }, '${parentOrigin}');
  };
  window.onerror = function(msg, url, line) {
    window.parent.postMessage({ type: 'error', data: 'Error: ' + msg + ' at line ' + line }, '${parentOrigin}');
    return false;
  };
</script>
${linkerScript(parentOrigin)}
</body>
</html>`;
}

/**
 * Render a Vue 3 SFC in a sandboxed iframe using the Vue global CDN build,
 * which includes the template compiler so runtime template strings work.
 *
 * Steps:
 *  1. Extract the <template> and <script setup> blocks.
 *  2. Strip `import ... from 'vue'` lines — Vue is a CDN global here.
 *  3. Scan for top-level const/let declarations and auto-return them from setup(),
 *     mirroring what Vue's SFC compiler does for script setup.
 */
export function buildVueDocument(
  rawCode: string,
  parentOrigin: string
): string {
  const code = stripCodeFences(rawCode);

  const templateMatch = code.match(/<template>([\s\S]*?)<\/template>/);
  const scriptSetupMatch = code.match(
    /<script\s+setup[^>]*>([\s\S]*?)<\/script>/
  );

  const templateContent =
    templateMatch?.[1]?.trim() ?? "<div>No template found.</div>";

  let scriptSetupContent = (scriptSetupMatch?.[1] ?? "").trim();
  // Remove vue imports — all Vue helpers are destructured from the global below.
  scriptSetupContent = scriptSetupContent
    .replace(/import\s+\{[^}]+\}\s+from\s+['"]vue['"]\s*;?\n?/g, "")
    .trim();

  // Auto-return any top-level const/let/var declarations so the template can
  // bind to them (mirrors what @vue/compiler-sfc does for script setup).
  const declaredNames: string[] = [];
  const declRe = /^\s*(?:const|let|var)\s+(\w+)/gm;
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(scriptSetupContent)) !== null) {
    declaredNames.push(m[1]);
  }
  const returnStatement =
    declaredNames.length > 0
      ? `return { ${declaredNames.join(", ")} };`
      : "return {};";

  const escapedTemplate = JSON.stringify(templateContent);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="script-src 'unsafe-inline' 'unsafe-eval' https:; style-src 'unsafe-inline' https:;">
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Brand Kit fonts: generated code may reference these via font-['Name'] classes; preload them so the preview shows the real face. -->
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Roboto:wght@400;500;700&family=Montserrat:wght@400;600;700&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
    html, body { height: auto !important; min-height: 100%; overflow-y: auto !important; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
    window.onerror = function(msg, url, line) {
      window.parent.postMessage({ type: 'error', data: 'Error: ' + msg + ' at line ' + line }, '${parentOrigin}');
      document.getElementById('app').innerHTML =
        '<pre style="color:#b00;padding:16px;white-space:pre-wrap;font-family:monospace;">Render error: ' + msg + '</pre>';
      return false;
    };
    (function() {
      const { createApp, ref, reactive, computed, watch, onMounted, onUnmounted } = Vue;
      try {
        const app = createApp({
          template: ${escapedTemplate},
          setup() {
            ${scriptSetupContent}
            ${returnStatement}
          }
        });
        app.mount('#app');
      } catch(err) {
        document.getElementById('app').innerHTML =
          '<pre style="color:#b00;padding:16px;white-space:pre-wrap;font-family:monospace;">Render error: ' +
          (err && err.message ? err.message : String(err)) + '</pre>';
        window.parent.postMessage({ type: 'error', data: String(err) }, '${parentOrigin}');
      }
    })();
  </script>
  ${linkerScript(parentOrigin)}
</body>
</html>`;
}

/** Dispatch to the right builder for the language. */
export function buildPreviewDocument(
  code: string,
  language: PreviewLanguage,
  parentOrigin: string
): string {
  if (language === "react") return buildReactDocument(code, parentOrigin);
  if (language === "vue") return buildVueDocument(code, parentOrigin);
  return buildHtmlDocument(code, parentOrigin);
}

/**
 * Best-effort language sniff for stored code whose framework wasn't persisted
 * alongside it (older project rows have no framework column value).
 */
export function detectPreviewLanguage(code: string): PreviewLanguage {
  if (/<template>[\s\S]*<\/template>/.test(code)) return "vue";
  if (/export\s+default|React\.|useState|=>\s*\(?\s*</.test(code))
    return "react";
  return "html";
}
