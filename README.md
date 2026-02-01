# Instagram Unfollowers (JSON Export)

A **local, privacy-safe** tool to find who unfollowed you on Instagram using **official Instagram JSON exports**.

- No login
- No API
- No third-party services
- Runs locally with **Node.js**
- Generates a **clickable HTML report**

---

## 📂 Folder structure

Your project should look like this:

```bash
insta-unfollowers/
├─ insta-unfollowers.js
├─ export_old/
│ └─ followers_1.json
│ └─ following.json
├─ export_new/
│ └─ followers_1.json
│ └─ following.json
├─ .snapshots/ (auto-generated)
├─ .reports/ (auto-generated)
└─ .gitignore
```

---

## 🚀 How to use

### 1) Put your Instagram exports in the folders
- Old export → `export_old/`
- New export → `export_new/`

(Do **not** rename the JSON files.)

---

### 2) Run the script
From the project folder:

```bash
node insta-unfollowers.js
```

---

## 📊 What it does automatically

- Reads both exports

- Creates timestamped snapshots

- Compares followers (old → new)

- Detects:

    - ❌ Unfollowers

    - ➕ New followers

- Generates an HTML report with clickable Instagram profile links

---

## 📄 Where is the report?

The report is saved locally in:

```bash
./.reports/
```

Example:

```bash
.reports/report__20260201_190244__old__TO__new.html
```

Open it:

- VS Code: right-click .reports → Reveal in File Explorer

- WSL terminal:

```bash
explorer.exe "$(wslpath -w ./.reports)"
```

Then double-click the HTML file.

---

## 🔒 Privacy & safety

- Uses only your local Instagram export

- No network requests

- No tracking

- Nothing leaves your machine

---

## 🛠 Requirements

- Node.js ≥ 16

- Works on:

- Windows (WSL recommended)

- Linux

- macOS

---

## 🧩 Notes

- Instagram exports can change structure slightly — the parser is defensive and recursive.

- The tool compares followers only (correct definition of “unfollowed you”).

- Snapshots are kept so you can compare different points in time.

---

## 📄 License

This project is licensed under the **MIT License**.  
See the [LICENSE](./LICENSE) file for details.

---

## 👤 Author

Alessandro Han

Computer Science, University of Pisa

LinkedIn: https://www.linkedin.com/in/alessandro-han-b87391223/