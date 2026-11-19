import { readFile, writeFile } from "node:fs/promises";

const path = "android/app/build.gradle";
let gradle = await readFile(path, "utf8");

if (!gradle.includes("storeFile file('mazvideo-release.keystore')")) {
  const marker = "    buildTypes {";
  const block = `    signingConfigs {
        release {
            storeFile file('mazvideo-release.keystore')
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD') ?: ''
            keyAlias System.getenv('ANDROID_KEY_ALIAS') ?: ''
            keyPassword System.getenv('ANDROID_KEY_PASSWORD') ?: ''
        }
    }
`;
  if (!gradle.includes(marker)) throw new Error("Could not locate Android buildTypes block");
  gradle = gradle.replace(marker, `${block}${marker}`);
}

const buildTypesStart = gradle.indexOf("    buildTypes {");
if (buildTypesStart < 0) throw new Error("Could not locate buildTypes block");
const beforeBuildTypes = gradle.slice(0, buildTypesStart);
const buildTypes = gradle.slice(buildTypesStart);
const buildTypesRelease = /(\n\s{8}release\s*\{)([\s\S]*?)(\n\s{8}\})/;
if (!buildTypesRelease.test(buildTypes)) throw new Error("Could not locate buildTypes.release block");
const patchedBuildTypes = buildTypes.replace(buildTypesRelease, (_match, start, body, end) => {
  const withoutSigning = body.replace(/^\s*signingConfig\s+signingConfigs\.[A-Za-z0-9_]+\s*$/m, "");
  return `${start}${withoutSigning}\n            signingConfig signingConfigs.release${end}`;
});
gradle = beforeBuildTypes + patchedBuildTypes;

if (!gradle.includes("storeFile file('mazvideo-release.keystore')")) {
  throw new Error("Release keystore file is not configured");
}
if (!gradle.includes("signingConfig signingConfigs.release")) {
  throw new Error("Release build is not configured to use signingConfigs.release");
}

await writeFile(path, gradle);
console.log("Configured release signing from GitHub Actions secrets.");
