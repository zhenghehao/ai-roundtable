const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = require(path.join(root, "package.json"));
const productName = packageJson.productName || "AI圆桌";
const releaseDir = path.join(root, "release");
const electronCacheDirs = [
  path.join(os.homedir(), "Library", "Caches", "electron"),
  path.join("/private", "tmp", "ai-roundtable-electron-cache")
];
const arch = "x64";
const target = `win32-${arch}`;
const appDir = path.join(releaseDir, `AI-Roundtable-win-${arch}`);
const zipPath = path.join(releaseDir, `AI-Roundtable-${packageJson.version}-win-${arch}.zip`);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: "inherit",
    ...options
  });
}

function findElectronZip(dir, platformTarget = target) {
  if (!fs.existsSync(dir)) {
    return undefined;
  }

  const matches = [];

  function walk(current, depth = 0) {
    if (depth > 5) {
      return;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (
        entry.isFile() &&
        entry.name.startsWith("electron-v") &&
        entry.name.endsWith(`${platformTarget}.zip`)
      ) {
        matches.push(fullPath);
      }
    }
  }

  walk(dir);
  matches.sort();
  return matches.at(-1);
}

function detectElectronVersion() {
  const anyZip =
    electronCacheDirs.map((dir) => findElectronZip(dir, "darwin-x64") || findElectronZip(dir, "darwin-arm64")).find(Boolean);
  const match = anyZip?.match(/electron-v([^/]+?)-/);
  return process.env.ELECTRON_VERSION || match?.[1] || "41.3.0";
}

function downloadElectronZip(version) {
  const cacheDir = path.join(electronCacheDirs[1], "ai-roundtable");
  const targetZip = path.join(cacheDir, `electron-v${version}-${target}.zip`);

  if (fs.existsSync(targetZip)) {
    return targetZip;
  }

  fs.mkdirSync(cacheDir, { recursive: true });

  const urls = [
    `https://github.com/electron/electron/releases/download/v${version}/electron-v${version}-${target}.zip`,
    `https://npmmirror.com/mirrors/electron/${version}/electron-v${version}-${target}.zip`
  ];

  for (const url of urls) {
    try {
      console.log(`下载 Electron Windows 运行时：${url}`);
      run("curl", ["-L", "--fail", "--retry", "2", "-o", targetZip, url]);
      return targetZip;
    } catch {
      fs.rmSync(targetZip, { force: true });
    }
  }

  fail("无法下载 Electron Windows 运行时。请检查网络后重试，或手动放入缓存目录。");
}

function copyAppPayload() {
  const resourcesApp = path.join(appDir, "resources", "app");
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

function renameExe() {
  const electronExe = path.join(appDir, "electron.exe");
  const appExe = path.join(appDir, "AI Roundtable.exe");

  if (fs.existsSync(appExe)) {
    fs.rmSync(appExe, { force: true });
  }

  fs.renameSync(electronExe, appExe);
}

if (!fs.existsSync(path.join(root, "out", "index.html"))) {
  fail("没有找到 out/index.html，请先运行 npm run build。");
}

const version = detectElectronVersion();
const electronZip = electronCacheDirs.map((dir) => findElectronZip(dir)).find(Boolean) || downloadElectronZip(version);

fs.rmSync(appDir, { recursive: true, force: true });
fs.rmSync(zipPath, { force: true });
fs.mkdirSync(appDir, { recursive: true });
run("unzip", ["-q", electronZip, "-d", appDir]);
copyAppPayload();
renameExe();
run("zip", ["-r", "-q", zipPath, path.basename(appDir)], {
  cwd: releaseDir,
  env: {
    ...process.env,
    COPYFILE_DISABLE: "1"
  }
});

console.log(`已生成：${zipPath}`);
