export const PANEL_HTML = String.raw`<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>مرورگر</title>
<style>
  :root {
    --bg: #f1f1f3; --section: #ffffff; --text: #171e1c; --hint: #8f9694;
    --separator: #e3e3e6; --fill: #f3f4f6;
    --accent: #1d8fd0; --accent-soft: rgba(29,143,208,.14);
    --green: #16bf6d; --purple: #7b5cf0; --orange: #f59e0b; --red: #e5484d;
    --glass: rgba(255,255,255,.8);
    --shadow: 0 1px 2px rgba(16,24,40,.04), 0 6px 18px -8px rgba(16,24,40,.12);
    --nav-shadow: 0 8px 24px rgba(0,0,0,.14);
    --frame: #0d1620;
  }
  :root[data-theme="dark"] {
    --bg: #0f1418; --section: #1a2026; --text: #eef2f1; --hint: #8b9692;
    --separator: #2a323a; --fill: #232b33;
    --accent: #3aa8e8; --accent-soft: rgba(58,168,232,.18);
    --glass: rgba(26,32,38,.8);
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 6px 18px -8px rgba(0,0,0,.5);
    --nav-shadow: 0 8px 24px rgba(0,0,0,.5);
    --frame: #05090d;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  html, body { height: 100%; }
  body {
    font-family: "Vazirmatn", Tahoma, "Segoe UI", system-ui, sans-serif;
    background: var(--frame); color: var(--text);
    display: flex; align-items: center; justify-content: center;
    -webkit-font-smoothing: antialiased;
  }
  button { font-family: inherit; border: 0; background: none; color: inherit; cursor: pointer; }
  input { font-family: inherit; color: inherit; }
  svg { width: 1em; height: 1em; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }

  /* ---------- قاب ---------- */
  .app {
    position: relative; width: 100%; max-width: 480px; height: 100dvh;
    background: var(--bg); border-radius: 44px; overflow: hidden;
    box-shadow: 0 0 0 8px #fff, 0 0 0 11px #0a2638, 0 30px 80px rgba(0,0,0,.55);
    display: flex; flex-direction: column; transition: background .3s;
  }
  @media (max-width: 440px) {
    body { align-items: stretch; }
    .app { width: 100%; max-width: none; height: 100dvh; border-radius: 0; box-shadow: none; }
  }

  .screen { flex: 1; overflow-y: auto; padding: max(14px, env(safe-area-inset-top)) 14px calc(96px + env(safe-area-inset-bottom)); scrollbar-width: none; }
  .screen::-webkit-scrollbar { display: none; }
  .page { display: none; flex-direction: column; gap: 14px; min-height: 100%; animation: fade .3s ease both; }
  .page.active { display: flex; }
  #home.page { height: 100%; min-height: 0; }
  @keyframes fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

  .card { background: var(--section); border-radius: 22px; box-shadow: var(--shadow); overflow: hidden; transition: background .3s; }

  /* ---------- خانه: مرورگر ---------- */
  .toolbar { display: flex; align-items: center; gap: 8px; }
  .icon-btn {
    width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
    background: var(--section); box-shadow: var(--shadow);
    display: grid; place-items: center; font-size: 20px; transition: transform .15s, opacity .2s;
  }
  .icon-btn:active { transform: scale(.9); }
  .icon-btn:disabled { opacity: .4; cursor: default; }
  .address {
    flex: 1; min-width: 0; height: 42px; border-radius: 99px; padding: 0 14px;
    background: var(--section); box-shadow: var(--shadow);
    display: flex; align-items: center; gap: 8px; direction: ltr;
  }
  .address .lock { color: var(--green); font-size: 16px; }
  .address .url { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .address .url span { color: var(--hint); font-weight: 500; }
  .address .fixed { font-size: 10.5px; font-weight: 700; color: var(--green); background: rgba(22,191,109,.14); padding: 3px 8px; border-radius: 99px; }
  .browser { position: relative; flex: 1; min-height: 0; background: var(--section); }
  .welcome { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 28px 22px; min-height: 360px; gap: 10px; }
  .welcome-icon { width: 78px; height: 78px; border-radius: 24px; display: grid; place-items: center; color: var(--accent); background: var(--accent-soft); }
  .welcome-icon svg { width: 42px; height: 42px; }
  .welcome h1 { font-size: 22px; font-weight: 800; margin-top: 4px; }
  .welcome p { color: var(--hint); font-size: 14px; line-height: 1.9; }
  .welcome .welcome-note { max-width: 280px; font-size: 12.5px; }
  .welcome .open-site { flex: none; width: min(260px, 90%); margin-top: 10px; }
  .loadbar { position: absolute; top: 0; inset-inline: 0; height: 3px; z-index: 3; background: transparent; }
  .loadbar span { display: block; height: 100%; width: 0; background: linear-gradient(90deg, var(--accent), var(--green)); transition: width .3s; }
  .overlay-msg {
    position: absolute; inset: 0; z-index: 2; background: var(--section); display: none;
    flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; padding: 24px;
  }
  .overlay-msg.show { display: flex; }
  .overlay-msg .big { font-size: 44px; color: var(--hint); }
  .overlay-msg p { font-size: 13px; color: var(--hint); line-height: 1.9; }
  .spin { width: 34px; height: 34px; border-radius: 50%; border: 3px solid var(--fill); border-top-color: var(--accent); animation: rot .8s linear infinite; }
  @keyframes rot { to { transform: rotate(360deg); } }

  /* ---------- دانلودها ---------- */
  .dl-head { padding: 16px 18px; display: flex; align-items: center; gap: 12px; }
  .dl-head .ic { width: 40px; height: 40px; border-radius: 13px; color: #fff; display: grid; place-items: center; font-size: 21px; flex-shrink: 0; }
  .dl-head h1 { font-size: 16px; font-weight: 800; }
  .dl-head p { font-size: 12px; color: var(--hint); margin-top: 2px; }
  .search { height: 48px; border-radius: 99px; background: var(--section); box-shadow: var(--shadow); display: flex; align-items: center; gap: 10px; padding: 0 16px; }
  .search svg { font-size: 20px; color: var(--accent); }
  .search input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font-size: 14.5px; }
  .search input::placeholder { color: var(--hint); }
  .search .clear { font-size: 16px; color: var(--hint); display: none; }
  .search.has .clear { display: block; }
  .list { padding: 8px; display: flex; flex-direction: column; gap: 8px; min-height: 120px; }
  .video { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 18px; background: var(--fill); animation: fade .3s both; }
  .play {
    width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0; color: #fff; font-size: 22px;
    display: grid; place-items: center;
    background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 78%, #fff), var(--accent));
    box-shadow: 0 8px 18px -8px var(--accent); transition: transform .15s;
  }
  .play:active { transform: scale(.92); }
  .video .info { flex: 1; min-width: 0; text-align: start; }
  .video .name { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
  .video .meta { font-size: 12px; color: var(--hint); margin-top: 3px; display: block; }
  .more { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font-size: 20px; color: var(--hint); transition: background .2s; }
  .more:active { background: var(--separator); }
  .empty { margin: auto; text-align: center; color: var(--hint); font-size: 13.5px; padding: 28px 10px; line-height: 2; }
  .empty svg { font-size: 40px; display: block; margin: 0 auto 6px; opacity: .6; }

  /* ---------- اعلان‌ها ---------- */
  #notifs .empty-full { margin: auto; text-align: center; color: var(--hint); font-size: 14px; }
  #notifs .empty-full svg { font-size: 54px; opacity: .35; display: block; margin: 0 auto 10px; }

  /* ---------- تنظیمات ---------- */
  .section-head { padding: 0 12px 7px; font-size: 13px; font-weight: 700; color: var(--hint); }
  .row { display: flex; align-items: center; gap: 12px; padding-inline-start: 16px; }
  .row .ic { width: 38px; height: 38px; border-radius: 12px; color: #fff; display: grid; place-items: center; font-size: 19px; flex-shrink: 0; }
  .row .body { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 13px 0; padding-inline-end: 16px; border-top: 1px solid var(--separator); }
  .row:first-child .body { border-top: 0; }
  .row .info { flex: 1; min-width: 0; }
  .row .title { display: block; font-size: 15.5px; font-weight: 600; }
  .row .sub { display: block; margin-top: 3px; font-size: 12.5px; color: var(--hint); }
  button.row { width: 100%; text-align: start; }
  .g-blue   { background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 78%, #fff), var(--accent)); }
  .g-green  { background: linear-gradient(180deg, color-mix(in srgb, var(--green) 78%, #fff), var(--green)); }
  .g-purple { background: linear-gradient(180deg, color-mix(in srgb, var(--purple) 78%, #fff), var(--purple)); }
  .g-orange { background: linear-gradient(180deg, color-mix(in srgb, var(--orange) 78%, #fff), var(--orange)); }
  .g-red    { background: linear-gradient(180deg, color-mix(in srgb, var(--red) 78%, #fff), var(--red)); }
  .switch { position: relative; width: 50px; height: 30px; flex-shrink: 0; }
  .switch input { position: absolute; opacity: 0; inset: 0; width: 100%; height: 100%; cursor: pointer; z-index: 1; }
  .switch i { position: absolute; inset: 0; border-radius: 30px; background: var(--separator); transition: background .25s; }
  .switch i::after { content: ""; position: absolute; top: 3px; inset-inline-start: 3px; width: 24px; height: 24px; border-radius: 50%; background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,.25); transition: inset-inline-start .25s; }
  .switch input:checked + i { background: var(--green); }
  .switch input:checked + i::after { inset-inline-start: 23px; }
  .seg { display: flex; background: var(--fill); border-radius: 12px; padding: 3px; }
  .seg button { padding: 6px 11px; border-radius: 9px; font-size: 12.5px; font-weight: 600; color: var(--hint); transition: .2s; }
  .seg button.on { background: var(--section); color: var(--text); box-shadow: 0 1px 4px rgba(0,0,0,.15); }
  .chev { color: var(--hint); font-size: 18px; transform: scaleX(-1); }
  .foot { text-align: center; font-size: 12px; color: var(--hint); }

  /* ---------- نوار پایین ---------- */
  .nav { position: absolute; inset-inline: 0; bottom: 0; z-index: 20; padding: 8px 12px max(14px, env(safe-area-inset-bottom)); display: flex; align-items: flex-end; gap: 10px; pointer-events: none; }
  .nav > * { pointer-events: auto; }
  .nav::before { content: ""; position: absolute; inset: 0; z-index: -1; background: linear-gradient(to top, var(--bg) 40%, transparent); }
  .glass { background: var(--glass); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid var(--separator); box-shadow: var(--nav-shadow); border-radius: 99px; }
  .round-btn { width: 62px; height: 62px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; color: var(--hint); font-size: 21px; transition: transform .15s, color .2s, background .2s; }
  .round-btn span { font-size: 10.5px; font-weight: 600; line-height: 1; }
  .round-btn:active { transform: scale(.94); }
  .round-btn.active { color: var(--accent); background: var(--accent-soft); }
  .tabs { flex: 1; height: 62px; padding: 6px; }
  .track { position: relative; height: 100%; display: flex; }
  .pill { position: absolute; top: 0; bottom: 0; width: calc(100% / 3); inset-inline-start: calc(var(--i, 0) * 100% / 3); border-radius: 99px; background: var(--accent-soft); transition: inset-inline-start .35s cubic-bezier(.3,1.3,.5,1), opacity .2s; }
  .tabs.off .pill { opacity: 0; }
  .tab { position: relative; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; color: var(--hint); font-size: 21px; transition: color .2s; }
  .tab span { font-size: 10.5px; font-weight: 600; line-height: 1; }
  .tab.active { color: var(--accent); }

  /* ---------- شیت‌ها و پخش‌کننده ---------- */
  .scrim { position: absolute; inset: 0; z-index: 30; background: rgba(0,0,0,.45); opacity: 0; pointer-events: none; transition: opacity .25s; }
  .scrim.show { opacity: 1; pointer-events: auto; }
  .sheet {
    position: absolute; inset-inline: 0; bottom: 0; z-index: 31; background: var(--section);
    border-radius: 28px 28px 0 0; padding: 10px 16px 24px; transform: translateY(105%); transition: transform .35s cubic-bezier(.3,1.1,.5,1);
  }
  .sheet.show { transform: none; }
  .sheet .grab { width: 40px; height: 5px; border-radius: 5px; background: var(--separator); margin: 0 auto 12px; }
  .sheet h3 { font-size: 15px; font-weight: 800; padding: 0 6px 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sheet .act { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 6px; border-radius: 14px; font-size: 15px; font-weight: 600; text-align: start; }
  .sheet .act:active { background: var(--fill); }
  .sheet .act .ic { width: 36px; height: 36px; border-radius: 11px; color: #fff; display: grid; place-items: center; font-size: 18px; }
  .sheet .act.danger { color: var(--red); }
  .sheet input.field { width: 100%; height: 48px; border-radius: 14px; border: 2px solid var(--separator); background: var(--fill); padding: 0 14px; font-size: 15px; outline: 0; margin: 4px 0 14px; }
  .sheet input.field:focus { border-color: var(--accent); }
  .sheet .p { font-size: 13.5px; color: var(--hint); line-height: 1.9; padding: 0 6px 14px; }
  .btns { display: flex; gap: 10px; }
  .btn { flex: 1; height: 46px; border-radius: 99px; font-size: 14.5px; font-weight: 700; color: #fff; background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 82%, #fff), var(--accent)); box-shadow: 0 6px 16px -6px var(--accent); transition: transform .15s; }
  .btn:active { transform: scale(.97); }
  .btn.ghost { background: var(--fill); color: var(--text); box-shadow: none; }
  .btn.red { background: linear-gradient(180deg, color-mix(in srgb, var(--red) 82%, #fff), var(--red)); box-shadow: 0 6px 16px -6px var(--red); }

  .player { position: absolute; inset: 0; z-index: 40; background: #000; display: none; flex-direction: column; }
  .player.show { display: flex; animation: fade .25s both; }
  .player .bar { display: flex; align-items: center; gap: 10px; padding: 18px 14px 10px; color: #fff; }
  .player .bar b { flex: 1; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .player .bar .icon-btn { background: rgba(255,255,255,.14); color: #fff; box-shadow: none; }
  .player video { flex: 1; min-height: 0; width: 100%; background: #000; }

  .toast { position: absolute; top: 14px; left: 50%; transform: translate(-50%, -90px); z-index: 60; background: var(--text); color: var(--bg); padding: 10px 18px; border-radius: 99px; font-size: 13px; font-weight: 600; box-shadow: 0 10px 30px rgba(0,0,0,.3); transition: transform .4s cubic-bezier(.3,1.4,.5,1); white-space: nowrap; }
  .toast.show { transform: translate(-50%, 0); }
</style>
</head>
<body>

<div class="app" id="app">
  <div class="toast" id="toast"></div>

  <main class="screen" id="screen">

    <!-- ===== خانه: مرورگر مستقل ===== -->
    <section class="page active" id="home">
      <div class="toolbar">
        <button class="icon-btn" id="backBtn" aria-label="بازگشت به صفحه قبل"><svg viewBox="0 0 24 24" style="transform:scaleX(-1)"><path d="M15 18l-6-6 6-6"/></svg></button>
        <div class="address" title="آدرس قفل شده است">
          <svg class="lock" viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>
          <div class="url"><span>https://</span>biomaze.ir<span>/</span></div>
          <i class="fixed" style="font-style:normal">قفل</i>
        </div>
        <button class="icon-btn" id="reloadBtn" aria-label="بارگذاری مجدد"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5"/></svg></button>
      </div>
      <div class="card welcome" id="browser">
        <div class="welcome-icon"><svg viewBox="0 0 24 24"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z"/></svg></div>
        <h1>ماز ویدیو</h1>
        <p>مرورگر مستقل و کتابخانهٔ ویدئوهای آفلاین</p>
        <p class="welcome-note">برای ورود به سایت و ذخیرهٔ ویدئو در حافظهٔ همین برنامه، دکمهٔ زیر را بزن.</p>
        <button class="btn open-site" id="openSiteBtn">باز کردن سایت</button>
      </div>
    </section>

    <!-- ===== دانلودها ===== -->
    <section class="page" id="downloads">
      <div class="card dl-head">
        <span class="ic g-blue"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></span>
        <div><h1>بخش دانلودهای داخلی مرورگر</h1><p id="count"></p></div>
      </div>
      <label class="search" id="searchBox">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input id="q" type="search" placeholder="جستجوی نام فایل…" autocomplete="off">
        <button class="clear" id="clearQ" aria-label="پاک کردن"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg></button>
      </label>
      <div class="card list" id="list"></div>
    </section>

    <!-- ===== اعلان‌ها (خالی) ===== -->
    <section class="page" id="notifs"></section>

    <!-- ===== تنظیمات مرورگر ===== -->
    <section class="page" id="settings">
      <div>
        <div class="section-head">نمایش</div>
        <div class="card">
          <div class="row"><span class="ic g-purple"><svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg></span><span class="body"><span class="info"><span class="title">پوسته</span></span>
            <div class="seg" id="themeSeg"><button data-t="light">روشن</button><button data-t="dark">تاریک</button><button data-t="auto" class="on">خودکار</button></div></span></div>
          <div class="row"><span class="ic g-blue"><svg viewBox="0 0 24 24"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg></span><span class="body"><span class="info"><span class="title">اندازه متن</span></span>
            <div class="seg" id="fontSeg"><button data-s="14">کوچک</button><button data-s="16" class="on">متوسط</button><button data-s="18">بزرگ</button></div></span></div>
        </div>
      </div>
      <div>
        <div class="section-head">مرورگر</div>
        <div class="card">
          <div class="row"><span class="ic g-green"><svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></span><span class="body"><span class="info"><span class="title">نسخه دسکتاپ</span><span class="sub">نمایش سایت به‌صورت کامپیوتر</span></span><label class="switch"><input type="checkbox" data-pref="desktop"><i></i></label></span></div>
          <div class="row"><span class="ic g-red"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M4.9 4.9l14.2 14.2"/></svg></span><span class="body"><span class="info"><span class="title">مسدود کردن پنجره‌های بازشو</span></span><label class="switch"><input type="checkbox" checked data-pref="popups"><i></i></label></span></div>
          <div class="row"><span class="ic g-orange"><svg viewBox="0 0 24 24"><path d="M13 2L3 14h8l-1 8 10-12h-8z"/></svg></span><span class="body"><span class="info"><span class="title">صرفه‌جویی در داده</span></span><label class="switch"><input type="checkbox" data-pref="saver"><i></i></label></span></div>
          <div class="row"><span class="ic g-blue"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></span><span class="body"><span class="info"><span class="title">دانلود خودکار ویدیو</span></span><label class="switch"><input type="checkbox" checked data-pref="autodl"><i></i></label></span></div>
        </div>
      </div>
      <div>
        <div class="section-head">حریم خصوصی</div>
        <div class="card">
          <button class="row" id="clearCache"><span class="ic g-orange"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></span><span class="body"><span class="info"><span class="title">پاک کردن حافظه نهان</span></span><svg class="chev" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></span></button>
          <button class="row" id="clearHist"><span class="ic g-red"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></span><span class="body"><span class="info"><span class="title">پاک کردن تاریخچه</span></span><svg class="chev" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></span></button>
        </div>
      </div>
      <p class="foot">نسخه ۱٫۰٫۰</p>
    </section>
  </main>

  <!-- ===== نوار پایین ===== -->
  <nav class="nav">
    <button class="round-btn glass" id="bell" data-page="notifs" aria-label="اعلان‌ها"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/></svg><span>اعلان</span></button>
    <div class="tabs glass" id="tabs">
      <div class="track" id="track" style="--i:0">
        <span class="pill"></span>
        <button class="tab active" data-page="home" data-i="0"><svg viewBox="0 0 24 24"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z"/></svg><span>خانه</span></button>
        <button class="tab" data-page="downloads" data-i="1"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg><span>دانلودها</span></button>
        <button class="tab" data-page="settings" data-i="2"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg><span>تنظیمات</span></button>
      </div>
    </div>
  </nav>

  <!-- شیت منو و ویرایش نام و حذف -->
  <div class="scrim" id="scrim"></div>
  <div class="sheet" id="sheet"></div>

  <!-- پخش‌کننده -->
  <div class="player" id="player">
    <div class="bar"><button class="icon-btn" id="closePlayer" aria-label="بستن"><svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button><b id="playerTitle"></b></div>
    <video id="video" controls playsinline></video>
  </div>
</div>

<script>
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const SITE = 'https://biomaze.ir/';   // آدرس قفل‌شده
  function send(message) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }
  }

  /* ---------- اعلان کوتاه ---------- */
  let tt;
  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2000); }

  /* ---------- ناوبری ---------- */
  function go(page) {
    $$('.page').forEach(p => p.classList.toggle('active', p.id === page));
    const tab = $(\`.tab[data-page="\${page}"]\`);
    $$('.tab').forEach(t => t.classList.toggle('active', t === tab));
    $('#tabs').classList.toggle('off', !tab);
    if (tab) $('#track').style.setProperty('--i', tab.dataset.i);
    $('#bell').classList.toggle('active', page === 'notifs');
    $('#screen').scrollTo({ top: 0 });
  }
  $$('.tab, #bell').forEach(b => b.addEventListener('click', () => go(b.dataset.page)));

  /* ---------- مرورگر مستقل ---------- */
  function load() {
    send({ type: 'open-site', url: SITE });
  }
  $('#reloadBtn').onclick = () => { load(); };
  $('#openSiteBtn').onclick = load;
  $('#backBtn').onclick = () => { history.back(); };     // به صفحه قبلی در تاریخچه‌ی مرورگر برمی‌گردد

  /* ---------- دانلودها ---------- */
  let videos = [];
  function requestFiles() { send({ type: 'list-files' }); }
  function receiveFiles(list) { videos = Array.isArray(list) ? list : []; renderList(); }
  window.receiveFiles = receiveFiles;
  const norm = s => s.replace(/ي/g, 'ی').replace(/ك/g, 'ک').toLowerCase();
  function renderList() {
    const q = norm($('#q').value.trim());
    $('#searchBox').classList.toggle('has', !!q);
    const shown = videos.filter(v => norm(v.name).includes(q));
    $('#count').textContent = \`\${fa(videos.length)} ویدیو ذخیره شده\`;
    $('#list').innerHTML = shown.length ? shown.map(v => \`
      <div class="video">
        <button class="play" data-open="\${v.id}" aria-label="پخش"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/></svg></button>
        <div class="info" data-open="\${v.id}" style="cursor:pointer"><span class="name">\${v.name.replace(/</g,'&lt;')}</span><span class="meta">\${fa(v.size)} مگابایت · \${v.date}</span></div>
        <button class="more" data-more="\${v.id}" aria-label="گزینه‌ها"><svg viewBox="0 0 24 24" style="transform:rotate(90deg)"><circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/></svg></button>
      </div>\`).join('')
      : \`<div class="empty"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>\${q ? 'فایلی با این نام پیدا نشد' : 'هنوز فایلی دانلود نشده است'}</div>\`;
  }
  $('#q').addEventListener('input', renderList);
  $('#clearQ').onclick = e => { e.preventDefault(); $('#q').value = ''; renderList(); $('#q').focus(); };
  $('#list').addEventListener('click', e => {
    const o = e.target.closest('[data-open]'), m = e.target.closest('[data-more]');
    if (o) openVideo(+o.dataset.open); else if (m) openMenu(+m.dataset.more);
  });

  /* پخش‌کننده */
  function openVideo(id) {
    const v = videos.find(x => x.id === id); if (!v) return;
    $('#playerTitle').textContent = v.name;
    send({ type: 'open-file', id: v.id });
  }
  $('#closePlayer').onclick = () => { $('#video').pause(); $('#player').classList.remove('show'); };

  /* شیت‌ها */
  const sheet = $('#sheet'), scrim = $('#scrim');
  function showSheet(html) { sheet.innerHTML = '<div class="grab"></div>' + html; sheet.classList.add('show'); scrim.classList.add('show'); }
  function hideSheet() { sheet.classList.remove('show'); scrim.classList.remove('show'); }
  scrim.onclick = hideSheet;
  const act = (a, id, cls, ic, label, g) => \`<button class="act \${cls}" data-act="\${a}" data-id="\${id}"><span class="ic \${g}"><svg viewBox="0 0 24 24">\${ic}</svg></span>\${label}</button>\`;
  function openMenu(id) {
    const v = videos.find(x => x.id === id);
    showSheet(\`<h3>\${v.name.replace(/</g,'&lt;')}</h3>\` +
      act('rename', id, '', '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>', 'ویرایش نام', 'g-blue') +
      act('delete', id, 'danger', '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', 'حذف فایل', 'g-red'));
  }
  sheet.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = +b.dataset.id, v = videos.find(x => x.id === id);
    if (b.dataset.act === 'rename') {
      showSheet(\`<h3>ویرایش نام</h3><input class="field" id="newName" value="\${v.name.replace(/"/g,'&quot;')}" maxlength="60"><div class="btns"><button class="btn ghost" data-act="cancel">لغو</button><button class="btn" data-act="saveName" data-id="\${id}">ذخیره</button></div>\`);
      setTimeout(() => { const i = $('#newName'); i.focus(); i.select(); }, 350);
    }
    if (b.dataset.act === 'saveName') {
      const n = $('#newName').value.trim(); if (!n) return toast('نام نمی‌تواند خالی باشد');
      v.name = n; hideSheet(); send({ type: 'rename-file', id, name: n });
    }
    if (b.dataset.act === 'delete') {
      showSheet(\`<h3>حذف فایل</h3><p class="p">«\${v.name.replace(/</g,'&lt;')}» برای همیشه حذف شود؟</p><div class="btns"><button class="btn ghost" data-act="cancel">لغو</button><button class="btn red" data-act="confirmDel" data-id="\${id}">حذف</button></div>\`);
    }
    if (b.dataset.act === 'confirmDel') { hideSheet(); send({ type: 'delete-file', id }); }
    if (b.dataset.act === 'cancel') hideSheet();
  });
  sheet.addEventListener('keydown', e => { if (e.key === 'Enter' && $('#newName')) $('[data-act="saveName"]').click(); });
  renderList();
  requestFiles();

  /* ---------- اعلان‌ها: خالی ---------- */

  /* ---------- تنظیمات ---------- */
  const root = document.documentElement;
  const mq = matchMedia('(prefers-color-scheme: dark)');
  function applyTheme(t) {
    root.dataset.theme = t === 'auto' ? (mq.matches ? 'dark' : 'light') : t;
    $$('#themeSeg button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    try { localStorage.setItem('theme', t); } catch (e) {}
  }
  let saved = 'auto'; try { saved = localStorage.getItem('theme') || 'auto'; } catch (e) {}
  applyTheme(saved); if (mq.addEventListener) mq.addEventListener('change', () => { if ($('#themeSeg .on').dataset.t === 'auto') applyTheme('auto'); });
  $$('#themeSeg button').forEach(b => b.onclick = () => applyTheme(b.dataset.t));
  $$('#fontSeg button').forEach(b => b.onclick = () => {
    $$('#fontSeg button').forEach(x => x.classList.toggle('on', x === b));
    document.body.style.fontSize = b.dataset.s + 'px';
  });
  $('#clearCache').onclick = () => { send({ type: 'clear-cache' }); toast('حافظه نهان پاک شد'); };
  $('#clearHist').onclick = () => { send({ type: 'clear-history' }); toast('تاریخچه پاک شد'); };
</script>
</body>
</html>
`;
