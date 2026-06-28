"use strict";

const express = require("express");
const path = require("path");
const multer = require("multer");
const JSZip = require("jszip");
const { compareExports, makeReportHtml, normalizeUsername } = require("../lib/instagram");

const ROOT_DIR = path.resolve(__dirname, "..");
const CLIENT_DIST_DIR = path.join(ROOT_DIR, "client", "dist");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 24,
  },
});

function jsonError(res, status, message, details) {
  return res.status(status).json({ error: message, details: details || null });
}

function parseJsonBuffer(buffer, label) {
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON in ${label}: ${error.message}`);
  }
}

function baseName(fileName) {
  return String(fileName || "").replace(/\\/g, "/").split("/").pop();
}

function locateFiles(files, names) {
  const matches = new Map();

  for (const file of files) {
    const key = baseName(file.originalname).toLowerCase();
    if (names.includes(key) && !matches.has(key)) matches.set(key, file);
  }

  return matches;
}

async function parseZipExport(file, exportLabel) {
  const zip = await JSZip.loadAsync(file.buffer);
  let followersEntry = null;
  let followingEntry = null;

  zip.forEach((relativePath, entry) => {
    if (entry.dir) return;
    const name = baseName(relativePath).toLowerCase();
    if (name === "followers_1.json" && !followersEntry) followersEntry = entry;
    if (name === "following.json" && !followingEntry) followingEntry = entry;
  });

  if (!followersEntry || !followingEntry) {
    throw new Error(`${exportLabel} zip must contain followers_1.json and following.json`);
  }

  return {
    followersData: parseJsonBuffer(await followersEntry.async("nodebuffer"), `${exportLabel} / followers_1.json`),
    followingData: parseJsonBuffer(await followingEntry.async("nodebuffer"), `${exportLabel} / following.json`),
  };
}

function parseFolderExport(files, exportLabel) {
  const required = locateFiles(files, ["followers_1.json", "following.json"]);
  const followersFile = required.get("followers_1.json");
  const followingFile = required.get("following.json");

  if (!followersFile || !followingFile) {
    throw new Error(`${exportLabel} folder must contain followers_1.json and following.json`);
  }

  return {
    followersData: parseJsonBuffer(followersFile.buffer, `${exportLabel} / followers_1.json`),
    followingData: parseJsonBuffer(followingFile.buffer, `${exportLabel} / following.json`),
  };
}

function parseRawJsonExport(filesMap, prefix) {
  //const followersFile = filesMap.get(`${prefix}Followers`);
  //const followingFile = filesMap.get(`${prefix}Following`);

  const followersFiles = filesMap.get(`${prefix}Followers`);
  const followingFiles = filesMap.get(`${prefix}Following`);

  const followersFile = Array.isArray(followersFiles) ? followersFiles[0] : followersFiles;
  const followingFile = Array.isArray(followingFiles) ? followingFiles[0] : followingFiles;

  if (!followersFile || !followingFile) {
    throw new Error(`${prefix} raw JSON upload needs ${prefix}Followers and ${prefix}Following files`);
  }

  if (!followersFile.buffer || !followingFile.buffer) {
    throw new Error(`${prefix} uploaded files missing content`);
  }

  return {
    followersData: parseJsonBuffer(followersFile.buffer, `${prefix}Followers`),
    followingData: parseJsonBuffer(followingFile.buffer, `${prefix}Following`),
  };
}

async function parseExportFromRequest(mode, files, prefix) {
  const filesMap = new Map();
  for (const file of files) {
    if (!filesMap.has(file.fieldname)) filesMap.set(file.fieldname, []);
    filesMap.get(file.fieldname).push(file);
  }

  if (mode === "zip") {
    const file = filesMap.get(`${prefix}Zip`)?.[0];
    if (!file) throw new Error(`Missing ${prefix}Zip upload`);
    return parseZipExport(file, prefix);
  }

  if (mode === "folder") {
    const folderFiles = filesMap.get(`${prefix}Files`) || [];
    if (!folderFiles.length) throw new Error(`Missing ${prefix}Files upload`);
    return parseFolderExport(folderFiles, prefix);
  }

  if (mode === "json") {
    return parseRawJsonExport(filesMap, prefix);
  }

  throw new Error(`Unknown mode: ${normalizeUsername(mode) || mode}`);
}

function createApp() {
  const app = express();

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/analyze", upload.any(), async (req, res) => {
    try {
      const mode = String(req.body.mode || "").trim().toLowerCase();
      const files = req.files || [];

      if (!files.length) {
        return jsonError(res, 400, "No files uploaded");
      }

      if (!["zip", "folder", "json"].includes(mode)) {
        return jsonError(res, 400, "Invalid mode", { mode });
      }

      const oldExport = await parseExportFromRequest(mode, files, "old");
      const newExport = await parseExportFromRequest(mode, files, "new");

      const comparison = compareExports({
        oldFollowersData: oldExport.followersData,
        newFollowersData: newExport.followersData,
        followingData: newExport.followingData,
      });

      const reportHtml = makeReportHtml({
        ...comparison,
        generatedAt: new Date(),
      });

      res.json({
        mode,
        counts: comparison.counts,
        unfollowers: comparison.unfollowers,
        newFollowers: comparison.newFollowers,
        notFollowingBack: comparison.notFollowingBack,
        followingRecords: comparison.followingRecords,
        reportHtml,
      });
    } catch (error) {
      jsonError(res, 400, error.message || String(error));
    }
  });

  if (process.env.NODE_ENV === "production") {
    app.use(express.static(CLIENT_DIST_DIR));
    app.get("*", (_req, res, next) => {
      res.sendFile(path.join(CLIENT_DIST_DIR, "index.html"), (error) => {
        if (error) next(error);
      });
    });
  }

  app.use((error, _req, res, _next) => {
    if (error && error.code === "LIMIT_FILE_SIZE") {
      return jsonError(res, 413, "File too large");
    }
    return jsonError(res, 500, error.message || "Internal server error");
  });

  return app;
}

module.exports = { createApp };
