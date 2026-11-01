(() => {
const REPO = "Starkoz-mp3/Photos", ROOT = "images", IMG = /\.(jpe?g|png|webp|avif|gif)$/i;
const nice = s => { s = s.replace(/\.[^.]+$/, "").replace(/^[\d\s_-]+/, "").replace(/[-_]+/g, " ").trim(); return s.charAt(0).toUpperCase() + s.slice(1); };
const enc = (...p) => p.map(encodeURIComponent).join("/");
const say = (el, t) => { el.innerHTML = `<p class="msg">${t}</p>`; };
// On the home page a section with data-hide quietly disappears when it has nothing to show.
const none = (el, t) => el.hasAttribute("data-hide") ? el.closest("section").remove() : say(el, t);
const pics = l => l.filter(f => f.type === "file" && IMG.test(f.name)).map(f => f.name)
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const ls = async p => {
  const k = "ls:" + p;
  try { const c = sessionStorage.getItem(k); if (c) return JSON.parse(c); } catch (e) {}
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${p}`);
  if (!r.ok) throw new Error(r.status);
  const d = (await r.json()).map(f => ({ name: f.name, type: f.type }));
  try { sessionStorage.setItem(k, JSON.stringify(d)); } catch (e) {}
  return d;
};

// Albums page: one tile per folder inside images/. Cover = cover.* if present, else the first photo.
const A = document.getElementById("albums");
if (A) ls(ROOT)
  .then(l => Promise.all(l.filter(f => f.type === "dir" && f.name !== "highlights").map(async f => {
    const n = pics(await ls(`${ROOT}/${f.name}`));
    return { dir: f.name, cover: n.find(x => /^cover\./i.test(x)) || n[0] };
  })))
  .then(a => {
    a = a.filter(x => x.cover);
    if (!a.length) return none(A, "No albums yet. Add a folder of photos inside images.");
    a.forEach(x => {
      const t = document.createElement("a");
      t.className = "tile"; t.href = x.dir + ".html";
      t.innerHTML = `<img src="${enc(ROOT, x.dir, x.cover)}" alt=""><span>${nice(x.dir)}</span>`;
      A.appendChild(t);
    });
  })
  .catch(() => none(A, "Couldn’t load the albums. Check the repo name at the top of site.js."));

// Album page: justified rows of every photo in images/<album>/, with a viewer.
const G = document.getElementById("gallery");
if (G) {
  const dir = G.dataset.album; let names = [], i = 0, from = null;
  const box = document.createElement("div");
  box.id = "box"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
  box.innerHTML = '<button id="close" aria-label="Close">×</button><button id="prev" class="arrow" aria-label="Previous photo">‹</button><img id="big" alt=""><button id="next" class="arrow" aria-label="Next photo">›</button><div id="cap"></div>';
  document.body.appendChild(box);
  const big = box.querySelector("#big"), cap = box.querySelector("#cap");
  const show = (n, b) => {
    i = (n + names.length) % names.length; if (b) from = b;
    big.src = enc(ROOT, dir, names[i]); big.alt = cap.textContent = nice(names[i]);
    box.classList.add("open"); box.querySelector("#close").focus();
  };
  const hide = () => { box.classList.remove("open"); big.removeAttribute("src"); if (from) from.focus(); };
  box.querySelector("#close").onclick = hide;
  box.querySelector("#prev").onclick = () => show(i - 1);
  box.querySelector("#next").onclick = () => show(i + 1);
  box.addEventListener("click", e => { if (e.target === box) hide(); });
  document.addEventListener("keydown", e => {
    if (!box.classList.contains("open")) return;
    if (e.key === "Escape") hide();
    if (e.key === "ArrowLeft") show(i - 1);
    if (e.key === "ArrowRight") show(i + 1);
  });
  let x0 = null;
  box.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
  box.addEventListener("touchend", e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1));
  });
  const src = n => enc(ROOT, dir, n);
  const ratios = {};
  const makeBtn = k => {
    const n = names[k], b = document.createElement("button");
    b.setAttribute("aria-label", "Open photo " + (nice(n) || k + 1));
    b.innerHTML = `<img src="${src(n)}" decoding="async" alt="${nice(n)}">`;
    if (ratios[k]) b.style.setProperty("--r", ratios[k]);
    const im = b.firstChild;
    const shape = () => { if (im.naturalHeight) b.style.setProperty("--r", ratios[k] = im.naturalWidth / im.naturalHeight); };
    im.onload = shape; if (im.complete) shape();
    b.onclick = () => show(k, b);
    return b;
  };

  // Highlights preview (data-preview): a flush row or two of 3 to 8 photos, one per row on phones,
  // with a See more button that expands the rest in place.
  const preview = () => {
    const head = Math.min(names.length, 8);
    let open = false, lastW = 0;
    const btn = document.createElement("button");
    btn.className = "more"; G.after(btn);
    const pick = (W, gap, h) => {
      if (head <= 3) return head;
      const maxRows = W >= 1000 ? 2 : 1;
      let best = 0, bestFill = 0, fallback = 0;
      for (let K = 3; K <= head; K++) {
        let rows = 1, w = 0;
        for (let i = 0; i < K; i++) {
          const bw = ratios[i] * h;
          if (w && w + gap + bw > W) { rows++; w = bw; } else w += (w ? gap : 0) + bw;
        }
        const fill = w / W;
        if (rows <= maxRows && fill >= .75) best = K;
        if (rows <= maxRows && fill > bestFill) { bestFill = fill; fallback = K; }
      }
      return best || fallback || 3;
    };
    const render = () => {
      const W = lastW = G.clientWidth, stack = W < 600, gap = stack ? 6 : 10, h = W < 900 ? 220 : 300;
      G.style.setProperty("--h", h + "px");
      G.classList.toggle("stack", stack);
      G.classList.toggle("flush", !open);
      const K = open ? names.length : (stack ? Math.min(3, head) : pick(W, gap, h));
      G.textContent = "";
      for (let k = 0; k < K; k++) G.appendChild(makeBtn(k));
      btn.hidden = names.length <= K && !open;
      btn.textContent = open ? "Show less" : "See more";
    };
    btn.onclick = () => {
      open = !open; render();
      if (!open) G.closest("section").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    };
    let t; addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => { if (G.clientWidth !== lastW) render(); }, 150); });
    // Learn the shapes of the first few photos so the preview can be laid out flush.
    Promise.all(names.slice(0, head).map((n, k) => new Promise(done => {
      const im = new Image();
      im.onload = () => { ratios[k] = im.naturalWidth / im.naturalHeight; done(); };
      im.onerror = () => { ratios[k] = 1.5; done(); };
      im.src = src(n);
    }))).then(render);
  };

  ls(`${ROOT}/${dir}`).then(l => {
    names = pics(l).slice(0, +G.dataset.max || undefined);
    if (!names.length) return none(G, "No photos in this album yet.");
    if (G.hasAttribute("data-preview")) return preview();
    names.forEach((n, k) => G.appendChild(makeBtn(k)));
  }).catch(() => none(G, "Couldn’t load this album. Check the folder name and the repo name in site.js."));
}

// Footer on every page. Put your Instagram handle in INSTA (e.g. "stankozik"); empty hides the link.
const INSTA = "", EMAIL = "stan@stankozik.org";
const foot = document.createElement("footer");
foot.className = "foot";
foot.innerHTML = `<a href="mailto:${EMAIL}">${EMAIL}</a>${INSTA ? `<a href="https://instagram.com/${INSTA}" target="_blank" rel="noopener">Instagram</a>` : ""}<span>© ${new Date().getFullYear()} Stan Kozik</span>`;
document.body.appendChild(foot);
})();
