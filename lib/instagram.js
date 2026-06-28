"use strict";

function normalizeUsername(s) {
  return String(s || "").trim().replace(/^@+/, "");
}

function profileLink(username) {
  return `https://www.instagram.com/${username}/`;
}

function usernameFromHref(href) {
  if (!href) return "";
  const match = String(href).match(/instagram\.com\/(?:_u\/)?([^/?#]+)/i);
  return normalizeUsername(match ? match[1] : "");
}

function* findStringListDataNodes(obj) {
  if (Array.isArray(obj)) {
    for (const item of obj) yield* findStringListDataNodes(item);
    return;
  }

  if (obj && typeof obj === "object") {
    if (Array.isArray(obj.string_list_data)) yield obj;
    for (const value of Object.values(obj)) yield* findStringListDataNodes(value);
  }
}

function extractUsernames(data) {
  const usernames = new Set();

  for (const node of findStringListDataNodes(data)) {
    for (const item of node.string_list_data || []) {
      if (!item || typeof item !== "object") continue;
      const username = normalizeUsername(item.value);
      if (username) usernames.add(username);
    }
  }

  return usernames;
}

function extractFollowingRecords(data) {
  const records = [];
  const seen = new Set();

  for (const node of findStringListDataNodes(data)) {
    for (const item of node.string_list_data || []) {
      if (!item || typeof item !== "object") continue;

      const username = normalizeUsername(item.value || node.title || usernameFromHref(item.href));
      if (!username || seen.has(username)) continue;

      seen.add(username);
      records.push({
        username,
        timestamp: Number.isFinite(item.timestamp) ? item.timestamp : null,
      });
    }
  }

  records.sort((a, b) => {
    const aTs = a.timestamp ?? -Infinity;
    const bTs = b.timestamp ?? -Infinity;
    return bTs - aTs;
  });

  return records;
}

function formatFollowedAt(timestamp) {
  if (!timestamp) return "Unknown date";
  return new Date(timestamp * 1000).toLocaleString();
}

function toProfileRecord(username, timestamp = null) {
  return {
    username,
    timestamp,
    profileUrl: profileLink(username),
  };
}

function compareExports({ oldFollowersData, newFollowersData, followingData }) {
  const oldFollowers = extractUsernames(oldFollowersData);
  const newFollowers = extractUsernames(newFollowersData);
  const followingRecords = extractFollowingRecords(followingData);

  const oldSet = new Set(oldFollowers);
  const newSet = new Set(newFollowers);
  const followingMap = new Map(followingRecords.map(({ username, timestamp }) => [username, timestamp]));

  const unfollowers = Array.from(oldSet)
    .filter((username) => !newSet.has(username))
    .sort((a, b) => {
      const aTs = followingMap.get(a) ?? -Infinity;
      const bTs = followingMap.get(b) ?? -Infinity;
      if (bTs !== aTs) return bTs - aTs;
      return a.localeCompare(b);
    })
    .map((username) => toProfileRecord(username, followingMap.get(username) ?? null));

  const newFollowersList = Array.from(newSet)
    .filter((username) => !oldSet.has(username))
    .sort()
    .map((username) => toProfileRecord(username));

  const notFollowingBack = followingRecords
    .filter(({ username }) => username && !newSet.has(username))
    .map(({ username, timestamp }) => toProfileRecord(username, timestamp));

  return {
    counts: {
      oldFollowers: oldSet.size,
      newFollowers: newSet.size,
      following: followingRecords.length,
    },
    unfollowers,
    newFollowers: newFollowersList,
    notFollowingBack,
    followingRecords: followingRecords.map(({ username, timestamp }) => toProfileRecord(username, timestamp)),
  };
}

function makeReportHtml({ unfollowers, newFollowers, notFollowingBack, counts, generatedAt = new Date() }) {
  const li = (user) =>
    `<li><a href="${profileLink(user.username)}" target="_blank" rel="noopener noreferrer">@${user.username}</a></li>`;
  const datedLi = (user) =>
    `<li><a href="${profileLink(user.username)}" target="_blank" rel="noopener noreferrer">@${user.username}</a> <span class="date">followed ${formatFollowedAt(user.timestamp)}</span></li>`;
  const unfollowersHtml = unfollowers.length ? unfollowers.map(datedLi).join("\n") : "<li><em>None 🎉</em></li>";
  const newFollowersHtml = newFollowers.length ? newFollowers.map(li).join("\n") : "<li><em>None</em></li>";
  const notFollowingBackHtml = notFollowingBack.length
    ? notFollowingBack.map(datedLi).join("\n")
    : "<li><em>None 🎉</em></li>";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Instagram Unfollowers</title>
  <style>
    body { font-family: Space Grotesk, Trebuchet MS, sans-serif; margin: 0; background: linear-gradient(160deg, #140f10 0%, #1d1214 44%, #f5f1ea 44%, #f5f1ea 100%); color: #17131a; }
    .wrap { max-width: 980px; margin: 0 auto; padding: 28px 18px 48px; }
    .hero { background: rgba(255,255,255,0.88); border: 1px solid rgba(255,255,255,0.4); border-radius: 28px; padding: 28px; box-shadow: 0 24px 60px rgba(0,0,0,0.22); backdrop-filter: blur(10px); }
    h1 { margin: 0 0 12px; font-size: clamp(28px, 4vw, 52px); letter-spacing: -0.04em; }
    .meta { color: #5f5560; font-size: 14px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .pill { display:inline-block; padding: 4px 12px; border-radius: 999px; border: 1px solid #e0d9dd; background: #fff; font-size: 12px; }
    .grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); margin-top: 20px; }
    .card { background: rgba(255,255,255,0.82); border: 1px solid rgba(255,255,255,0.54); border-radius: 22px; padding: 18px; }
    h2 { font-size: 16px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #7b5263; }
    ul { padding-left: 20px; margin: 0; }
    li { margin-bottom: 8px; line-height: 1.5; }
    a { color: #1d0b70; text-decoration: none; font-weight: 600; }
    a:hover { text-decoration: underline; }
    .date { color: #715c65; font-size: 13px; }
    .stats { display:flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
    .stat { background: #17131a; color: #fff; border-radius: 16px; padding: 12px 14px; min-width: 110px; }
    .stat span { display:block; font-size: 12px; color: #b7a8b1; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
    .stat strong { font-size: 22px; }
    @media (max-width: 640px) { .hero { padding: 20px; border-radius: 22px; } .card { padding: 16px; } }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <h1>Instagram Unfollowers</h1>
      <div class="meta">
        <span class="pill">Generated ${generatedAt.toLocaleString()}</span>
        <span class="pill">Followers ${counts.oldFollowers} → ${counts.newFollowers}</span>
        <span class="pill">Following ${counts.following}</span>
      </div>

      <div class="stats">
        <div class="stat"><span>Unfollowers</span><strong>${unfollowers.length}</strong></div>
        <div class="stat"><span>New followers</span><strong>${newFollowers.length}</strong></div>
        <div class="stat"><span>Not following back</span><strong>${notFollowingBack.length}</strong></div>
      </div>

      <div class="grid">
        <article class="card">
          <h2>Unfollowers (${unfollowers.length})</h2>
          <ul>${unfollowersHtml}</ul>
        </article>
        <article class="card">
          <h2>New followers (${newFollowers.length})</h2>
          <ul>${newFollowersHtml}</ul>
        </article>
        <article class="card">
          <h2>People you follow who don't follow you back (${notFollowingBack.length})</h2>
          <ul>${notFollowingBackHtml}</ul>
        </article>
      </div>
    </section>
  </div>
</body>
</html>`;
}

module.exports = {
  normalizeUsername,
  profileLink,
  usernameFromHref,
  findStringListDataNodes,
  extractUsernames,
  extractFollowingRecords,
  formatFollowedAt,
  compareExports,
  makeReportHtml,
};
