const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const SITE = 'https://biomaze.ir/';   // آدرس قفل‌شده
  let bridgeSeq = 0;
  function send(type, payload = {}) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ protocolVersion: 1, requestId: `panel-${Date.now()}-${bridgeSeq++}`, type, payload }));
    }
  }

  /* ---------- اعلان کوتاه ---------- */
  let tt;
  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2000); }

  /* WebViewهای اندروید گاهی click را با تأخیر یا دوبار ارسال می‌کنند. */
  function tap(el, fn) {
    if (!el) return;
    let last = 0;
    const run = e => { const now = Date.now(); if (now - last < 350) return; last = now; fn(e); };
    el.addEventListener('click', run);
    el.addEventListener('touchend', e => { e.preventDefault(); run(e); }, { passive: false });
  }

  /* ---------- ناوبری ---------- */
  function go(page) {
    $$('.page').forEach(p => p.classList.toggle('active', p.id === page));
    const tab = $(`.tab[data-page="${page}"]`);
    $$('.tab').forEach(t => t.classList.toggle('active', t === tab));
    $('#tabs').classList.toggle('off', !tab);
    if (tab) $('#track').style.setProperty('--i', tab.dataset.i);
    $('#bell').classList.toggle('active', page === 'notifs');
    $('#screen').scrollTo({ top: 0 });
    if (page === 'downloads') send('files.list');
  }
  $$('.tab, #bell').forEach(b => tap(b, () => go(b.dataset.page)));

  /* ---------- مرورگر مستقل ---------- */
  function load() {
    send('open-site', { url: SITE });
  }
  tap($('#openSiteBtn'), load);

  /* ---------- دانلودها ---------- */
  let videos = [];
  function receiveFilesSnapshot(snapshot) { videos = Array.isArray(snapshot?.files) ? snapshot.files : []; renderList(); }
  const fileName = v => v.displayName || v.name || v.fileName || 'ویدئوی آفلاین';
  const fileSize = v => Math.max(0, Math.round(Number(v.sizeBytes ?? v.size) / 1024 / 1024));
  const fileDate = v => {
    if (v.date) return v.date;
    if (v.createdAt) {
      try { return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short' }).format(new Date(v.createdAt)); } catch (e) { /* fallback below */ }
    }
    return 'ذخیره‌شده در این برنامه';
  };
  window.receiveFilesSnapshot = receiveFilesSnapshot;
  function receiveFiles(list) { receiveFilesSnapshot({ files: list }); }
  window.receiveFiles = receiveFiles;
  const norm = s => s.replace(/ي/g, 'ی').replace(/ك/g, 'ک').toLowerCase();
  function renderList() {
    const q = norm($('#q').value.trim());
    $('#searchBox').classList.toggle('has', !!q);
    const shown = videos.filter(v => norm(fileName(v)).includes(q));
    const totalMb = videos.reduce((sum, v) => sum + fileSize(v), 0);
    $('#videoCount').textContent = String(videos.length);
    $('#videoSize').textContent = `${totalMb} MB`;
    $('#list').innerHTML = shown.length ? shown.map(v => `
      <div class="video">
        <button class="play" data-open="${v.id}" aria-label="پخش"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/></svg></button>
        <div class="info" data-open="${v.id}" style="cursor:pointer"><span class="name">${fileName(v).replace(/</g,'&lt;')}</span><span class="meta">${fileSize(v)} MB · ${fileDate(v)}</span></div>
        <button class="more" data-more="${v.id}" aria-label="گزینه‌ها"><svg viewBox="0 0 24 24" style="transform:rotate(90deg)"><circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/></svg></button>
      </div>`).join('')
      : `<div class="empty"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><span class="empty-text">${q ? 'فایلی با این نام پیدا نشد' : 'در حال حاضر ویدیویی وجود ندارد'}</span></div>`;
  }
  $('#q').addEventListener('input', renderList);
  tap($('#clearQ'), e => { e.preventDefault(); $('#q').value = ''; renderList(); $('#q').focus(); });
  $('#list').addEventListener('click', e => {
    const o = e.target.closest('[data-open]'), m = e.target.closest('[data-more]');
    if (o) openVideo(o.dataset.open); else if (m) openMenu(m.dataset.more);
  });

  /* ---------- گزارش واقعی صفحه و حافظهٔ WebView ---------- */
  let pageReports = [];
  let reportTimer = null;
  function reportSummary(r) {
    if (!r) return 'هنوز گزارشی از صفحه دریافت نشده است.';
    const media = Array.isArray(r.media) ? r.media.length : 0;
    const links = Array.isArray(r.videoLinks) ? r.videoLinks.length : 0;
    const streamItems = Array.isArray(r.streams) ? r.streams : [];
    const streams = streamItems.length || (Array.isArray(r.videoLinks) ? r.videoLinks.filter(v => /\.(m3u8|mpd)(?:[?#]|$)/i.test(String(v.url || ''))).length : 0);
    const masters = streamItems.filter(v => v.kind === 'master' || v.isMaster).length;
    const segments = streamItems.reduce((sum, v) => sum + (Number(v.segmentCount) || (Array.isArray(v.segments) ? v.segments.length : 0)), 0);
    const variants = streamItems.reduce((sum, v) => sum + (Array.isArray(v.variants) ? v.variants.length : 0), 0);
    const resources = Array.isArray(r.resources) ? r.resources.length : 0;
    const db = Array.isArray(r.storage?.indexedDbNames) ? r.storage.indexedDbNames.length : 0;
    const cache = Array.isArray(r.storage?.cacheNames) ? r.storage.cacheNames.length : 0;
    return `صفحه: ${r.title || r.url}\nرسانه‌ها: ${media} · لینک‌های ویدئویی: ${links} · playlist: ${streams} · master: ${masters}\nکیفیت‌ها: ${variants} · segmentها: ${segments} · منابع شبکه: ${resources}\nIndexedDB: ${db} پایگاه · Cache: ${cache} مورد\nزمان ثبت: ${r.capturedAt || 'نامشخص'}`;
  }
  function renderReport() {
    const current = pageReports[0];
    $('#reportSummary').textContent = reportSummary(current);
    $('#reportJson').textContent = current ? JSON.stringify({ generatedAt: new Date().toISOString(), pages: pageReports }, null, 2) : '';
    $('#reportJson').classList.toggle('show', !!current);
    $('#saveReport').disabled = !pageReports.length;
  }
  function receivePageReports(list) { clearTimeout(reportTimer); pageReports = Array.isArray(list) ? list : []; renderReport(); }
  function receiveReportStatus(message) {
    clearTimeout(reportTimer);
    $('#reportSummary').textContent = String(message || 'از صفحهٔ سایت پاسخی دریافت نشد؛ ابتدا سایت را باز کنید و دوباره تلاش کنید.');
    $('#reportJson').textContent = '';
    $('#reportJson').classList.remove('show');
    $('#saveReport').disabled = true;
  }
  function receiveReportSaved(result) { toast(`گزارش ذخیره شد: ${result?.name || 'فایل گزارش'}`); }
  window.receivePageReports = receivePageReports;
  window.receiveReportStatus = receiveReportStatus;
  window.receiveReportSaved = receiveReportSaved;
  tap($('#refreshReport'), () => {
    clearTimeout(reportTimer);
    $('#reportSummary').textContent = 'در حال استخراج اطلاعات صفحهٔ فعلی…';
    $('#reportJson').classList.remove('show');
    $('#saveReport').disabled = true;
    send('report.refresh');
    reportTimer = setTimeout(() => receiveReportStatus('از صفحهٔ سایت در مهلت تعیین‌شده پاسخی دریافت نشد؛ صفحهٔ ویدئو را باز کنید و دوباره تلاش کنید.'), 10000);
  });
  tap($('#saveReport'), () => { if (pageReports.length) send('report.save'); });

  /* پخش‌کننده */
  function openVideo(id) {
    const v = videos.find(x => x.id === id); if (!v) return;
    $('#playerTitle').textContent = fileName(v);
    send('file.open', { id: v.id });
  }
  $('#closePlayer').onclick = () => { $('#video').pause(); $('#player').classList.remove('show'); };

  /* شیت‌ها */
  const sheet = $('#sheet'), scrim = $('#scrim');
  function showSheet(html) { sheet.innerHTML = '<div class="grab"></div>' + html; sheet.classList.add('show'); scrim.classList.add('show'); }
  function hideSheet() { sheet.classList.remove('show'); scrim.classList.remove('show'); }
  scrim.onclick = hideSheet;
  const act = (a, id, cls, ic, label, g) => `<button class="act ${cls}" data-act="${a}" data-id="${id}"><span class="ic ${g}"><svg viewBox="0 0 24 24">${ic}</svg></span>${label}</button>`;
  function openMenu(id) {
    const v = videos.find(x => x.id === id);
    showSheet(`<h3>${fileName(v).replace(/</g,'&lt;')}</h3>` +
      act('rename', id, '', '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>', 'ویرایش نام', 'g-blue') +
      act('delete', id, 'danger', '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', 'حذف فایل', 'g-red'));
  }
  sheet.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.dataset.id, v = videos.find(x => x.id === id);
    if (b.dataset.act === 'rename') {
      showSheet(`<h3>ویرایش نام</h3><input class="field" id="newName" value="${fileName(v).replace(/"/g,'&quot;')}" maxlength="60"><div class="btns"><button class="btn ghost" data-act="cancel">لغو</button><button class="btn" data-act="saveName" data-id="${id}">ذخیره</button></div>`);
      setTimeout(() => { const i = $('#newName'); i.focus(); i.select(); }, 350);
    }
    if (b.dataset.act === 'saveName') {
      const n = $('#newName').value.trim(); if (!n) return toast('نام نمی‌تواند خالی باشد');
      v.displayName = n; hideSheet(); send('file.rename', { id, name: n });
    }
    if (b.dataset.act === 'delete') {
      showSheet(`<h3>حذف فایل</h3><p class="p">«${fileName(v).replace(/</g,'&lt;')}» برای همیشه حذف شود؟</p><div class="btns"><button class="btn ghost" data-act="cancel">لغو</button><button class="btn red" data-act="confirmDel" data-id="${id}">حذف</button></div>`);
    }
    if (b.dataset.act === 'confirmDel') { hideSheet(); send('file.delete', { id }); }
    if (b.dataset.act === 'cancel') hideSheet();
  });
  sheet.addEventListener('keydown', e => { if (e.key === 'Enter' && $('#newName')) $('[data-act="saveName"]').click(); });
  renderList();

  /* ---------- اعلان‌ها: خالی ---------- */

  /* ---------- تنظیمات ---------- */
  const root = document.documentElement;
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : { matches: false, addEventListener: () => {} };
  function applyTheme(t) {
    const resolved = t === 'auto' ? (mq.matches ? 'dark' : 'light') : t;
    root.dataset.theme = resolved;
    $$('#themeSeg button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    try { localStorage.setItem('theme', t); } catch (e) {}
    send('theme-change', { selected: t, resolved });
  }
  let saved = 'auto'; try { saved = localStorage.getItem('theme') || 'auto'; } catch (e) {}
  applyTheme(saved); if (mq.addEventListener) mq.addEventListener('change', () => { if ($('#themeSeg .on').dataset.t === 'auto') applyTheme('auto'); });
  function chooseTheme(e) { const b = e.currentTarget || (e.target && e.target.closest ? e.target.closest('button[data-t]') : null); if (!b) return; if (e.cancelable) e.preventDefault(); applyTheme(b.dataset.t); }
  $$('#themeSeg button').forEach(b => { b.addEventListener('click', chooseTheme); b.addEventListener('touchend', chooseTheme, { passive: false }); b.addEventListener('pointerup', chooseTheme); });
  send('panel.ready', { page: 'panel', version: 1 });
