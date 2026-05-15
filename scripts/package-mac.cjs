const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = require(path.join(root, "package.json"));
const productName = packageJson.productName || "AI圆桌";
const appId = "cn.ai-roundtable.desktop";
const releaseDir = path.join(root, "release");
const electronCacheDir = path.join(os.homedir(), "Library", "Caches", "electron");
const arch = os.arch() === "arm64" ? "arm64" : "x64";
const appPath = path.join(releaseDir, `${productName}.app`);
const dmgPath = path.join(releaseDir, `${productName}-${packageJson.version}-${arch}.dmg`);
const zipPath = path.join(releaseDir, `${productName}-${packageJson.version}-${arch}.zip`);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function findElectronZip(dir) {
  if (!fs.existsSync(dir)) {
    return undefined;
  }

  const matches = [];

  function walk(current, depth = 0) {
    if (depth > 4) {
      return;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (entry.isFile() && entry.name.startsWith("electron-v") && entry.name.endsWith(`darwin-${arch}.zip`)) {
        matches.push(fullPath);
      }
    }
  }

  walk(dir);
  matches.sort();
  return matches.at(-1);
}

function run(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: "inherit",
    ...options
  });
}

function copyAppPayload() {
  const resourcesApp = path.join(appPath, "Contents", "Resources", "app");
  fs.rmSync(resourcesApp, { recursive: true, force: true });
  fs.mkdirSync(resourcesApp, { recursive: true });

  fs.cpSync(path.join(root, "electron"), path.join(resourcesApp, "electron"), { recursive: true });
  fs.cpSync(path.join(root, "out"), path.join(resourcesApp, "out"), { recursive: true });
  fs.writeFileSync(
    path.join(resourcesApp, "package.json"),
    JSON.stringify(
      {
        name: packageJson.name,
        version: packageJson.version,
        productName,
        main: "electron/main.cjs"
      },
      null,
      2
    )
  );
}

function updateInfoPlist() {
  const plist = path.join(appPath, "Contents", "Info.plist");
  const plistBuddy = "/usr/libexec/PlistBuddy";

  if (!fs.existsSync(plistBuddy)) {
    return;
  }

  const set = (key, value) => {
    try {
      run(plistBuddy, ["-c", `Set :${key} ${value}`, plist], { stdio: "ignore" });
    } catch {
      try {
        run(plistBuddy, ["-c", `Add :${key} string ${value}`, plist], { stdio: "ignore" });
      } catch {
        // Keep packaging resilient on older macOS images.
      }
    }
  };

  set("CFBundleName", productName);
  set("CFBundleDisplayName", productName);
  set("CFBundleIdentifier", appId);
  set("CFBundleShortVersionString", packageJson.version);
  set("CFBundleVersion", packageJson.version);
  set("LSApplicationCategoryType", "public.app-category.productivity");
}

function signAdHoc() {
  try {
    run("codesign", ["--force", "--deep", "--sign", "-", appPath]);
  } catch {
    console.warn("未能完成本地临时签名，应用仍已生成，但首次打开可能需要在系统设置中允许。");
  }
}

function packageArtifacts() {
  fs.rmSync(dmgPath, { force: true });
  fs.rmSync(zipPath, { force: true });
  run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, zipPath]);

  try {
    run("hdiutil", ["create", "-volname", productName, "-srcfolder", appPath, "-ov", "-format", "UDZO", dmgPath]);
  } catch {
    console.warn("当前环境无法创建 dmg，已保留 zip 版本。");
  }
}

const electronZip = findElectronZip(electronCacheDir);

if (!electronZip) {
  fail(
    [
      "没有找到本地 Electron macOS 运行时缓存，无法离线生成桌面应用。",
      `请先安装 Electron，或把 electron-v*-darwin-${arch}.zip 放到 ${electronCacheDir} 后重试。`
    ].join("\n")
  );
}

if (!fs.existsSync(path.join(root, "out", "index.html"))) {
  fail("没有找到 out/index.html，请先运行 npm run build。");
}

fs.rmSync(appPath, { recursive: true, force: true });
fs.mkdirSync(releaseDir, { recursive: true });

fs.rmSync(path.join(releaseDir, "Electron.app"), { recursive: true, force: true });
run("unzip", ["-q", "-o", electronZip, "-d", releaseDir]);
fs.renameSync(path.join(releaseDir, "Electron.app"), appPath);
copyAppPayload();
updateInfoPlist();
signAdHoc();
packageArtifacts();

console.log(`已生成：${zipPath}`);
if (fs.existsSync(dmgPath)) {
  console.log(`已生成：${dmgPath}`);
}
