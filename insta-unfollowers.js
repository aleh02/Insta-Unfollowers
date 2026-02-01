#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

// Store everything locally in the current project folder:
const APP_DIR = process.cwd();
const SNAP_DIR = path.join(APP_DIR, ".snapshots");
const REPORT_DIR = path.join(APP_DIR, ".reports");

function ensureDirs() {
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeUsername(s) {
  return String(s || "").trim().replace(/^@+/, "");
}

function profileLink(username) {
  return `https://www.instagram.com/${username}/`;
}

// Recursively walk JSON and collect nodes that contain "string_list_data"
function* findStringListDataNodes(obj) {
  if (Array.isArray(obj)) {
    for (const item of obj) yield* findStringListDataNodes(item);
    return;
  }
  if (obj && typeof obj === "object") {
    if (Array.isArray(obj.string_list_data)) yield obj;
    for (const v of Object.values(obj)) yield* findStringListDataNodes(v);
  }
}

function extractUsernames(data) {
  const set = new Set();
  for (const node of findStringListDataNodes(data)) {
    for (const item of node.string_list_data || []) {
      if (!item || typeof item !== "object") continue;
      const value = item.value || "";
      const u = normalizeUsername(value);
      if (u) set.add(u);
    }
  }
  return set;
}

function resolveExportFiles(exportDir) {
  // supports:
  // exportDir/followers_1.json & exportDir/following.json
  // exportDir/followers_and_following/followers_1.json & .../following.json
  const directFollowers = path.join(exportDir, "followers_1.json");
  const directFollowing = path.join(exportDir, "following.json");

  const nestedFollowers = path.join(exportDir, "followers_and_following", "followers_1.json");
  const nestedFollowing = path.join(exportDir, "followers_and_following", "following.json");

  const followersPath = fs.existsSync(directFollowers) ? directFollowers : nestedFollowers;
  const followingPath = fs.existsSync(directFollowing) ? directFollowing : nestedFollowing;

  if (!fs.existsSync(followersPath)) {
    throw new Error(
      `Followers JSON not found in: ${exportDir}\nLooked for:\n- ${directFollowers}\n- ${nestedFollowers}`
    );
  }
  if (!fs.existsSync(followingPath)) {
    throw new Error(
      `Following JSON not found in: ${exportDir}\nLooked for:\n- ${directFollowing}\n- ${nestedFollowing}`
    );
  }
  return { followersPath, followingPath };
}

function loadFollowersAndFollowing(exportDir) {
  const { followersPath, followingPath } = resolveExportFiles(exportDir);
  const followers = extractUsernames(readJson(followersPath));
  const following = extractUsernames(readJson(followingPath));
  return { followers, following };
}

function nowSlug() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`;
}

function saveSnapshot(exportDir, label) {
  ensureDirs();
  const { followers, following } = loadFollowersAndFollowing(exportDir);

  const name = `${nowSlug()}__${label}.json`;
  const outPath = path.join(SNAP_DIR, name);

  const snapshot = {
    created_at: new Date().toISOString(),
    label,
    export_dir: path.resolve(exportDir),
    counts: { followers: followers.size, following: following.size },
    followers: Array.from(followers).sort(),
    following: Array.from(following).sort(),
  };

  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2), "utf8");
  return outPath;
}

function makeReportHtml({ unfollowers, newFollowers, oldCount, newCount }) {
  const li = (u) =>
    `<li><a href="${profileLink(u)}" target="_blank" rel="noopener noreferrer">@${u}</a></li>`;
  const unfHtml = unfollowers.length ? unfollowers.map(li).join("\n") : "<li><em>None 🎉</em></li>";
  const newfHtml = newFollowers.length ? newFollowers.map(li).join("\n") : "<li><em>None</em></li>";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Instagram Unfollowers</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 24px; }
    .card { max-width: 760px; border: 1px solid #ddd; border-radius: 12px; padding: 16px; }
    h1 { font-size: 20px; margin: 0 0 12px; }
    h2 { font-size: 16px; margin: 18px 0 8px; }
    .meta { color: #555; font-size: 13px; }
    ul { padding-left: 18px; }
    a { text-decoration: none; }
    a:hover { text-decoration: underline; }
    .pill { display:inline-block; padding: 2px 10px; border-radius: 999px; border: 1px solid #ddd; font-size: 12px; margin-left: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Instagram Unfollowers</h1>
    <div class="meta">
      Followers: ${oldCount} → ${newCount}
      <span class="pill">Generated ${new Date().toLocaleString()}</span>
    </div>

    <h2>Unfollowers (${unfollowers.length})</h2>
    <ul>${unfHtml}</ul>

    <h2>New followers (${newFollowers.length})</h2>
    <ul>${newfHtml}</ul>
  </div>
</body>
</html>`;
}

