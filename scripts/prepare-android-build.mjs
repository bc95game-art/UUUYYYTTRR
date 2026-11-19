import { readFile, writeFile } from "node:fs/promises";

const path = "android/app/build.gradle";
let gradle = await readFile(path, "utf8");

if (!gradle.includes("signingConfigs.release")) {
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

gradle = gradle.replace(
  /release\s*\{([\s\S]*?)signingConfig\s+signingConfigs\.debug/,
  (_match, body) => `release {${body}signingConfig signingConfigs.release`,
);

await writeFile(path, gradle);
console.log("Configured release signing from GitHub Actions secrets.");
