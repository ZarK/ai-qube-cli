import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

interface PackageJson {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly engines?: Record<string, string>;
  readonly exports?: Record<string, unknown>;
  readonly files?: readonly string[];
  readonly packageManager?: string;
  readonly scripts?: Record<string, string>;
  readonly type?: string;
}

async function readPackageJson(): Promise<PackageJson> {
  return JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as PackageJson;
}

async function readProjectFile(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("package metadata", () => {
  it("is ESM-first and targets Node.js 24+ with pnpm", async () => {
    const packageJson = await readPackageJson();

    expect(packageJson.type).toBe("module");
    expect(packageJson.engines?.node).toBe(">=24.0.0");
    expect(packageJson.packageManager).toBe("pnpm@11.0.4");
  });

  it("uses exact dependency versions", async () => {
    const packageJson = await readPackageJson();
    const versions = Object.values({
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    });

    expect(versions.length).toBeGreaterThan(0);
    expect(versions).toEqual(versions.filter((version) => /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)));
  });

  it("does not define normal-use install lifecycle scripts", async () => {
    const packageJson = await readPackageJson();

    expect(packageJson.scripts).not.toHaveProperty("preinstall");
    expect(packageJson.scripts).not.toHaveProperty("install");
    expect(packageJson.scripts).not.toHaveProperty("postinstall");
  });

  it("exports only the implemented root surface", async () => {
    const packageJson = await readPackageJson();

    expect(packageJson.exports).toEqual({
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js"
      }
    });
    expect(packageJson.files).toEqual(["dist"]);
  });

  it("configures pnpm dependency safety gates for the project", async () => {
    const workspace = await readProjectFile("pnpm-workspace.yaml");

    expect(workspace).toContain("minimumReleaseAge: 10080");
    expect(workspace).toContain("minimumReleaseAgeIgnoreMissingTime: false");
    expect(workspace).toContain("minimumReleaseAgeStrict: true");
    expect(workspace).toContain("trustPolicy: no-downgrade");
    expect(workspace).toContain("blockExoticSubdeps: true");
    expect(workspace).toContain("strictDepBuilds: true");
    expect(workspace).toContain("verifyDepsBeforeRun: error");
    expect(workspace).toContain('savePrefix: ""');
  });
});