function compareSnapshots(oldSnapPath, newSnapPath) {
  const oldSnap = readJson(oldSnapPath);
  const newSnap = readJson(newSnapPath);

  const oldSet = new Set(oldSnap.followers.map(normalizeUsername));
  const newSet = new Set(newSnap.followers.map(normalizeUsername));

  const unfollowers = Array.from(oldSet).filter((u) => !newSet.has(u)).sort();
  const newFollowers = Array.from(newSet).filter((u) => !oldSet.has(u)).sort();

  const reportName = `report__${path.basename(oldSnapPath, ".json")}__TO__${path.basename(
    newSnapPath,
    ".json"
  )}.html`;
  const reportPath = path.join(REPORT_DIR, reportName);

  fs.writeFileSync(
    reportPath,
    makeReportHtml({ unfollowers, newFollowers, oldCount: oldSet.size, newCount: newSet.size }),
    "utf8"
  );

  return { unfollowers, newFollowers, reportPath };
}

function isWSL() {
  return (
    process.platform === "linux" &&
    (fs.existsSync("/mnt/c") || os.release().toLowerCase().includes("microsoft"))
  );
}

function printWindowsPath(linuxPath) {
  try {
    const winPath = execSync(`wslpath -w "${linuxPath}"`).toString().trim();
    console.log("\n📂 Open this folder in Windows Explorer:");
    console.log(winPath);
    console.log("\nOr run:");
    console.log(`explorer.exe "${winPath}"\n`);
  } catch {
    console.log("\n📂 Report saved at:");
    console.log(linuxPath + "\n");
  }
}


// ---- Main: zero-config ----
(function main() {
  try {
    const here = process.cwd();
    const exportOld = path.join(here, "export_old");
    const exportNew = path.join(here, "export_new");

    if (!fs.existsSync(exportOld)) throw new Error(`Missing folder: ${exportOld}`);
    if (!fs.existsSync(exportNew)) throw new Error(`Missing folder: ${exportNew}`);

    console.log("⏳ Reading exports from:");
    console.log("  OLD:", exportOld);
    console.log("  NEW:", exportNew);

    const oldSnap = saveSnapshot(exportOld, "old");
    const newSnap = saveSnapshot(exportNew, "new");

    console.log("✅ Snapshots saved:");
    console.log("  OLD:", oldSnap);
    console.log("  NEW:", newSnap);

    const { unfollowers, newFollowers, reportPath } = compareSnapshots(oldSnap, newSnap);

    console.log(`✅ Report generated: ${reportPath}`);
    console.log(`Unfollowers (${unfollowers.length}):`);
    unfollowers.forEach((u) => console.log(` - @${u}  ${profileLink(u)}`));

    console.log(`\nNew followers (${newFollowers.length}):`);
    newFollowers.forEach((u) => console.log(` + @${u}  ${profileLink(u)}`));

    printWindowsPath(path.dirname(reportPath));
  } catch (e) {
    console.error(`❌ ${e.message || e}`);
    process.exit(1);
  }
})();
