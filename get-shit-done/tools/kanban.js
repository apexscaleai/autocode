#!/usr/bin/env node
/**
 * AutoCode Kanban — lightweight visual board for GSD todos.
 *
 * Reads:
 *   .planning/todos/pending/*.md
 *   .planning/todos/done/*.md
 *
 * Moves cards by moving files between pending/ and done/.
 *
 * No dependencies; runs on Node 16+.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function parseArgs(argv) {
  const args = {
    host: '127.0.0.1',
    port: 3333,
    open: true,
    cwd: process.cwd(),
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--host' && argv[i + 1]) {
      args.host = argv[++i];
      continue;
    }
    if ((a === '--port' || a === '-p') && argv[i + 1]) {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid port: ${argv[i]}`);
      args.port = n;
      continue;
    }
    if (a === '--no-open') {
      args.open = false;
      continue;
    }
    if (a === '--open') {
      args.open = true;
      continue;
    }
    if ((a === '--cwd' || a === '-C') && argv[i + 1]) {
      args.cwd = argv[++i];
      continue;
    }
    if (a === '--help' || a === '-h') {
      args.help = true;
      continue;
    }
  }
  return args;
}

function ensureTodoDirs(root) {
  const pendingDir = path.join(root, '.planning', 'todos', 'pending');
  const doneDir = path.join(root, '.planning', 'todos', 'done');
  fs.mkdirSync(pendingDir, { recursive: true });
  fs.mkdirSync(doneDir, { recursive: true });
  return { pendingDir, doneDir };
}

function safeBasename(name) {
  const base = path.basename(name);
  if (base !== name) return null;
  if (!/^[a-zA-Z0-9._-]+\.md$/.test(base)) return null;
  return base;
}

function parseFrontmatter(md) {
  if (!md.startsWith('---')) return { frontmatter: {}, body: md };
  const end = md.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: {}, body: md };
  const fmRaw = md.slice(3, end).trim();
  const body = md.slice(end + '\n---'.length);

  const frontmatter = {};
  const lines = fmRaw.split(/\r?\n/);
  let currentKey = null;

  for (const line of lines) {
    const m = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (m) {
      currentKey = m[1];
      const value = m[2] || '';
      if (value === '') {
        frontmatter[currentKey] = [];
      } else {
        frontmatter[currentKey] = value;
      }
      continue;
    }
    const item = line.match(/^\s*-\s*(.*)$/);
    if (item && currentKey && Array.isArray(frontmatter[currentKey])) {
      frontmatter[currentKey].push(item[1]);
    }
  }

  return { frontmatter, body };
}

function readTodos(dir, status) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort();
  return files.map((file) => {
    const full = path.join(dir, file);
    let md = '';
    try {
      md = fs.readFileSync(full, 'utf8');
    } catch {
      md = '';
    }
    const { frontmatter } = parseFrontmatter(md);
    const title = (frontmatter.title || '').toString().trim() || file.replace(/\.md$/, '');
    const area = (frontmatter.area || '').toString().trim() || 'general';
    const created = (frontmatter.created || '').toString().trim() || '';
    const filesField = Array.isArray(frontmatter.files) ? frontmatter.files : [];

    return {
      id: file,
      status,
      title,
      area,
      created,
      files: filesField,
      path: full,
    };
  });
}

function json(res, code, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(body.length),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function text(res, code, body, contentType = 'text/plain; charset=utf-8') {
  const buf = Buffer.from(body);
  res.writeHead(code, {
    'content-type': contentType,
    'content-length': String(buf.length),
    'cache-control': 'no-store',
  });
  res.end(buf);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function openBrowser(url) {
  const platform = process.platform;
  const cmd =
    platform === 'darwin' ? 'open' :
      platform === 'win32' ? 'cmd' :
        'xdg-open';
  const args =
    platform === 'win32' ? ['/c', 'start', '', url] : [url];

  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.unref();
  } catch {
    // ignore
  }
}

function htmlPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>AutoCode Kanban</title>
    <style>
      :root{
        --bg:#0b0f16; --panel:#111827; --panel2:#0f172a;
        --text:#e5e7eb; --muted:#94a3b8; --border:#1f2937;
        --accent:#22d3ee; --danger:#fb7185;
        --shadow: 0 10px 30px rgba(0,0,0,.35);
      }
      *{box-sizing:border-box}
      body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:var(--text);background:radial-gradient(1200px 800px at 20% 0%, rgba(34,211,238,.14), transparent 45%), var(--bg);}
      header{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:18px 18px 10px}
      .brand{display:flex;gap:10px;align-items:center}
      .logo{width:12px;height:12px;border-radius:3px;background:var(--accent);box-shadow:0 0 0 4px rgba(34,211,238,.12)}
      h1{font-size:14px;letter-spacing:.14em;text-transform:uppercase;margin:0;color:var(--muted)}
      .controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      input,select,button{
        border:1px solid var(--border); background:rgba(17,24,39,.72); color:var(--text);
        border-radius:10px; padding:10px 12px; outline:none;
      }
      input{min-width:240px}
      button{cursor:pointer}
      button:hover{border-color:rgba(34,211,238,.55)}
      .wrap{padding:0 18px 18px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}
      .col{background:linear-gradient(180deg, rgba(17,24,39,.82), rgba(15,23,42,.7));border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow);min-height:72vh;overflow:hidden}
      .colHeader{display:flex;align-items:center;justify-content:space-between;padding:14px 14px 10px;border-bottom:1px solid var(--border)}
      .colTitle{font-weight:600}
      .count{color:var(--muted);font-size:12px}
      .lane{padding:12px;display:flex;flex-direction:column;gap:10px}
      .card{
        background:rgba(15,23,42,.88);
        border:1px solid rgba(148,163,184,.16);
        border-radius:14px;
        padding:12px;
      }
      .card[draggable="true"]{cursor:grab}
      .card:active{cursor:grabbing}
      .title{font-weight:650;line-height:1.2;margin:0 0 8px}
      .meta{display:flex;gap:10px;flex-wrap:wrap;color:var(--muted);font-size:12px}
      .pill{border:1px solid rgba(148,163,184,.22);padding:3px 8px;border-radius:999px}
      .file{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11px;opacity:.9}
      .hint{padding:10px 14px;color:var(--muted);font-size:12px;border-top:1px solid var(--border)}
      .drop{outline:2px dashed rgba(34,211,238,.55);outline-offset:-8px}
      .toast{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);background:rgba(17,24,39,.92);border:1px solid var(--border);border-radius:12px;padding:10px 12px;box-shadow:var(--shadow);color:var(--text);font-size:13px;display:none}
      .toast.bad{border-color:rgba(251,113,133,.55)}
      @media (max-width: 920px){ .grid{grid-template-columns:1fr} input{min-width: 160px} }
    </style>
  </head>
  <body>
    <header>
      <div class="brand">
        <div class="logo"></div>
        <div>
          <h1>AutoCode Kanban</h1>
          <div style="color:var(--muted);font-size:12px;margin-top:4px">Backed by <code>.planning/todos/</code> (drag cards between lanes)</div>
        </div>
      </div>
      <div class="controls">
        <input id="q" placeholder="Search title / area / filename…" />
        <select id="area">
          <option value="">All areas</option>
        </select>
        <button id="refresh">Refresh</button>
      </div>
    </header>
    <div class="wrap">
      <div class="grid">
        <section class="col" data-status="pending">
          <div class="colHeader">
            <div class="colTitle">Pending</div>
            <div class="count" id="count-pending">0</div>
          </div>
          <div class="lane" id="lane-pending"></div>
          <div class="hint">Drop here to mark as pending.</div>
        </section>
        <section class="col" data-status="done">
          <div class="colHeader">
            <div class="colTitle">Done</div>
            <div class="count" id="count-done">0</div>
          </div>
          <div class="lane" id="lane-done"></div>
          <div class="hint">Drop here to mark as done (work started).</div>
        </section>
      </div>
    </div>
    <div class="toast" id="toast"></div>
    <script>
      const elQ = document.getElementById('q');
      const elArea = document.getElementById('area');
      const elRefresh = document.getElementById('refresh');
      const toast = (msg, bad=false) => {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.className = 'toast' + (bad ? ' bad' : '');
        t.style.display = 'block';
        clearTimeout(window.__toastTimer);
        window.__toastTimer = setTimeout(()=>t.style.display='none', 2200);
      };

      let all = { pending: [], done: [] };

      function cardHTML(todo){
        const created = todo.created ? '<span class="pill">🕒 ' + todo.created + '</span>' : '';
        const area = '<span class="pill">#' + (todo.area || 'general') + '</span>';
        const file = '<div class="file">' + todo.id + '</div>';
        return \`
          <div class="card" draggable="true" data-id="\${todo.id}">
            <div class="title">\${escapeHtml(todo.title || todo.id)}</div>
            <div class="meta">\${area} \${created}</div>
            \${file}
          </div>\`;
      }
      function escapeHtml(s){
        return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      }

      function filters(){
        const q = (elQ.value || '').trim().toLowerCase();
        const area = (elArea.value || '').trim().toLowerCase();
        return { q, area };
      }

      function match(todo, f){
        if (f.area && (todo.area || '').toLowerCase() !== f.area) return false;
        if (!f.q) return true;
        const hay = [todo.title, todo.area, todo.id].join(' ').toLowerCase();
        return hay.includes(f.q);
      }

      function render(){
        const f = filters();
        const pending = all.pending.filter(t => match(t, f));
        const done = all.done.filter(t => match(t, f));
        document.getElementById('count-pending').textContent = pending.length;
        document.getElementById('count-done').textContent = done.length;
        document.getElementById('lane-pending').innerHTML = pending.map(cardHTML).join('');
        document.getElementById('lane-done').innerHTML = done.map(cardHTML).join('');
        wireDnD();
      }

      function buildAreaOptions(){
        const areas = new Set();
        for (const t of [...all.pending, ...all.done]) areas.add(t.area || 'general');
        const current = elArea.value;
        elArea.innerHTML = '<option value="">All areas</option>' + Array.from(areas).sort().map(a => \`<option value="\${escapeHtml(a)}">\${escapeHtml(a)}</option>\`).join('');
        elArea.value = current;
      }

      async function refresh(){
        const res = await fetch('/api/todos');
        all = await res.json();
        buildAreaOptions();
        render();
      }

      async function move(id, to){
        const res = await fetch('/api/move', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ id, to }) });
        if (!res.ok) {
          const j = await res.json().catch(()=>({error:'Failed'}));
          toast(j.error || 'Move failed', true);
          return;
        }
        toast('Moved: ' + id + ' → ' + to);
        await refresh();
      }

      function wireDnD(){
        for (const card of document.querySelectorAll('.card[draggable="true"]')){
          card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', card.dataset.id);
            e.dataTransfer.effectAllowed = 'move';
          });
        }
      }

      for (const col of document.querySelectorAll('.col')){
        col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drop'); });
        col.addEventListener('dragleave', () => col.classList.remove('drop'));
        col.addEventListener('drop', async (e) => {
          e.preventDefault();
          col.classList.remove('drop');
          const id = e.dataTransfer.getData('text/plain');
          const to = col.dataset.status;
          if (id && to) await move(id, to);
        });
      }

      elRefresh.addEventListener('click', refresh);
      elQ.addEventListener('input', render);
      elArea.addEventListener('change', render);

      refresh().catch(err => toast(err.message || String(err), true));
    </script>
  </body>
</html>`;
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    // eslint-disable-next-line no-console
    console.log(`AutoCode Kanban

Usage:
  node kanban.js [--port 3333] [--host 127.0.0.1] [--no-open] [--cwd <dir>]

Reads/writes:
  <cwd>/.planning/todos/{pending,done}/*.md
`);
    return;
  }

  const root = path.resolve(args.cwd);
  const { pendingDir, doneDir } = ensureTodoDirs(root);
  const ui = htmlPage();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/') {
      return text(res, 200, ui, 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && url.pathname === '/api/todos') {
      const pending = readTodos(pendingDir, 'pending');
      const done = readTodos(doneDir, 'done');
      return json(res, 200, { pending, done });
    }
    if (req.method === 'POST' && url.pathname === '/api/move') {
      let body = '';
      try {
        body = await readBody(req);
      } catch (e) {
        return json(res, 400, { error: e.message || 'Invalid body' });
      }
      let data;
      try {
        data = JSON.parse(body || '{}');
      } catch {
        return json(res, 400, { error: 'Body must be JSON' });
      }
      const id = safeBasename(String(data.id || ''));
      const to = String(data.to || '');
      if (!id) return json(res, 400, { error: 'Invalid id' });
      if (to !== 'pending' && to !== 'done') return json(res, 400, { error: 'Invalid destination' });
      const fromDir = to === 'pending' ? doneDir : pendingDir;
      const toDir = to === 'pending' ? pendingDir : doneDir;
      const fromPath = path.join(fromDir, id);
      const toPath = path.join(toDir, id);
      if (!fs.existsSync(fromPath)) return json(res, 404, { error: `Not found: ${id}` });
      try {
        fs.renameSync(fromPath, toPath);
      } catch (e) {
        return json(res, 500, { error: e.message || 'Move failed' });
      }
      return json(res, 200, { ok: true });
    }
    return text(res, 404, 'Not found\n');
  });

  await new Promise((resolve) => server.listen(args.port, args.host, resolve));
  const url = `http://${args.host}:${args.port}/`;
  // eslint-disable-next-line no-console
  console.log(`AutoCode Kanban running:\n  ${url}\n\nTodos:\n  ${pendingDir}\n  ${doneDir}\n`);

  if (args.open) openBrowser(url);
}

module.exports = { main };

if (require.main === module) {
  main(process.argv).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  });
}

