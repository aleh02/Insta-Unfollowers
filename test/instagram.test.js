const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const JSZip = require('jszip');
const { createApp } = require('../server/app');
const { compareExports, makeReportHtml, extractUsernames, extractFollowingRecords } = require('../lib/instagram');

function loadFixture(relPath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8'));
}

test('shared parser extracts usernames and following records', () => {
  const oldFollowers = loadFixture('export_old/followers_1.json');
  const newFollowing = loadFixture('export_new/following.json');

  const followers = extractUsernames(oldFollowers);
  const following = extractFollowingRecords(newFollowing);

  assert.ok(followers.size > 0);
  assert.ok(following.length > 0);
  assert.equal(following[0].username, following[0].username.trim());
});

test('comparison builds inline report data', () => {
  const oldFollowers = loadFixture('export_old/followers_1.json');
  const newFollowers = loadFixture('export_new/followers_1.json');
  const newFollowing = loadFixture('export_new/following.json');

  const comparison = compareExports({
    oldFollowersData: oldFollowers,
    newFollowersData: newFollowers,
    followingData: newFollowing,
  });

  const reportHtml = makeReportHtml({ ...comparison, generatedAt: new Date('2024-01-01T00:00:00Z') });

  assert.equal(typeof reportHtml, 'string');
  assert.ok(reportHtml.includes('<!doctype html>'));
  assert.ok(Array.isArray(comparison.unfollowers));
  assert.ok(Array.isArray(comparison.newFollowers));
  assert.ok(Array.isArray(comparison.notFollowingBack));
});

test('api accepts zip uploads and returns inline results', async (t) => {
  const oldFollowers = loadFixture('export_old/followers_1.json');
  const oldFollowing = loadFixture('export_old/following.json');
  const newFollowers = loadFixture('export_new/followers_1.json');
  const newFollowing = loadFixture('export_new/following.json');

  async function makeZipBuffer(followers, following) {
    const zip = new JSZip();
    zip.file('followers_1.json', JSON.stringify(followers));
    zip.file('following.json', JSON.stringify(following));
    return zip.generateAsync({ type: 'nodebuffer' });
  }

  const oldZip = await makeZipBuffer(oldFollowers, oldFollowing);
  const newZip = await makeZipBuffer(newFollowers, newFollowing);

  const app = createApp();
  const server = app.listen(0);
  t.after(() => server.close());

  const { port } = server.address();
  const formData = new FormData();
  formData.append('mode', 'zip');
  formData.append('oldZip', new Blob([oldZip]), 'old-export.zip');
  formData.append('newZip', new Blob([newZip]), 'new-export.zip');

  const response = await fetch(`http://127.0.0.1:${port}/api/analyze`, {
    method: 'POST',
    body: formData,
  });

  const body = await response.json();

  assert.equal(response.ok, true);
  assert.equal(body.mode, 'zip');
  assert.equal(typeof body.reportHtml, 'string');
  assert.ok(Array.isArray(body.unfollowers));
  assert.ok(Array.isArray(body.newFollowers));
  assert.ok(Array.isArray(body.notFollowingBack));
});
