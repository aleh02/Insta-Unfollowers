#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const {
  compareExports,
  extractUsernames,
  extractFollowingRecords,
  formatFollowedAt,
  makeReportHtml,
  profileLink,
} = require("./lib/instagram");

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

function resolveExportFiles(exportDir) {
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

function nowSlug() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(
    date.getMinutes()
  )}${pad(date.getSeconds())}`;
}

function loadExport(exportDir) {
  const { followersPath, followingPath } = resolveExportFiles(exportDir);
  const followersData = readJson(followersPath);
  const followingData = readJson(followingPath);
  const followers = extractUsernames(followersData);
  const followingRecords = extractFollowingRecords(followingData);

  return {
    followersData,
    followingData,
    followers,
    followingRecords,
    following: new Set(followingRecords.map((record) => record.username)),
  };
}

function saveSnapshot(exportDir, label, exportData) {
  ensureDirs();

  const outPath = path.join(SNAP_DIR, `${nowSlug()}__${label}.json`);
  const snapshot = {
    created_at: new Date().toISOString(),
    label,
    export_dir: path.resolve(exportDir),
    counts: { followers: exportData.followers.size, following: exportData.following.size },
    followers: Array.from(exportData.followers).sort(),
    following: Array.from(exportData.following).sort(),
    following_records: exportData.followingRecords,
  };

  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2), "utf8");
  return outPath;
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

(function main() {
  try {
    const exportOld = path.join(APP_DIR, "export_old");
    const exportNew = path.join(APP_DIR, "export_new");

    if (!fs.existsSync(exportOld)) throw new Error(`Missing folder: ${exportOld}`);
    if (!fs.existsSync(exportNew)) throw new Error(`Missing folder: ${exportNew}`);

    console.log("⏳ Reading exports from:");
    console.log("  OLD:", exportOld);
    console.log("  NEW:", exportNew);

    const oldData = loadExport(exportOld);
    const newData = loadExport(exportNew);

    const oldSnap = saveSnapshot(exportOld, "old", oldData);
    const newSnap = saveSnapshot(exportNew, "new", newData);

    console.log("✅ Snapshots saved:");
    console.log("  OLD:", oldSnap);
    console.log("  NEW:", newSnap);

    const comparison = compareExports({
      oldFollowersData: oldData.followersData,
      newFollowersData: newData.followersData,
      followingData: newData.followingData,
    });

    const reportPath = path.join(
      REPORT_DIR,
      `report__${path.basename(oldSnap, ".json")}__TO__${path.basename(newSnap, ".json")}.html`
    );

    fs.writeFileSync(reportPath, makeReportHtml({ ...comparison, generatedAt: new Date() }), "utf8");

    console.log(`✅ Report generated: ${reportPath}`);
    console.log(`Unfollowers (${comparison.unfollowers.length}):`);
    comparison.unfollowers.forEach(({ username, timestamp }) =>
      console.log(` - @${username}  ${profileLink(username)}  followed ${formatFollowedAt(timestamp)}`)
    );

    console.log(`\nNew followers (${comparison.newFollowers.length}):`);
    comparison.newFollowers.forEach(({ username }) => console.log(` + @${username}  ${profileLink(username)}`));

    console.log(`\nPeople you follow who don't follow you back (${comparison.notFollowingBack.length}):`);
    comparison.notFollowingBack.forEach(({ username, timestamp }) =>
      console.log(` - @${username}  ${profileLink(username)}  followed ${formatFollowedAt(timestamp)}`)
    );

    printWindowsPath(path.dirname(reportPath));
  } catch (error) {
    console.error(`❌ ${error.message || error}`);
    process.exit(1);
  }
})();
