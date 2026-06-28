# Instagram Unfollowers

Web app and CLI for comparing two Instagram data exports.

It reports:

- accounts that stopped following you;
- new followers;
- accounts you follow that do not follow you back;
- follower and following totals.

All analysis runs locally on your machine or server. Uploaded files are processed
in memory and are not stored by the web app.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- npm

## Installation

```bash
git clone https://github.com/aleh02/Insta-Unfollowers.git
cd Insta-Unfollowers
npm install
```

## Get Instagram export files

From Instagram, open:

1. **Settings**
2. **Accounts Center**
3. **Your information and permissions**
4. **Export your information**
5. **Create export**
6. **Export to device**

Select JSON format and the **Followers and following** category. Download one
export now and compare it with an older export.

Each export must include:

```text
followers_and_following/
├── followers_1.json
└── following.json
```

Instagram may place these files in a differently named parent directory. Only
the two JSON filenames matter.

> Export files contain personal data. Do not commit or share them.

## Web app

Start backend and frontend in development mode:

```bash
npm run dev
```

- Frontend: <http://localhost:5173>
- API: <http://localhost:3001>

The app supports three upload modes:

- **Zip:** one old export and one new export; each archive must contain
  `followers_1.json` and `following.json`.
- **Folder:** select old and new export directories.
- **Raw JSON:** select both required JSON files for each export.

Maximum upload size is 25 MB per file.

## CLI

Create these directories in the project root:

```text
export_old/
├── followers_1.json
└── following.json

export_new/
├── followers_1.json
└── following.json
```

The files may also remain inside a `followers_and_following/` subdirectory.
Then run:

```bash
node insta-unfollowers.js
```

The CLI writes:

- JSON snapshots to `.snapshots/`;
- an HTML comparison report to `.reports/`;
- a summary to the terminal.

## Production

Build the React frontend and start the Express server:

```bash
npm run build
npm start
```

The production server listens on `PORT`, defaulting to `3001`, and serves both
the API and built frontend.

Example:

```bash
PORT=8080 npm start
```

### Update a PM2 deployment

Replace SSH key path, host, and project directory with values used by your VM:

```bash
ssh -i ~/.ssh/your-key.pem ubuntu@YOUR_SERVER_IP
cd ~/Insta-Unfollowers
git pull --ff-only
npm install
npm run build
pm2 restart insta-unfollowers --update-env
```

Check deployment:

```bash
pm2 status
pm2 logs insta-unfollowers --lines 50
```

## API

`GET /api/health` returns:

```json
{
  "ok": true
}
```

`POST /api/analyze` accepts `multipart/form-data` and returns:

```text
mode
counts
unfollowers
newFollowers
notFollowingBack
followingRecords
reportHtml
```

## Development

```bash
npm test
npm run build
```

Project structure:

```text
insta-unfollowers/
├── client/                # React frontend
├── server/                # Express API and production server
├── lib/instagram.js       # Shared parsing, comparison, and report logic
├── test/                  # Node.js tests
├── insta-unfollowers.js   # CLI entry point
└── package.json
```

## License

[MIT](LICENSE)
