import { describe, it, expect } from "vitest";
import { buildReactScaffoldFiles, screenComponentName } from "./export-zip";

const BASE = {
  code: "export default function Home() { return <div>Home</div>; }",
  framework: "react" as const,
  styling: "tailwind" as const,
  projectName: "Test Project",
};

describe("screenComponentName", () => {
  it("pascal-cases names and strips punctuation", () => {
    expect(screenComponentName("user profile!")).toBe("UserProfile");
    expect(screenComponentName("Home")).toBe("Home");
  });

  it("prefixes names that start with a digit", () => {
    expect(screenComponentName("2nd page")).toBe("Screen2ndPage");
  });

  it("handles empty or symbol-only names", () => {
    expect(screenComponentName("!!!")).toBe("Screen");
  });

  it("deduplicates within a taken set", () => {
    const taken = new Set<string>();
    expect(screenComponentName("Home", taken)).toBe("Home");
    expect(screenComponentName("home", taken)).toBe("Home2");
    expect(screenComponentName("HOME", taken)).toBe("Home3");
  });
});

describe("buildReactScaffoldFiles multi-screen", () => {
  const screens = [
    { name: "Home", code: "export default function Home() { return <div /> }" },
    {
      name: "Dashboard",
      code: "export default function Dash() { return <div /> }",
    },
  ];

  it("single screen keeps the classic App.tsx layout", () => {
    const files = buildReactScaffoldFiles(BASE);
    expect(files["src/App.tsx"]).toContain("function Home");
    expect(
      Object.keys(files).filter((f) => f.startsWith("src/screens/"))
    ).toHaveLength(0);
  });

  it("two screens produce per-screen files and a router shell", () => {
    const files = buildReactScaffoldFiles({ ...BASE, screens });
    expect(files["src/screens/Home.tsx"]).toContain("function Home");
    expect(files["src/screens/Dashboard.tsx"]).toContain("function Dash");
    const app = files["src/App.tsx"];
    expect(app).toContain('import Home from "./screens/Home"');
    expect(app).toContain('import Dashboard from "./screens/Dashboard"');
    expect(app).toContain("ccNavigate");
    // First screen in the list boots the app.
    expect(app).toContain('const FIRST_SCREEN = "Home"');
  });

  it("screens without code are dropped; one remaining falls back to classic", () => {
    const files = buildReactScaffoldFiles({
      ...BASE,
      screens: [screens[0], { name: "Empty", code: "   " }],
    });
    // Only one non-empty screen: no multi-page scaffold.
    expect(files["src/App.tsx"]).toContain("function Home");
    expect(files["src/screens/Home.tsx"]).toBeUndefined();
  });

  it("shell matches screen names case-insensitively", () => {
    const files = buildReactScaffoldFiles({ ...BASE, screens });
    expect(files["src/App.tsx"]).toContain("toLowerCase()");
  });

  it("scaffold plumbing files are still present", () => {
    const files = buildReactScaffoldFiles({ ...BASE, screens });
    for (const f of ["src/main.tsx", "index.html", "package.json"]) {
      expect(files[f]).toBeTruthy();
    }
  });
});
