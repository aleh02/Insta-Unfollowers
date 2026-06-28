import { useMemo, useState } from 'react';

const MODES = [
  { value: 'zip', label: 'Zip uploads', hint: 'Each zip must contain followers_1.json and following.json.' },
  { value: 'folder', label: 'Folder uploads', hint: 'Pick export folders directly from browser.' },
  { value: 'json', label: 'Raw JSON files', hint: 'Upload followers_1.json and following.json for old/new exports.' },
];

function fileLabel(file) {
  if (!file) return 'No file selected';
  return file.webkitRelativePath || file.name;
}

function toItems(list) {
  return Array.isArray(list) ? list : [];
}

export default function App() {
  const [mode, setMode] = useState('zip');
  const [oldZip, setOldZip] = useState(null);
  const [newZip, setNewZip] = useState(null);
  const [oldFolderFiles, setOldFolderFiles] = useState([]);
  const [newFolderFiles, setNewFolderFiles] = useState([]);
  const [oldFollowers, setOldFollowers] = useState(null);
  const [oldFollowing, setOldFollowing] = useState(null);
  const [newFollowers, setNewFollowers] = useState(null);
  const [newFollowing, setNewFollowing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const counts = useMemo(() => result?.counts || null, [result]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('mode', mode);

      if (mode === 'zip') {
        if (!oldZip || !newZip) throw new Error('Upload both zip files');
        formData.append('oldZip', oldZip);
        formData.append('newZip', newZip);
      }

      if (mode === 'folder') {
        if (!oldFolderFiles.length || !newFolderFiles.length) throw new Error('Upload both export folders');
        oldFolderFiles.forEach((file) => formData.append('oldFiles', file, file.webkitRelativePath || file.name));
        newFolderFiles.forEach((file) => formData.append('newFiles', file, file.webkitRelativePath || file.name));
      }

      if (mode === 'json') {
        if (!oldFollowers || !oldFollowing || !newFollowers || !newFollowing) {
          throw new Error('Upload all 4 JSON files');
        }
        formData.append('oldFollowers', oldFollowers);
        formData.append('oldFollowing', oldFollowing);
        formData.append('newFollowers', newFollowers);
        formData.append('newFollowing', newFollowing);
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setResult(data);
    } catch (submitError) {
      setError(submitError.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="glow glow-a" />
      <div className="glow glow-b" />
      <section className="shell">
        <header className="hero">
          <div className="eyebrow">Instagram export analyzer</div>
          <h1>Find unfollowers from export_old and export_new.</h1>
          <p>
            Upload zip files, folders, or raw JSON. Backend does diff, frontend shows result inline.
          </p>
          <div className="hero-meta">
            <span>Node.js backend</span>
            <span>React frontend</span>
            <span>Inline HTML report</span>
          </div>
        </header>

        <form className="panel form" onSubmit={handleSubmit}>
          <div className="mode-grid" role="tablist" aria-label="Upload mode">
            {MODES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={mode === item.value ? 'mode active' : 'mode'}
                onClick={() => {
                  setMode(item.value);
                  setError('');
                  setResult(null);
                }}
              >
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
              </button>
            ))}
          </div>

          {mode === 'zip' && (
            <div className="two-up">
              <label className="upload-card">
                <span>Old export zip</span>
                <input type="file" accept=".zip" onChange={(event) => setOldZip(event.target.files?.[0] || null)} />
                <em>{fileLabel(oldZip)}</em>
              </label>
              <label className="upload-card">
                <span>New export zip</span>
                <input type="file" accept=".zip" onChange={(event) => setNewZip(event.target.files?.[0] || null)} />
                <em>{fileLabel(newZip)}</em>
              </label>
            </div>
          )}

          {mode === 'folder' && (
            <div className="two-up">
              <label className="upload-card">
                <span>Old export folder</span>
                <input
                  type="file"
                  multiple
                  webkitdirectory=""
                  directory=""
                  onChange={(event) => setOldFolderFiles(toItems(event.target.files))}
                />
                <em>{oldFolderFiles.length ? `${oldFolderFiles.length} files selected` : 'Pick export_old folder'}</em>
              </label>
              <label className="upload-card">
                <span>New export folder</span>
                <input
                  type="file"
                  multiple
                  webkitdirectory=""
                  directory=""
                  onChange={(event) => setNewFolderFiles(toItems(event.target.files))}
                />
                <em>{newFolderFiles.length ? `${newFolderFiles.length} files selected` : 'Pick export_new folder'}</em>
              </label>
            </div>
          )}

          {mode === 'json' && (
            <div className="two-up json-grid">
              <label className="upload-card">
                <span>Old followers_1.json</span>
                <input type="file" accept="application/json,.json" onChange={(event) => setOldFollowers(event.target.files?.[0] || null)} />
                <em>{fileLabel(oldFollowers)}</em>
              </label>
              <label className="upload-card">
                <span>Old following.json</span>
                <input type="file" accept="application/json,.json" onChange={(event) => setOldFollowing(event.target.files?.[0] || null)} />
                <em>{fileLabel(oldFollowing)}</em>
              </label>
              <label className="upload-card">
                <span>New followers_1.json</span>
                <input type="file" accept="application/json,.json" onChange={(event) => setNewFollowers(event.target.files?.[0] || null)} />
                <em>{fileLabel(newFollowers)}</em>
              </label>
              <label className="upload-card">
                <span>New following.json</span>
                <input type="file" accept="application/json,.json" onChange={(event) => setNewFollowing(event.target.files?.[0] || null)} />
                <em>{fileLabel(newFollowing)}</em>
              </label>
            </div>
          )}

          <div className="actions">
            <button className="submit" type="submit" disabled={loading}>
              {loading ? 'Analyzing…' : 'Run analysis'}
            </button>
            <span className="hint">Zip must contain followers_1.json and following.json.</span>
          </div>

          {error && <div className="error">{error}</div>}
        </form>

        {result && (
          <section className="results">
            <div className="panel stats-panel">
              <div className="stat-row">
                <article>
                  <span>Unfollowers</span>
                  <strong>{result.unfollowers.length}</strong>
                </article>
                <article>
                  <span>New followers</span>
                  <strong>{result.newFollowers.length}</strong>
                </article>
                <article>
                  <span>Not following back</span>
                  <strong>{result.notFollowingBack.length}</strong>
                </article>
                <article>
                  <span>Following total</span>
                  <strong>{counts?.following || 0}</strong>
                </article>
              </div>
            </div>

            <div className="panel list-grid">
              <ResultList title={`Unfollowers (${result.unfollowers.length})`} items={result.unfollowers} dated />
              <ResultList title={`New followers (${result.newFollowers.length})`} items={result.newFollowers} />
              <ResultList title={`Not following back (${result.notFollowingBack.length})`} items={result.notFollowingBack} dated />
            </div>

            <div className="panel html-panel">
              <div className="panel-head">
                <h2>Backend HTML report</h2>
                <span>Returned inline from API</span>
              </div>
              <iframe title="Instagram report" srcDoc={result.reportHtml} />
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function ResultList({ title, items, dated = false }) {
  return (
    <article className="list-card">
      <div className="panel-head">
        <h2>{title}</h2>
        <span>{items.length} entries</span>
      </div>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item.username}>
              <a href={item.profileUrl} target="_blank" rel="noreferrer">
                @{item.username}
              </a>
              {dated && item.timestamp ? <em>followed {new Date(item.timestamp * 1000).toLocaleString()}</em> : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">None 🎉</div>
      )}
    </article>
  );
}
