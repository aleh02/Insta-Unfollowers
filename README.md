# Instagram Unfollowers

One-repo app for Instagram export analysis.

- Node.js / Express backend
- React frontend
- Shared parser + diff logic
- Inline HTML report from API

## Requirements

- Node.js 18+
- npm

## Layout

```bash
insta-unfollowers/
├─ insta-unfollowers.js
├─ lib/
├─ server/
├─ client/
├─ export_old/
├─ export_new/
├─ .snapshots/
├─ .reports/
└─ package.json
```

## Install

```bash
npm install
```

## Run

Dev stack:

```bash
npm run dev
```

Backend: `http://localhost:3001`

Frontend: `http://localhost:5173`

Build frontend:

```bash
npm run build
```

Production backend:

```bash
npm start
```

CLI only:

```bash
node insta-unfollowers.js
```

## Upload Modes

Frontend accepts:

- Zip uploads
  - each zip must contain `followers_1.json` and `following.json`
- Folder uploads
  - browser directory picker for `export_old` and `export_new`
- Raw JSON uploads
  - `followers_1.json` and `following.json` for old and new exports

## API Response

`POST /api/analyze` returns inline JSON with:

- `counts`
- `unfollowers`
- `newFollowers`
- `notFollowingBack`
- `followingRecords`
- `reportHtml`

## CLI Behavior

CLI still reads local `export_old/` and `export_new/`, writes snapshots, and writes HTML report to `.reports/`.
