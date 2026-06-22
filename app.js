// ===== 游戏状态 =====
const D = window.GAME_DATA;
const SAVE_KEY = "idol_sim_save_v1";

const defaultState = () => {
  const stats = {}, res = {};
  D.theme.stats.forEach(s => stats[s.key] = 10);
  D.theme.resources.forEach(r => res[r.key] = r.init);
  return {
    name: "",
    stats, res,
    day: 1,
    flags: {},
    posts: [],          // 已发布的动态文本
    running: null,      // 当前正在跑的行程 {id, until, gain}
    triggered: {},      // 已触发过的剧情事件id
    daily: { trainCount: 0, postCount: 0, schedCount: 0, claimed: {} },
    chats: [],          // 群聊历史
    page: "home",
    ended: null
  };
};

let S = loadState() || defaultState();

function saveState() { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }
function loadState() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s; } catch (e) { return null; }
}
function resetState() {
  if (!confirm("重新开始？当前存档将被清除。")) return;
  localStorage.removeItem(SAVE_KEY);
  S = defaultState();
  render();
}

// ===== 工具 =====
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function fmt(n) {
  if (n == null) return "0";
  if (n >= 100000000) return (n/100000000).toFixed(2) + "亿";
  if (n >= 10000)     return (n/10000).toFixed(1) + "万";
  return n.toString();
}
function now() { return Date.now(); }

function applyGain(gain, sourceName) {
  if (!gain) return;
  for (const k in gain) {
    const v = gain[k];
    if (k === "energy") {
      // energy 走 res 通道，但 cost 是减 energy
      S.res.energy = clamp((S.res.energy||0) + v, 0, 100);
    } else if (S.res[k] !== undefined) {
      const cap = D.theme.resources.find(r => r.key === k)?.max;
      S.res[k] = (S.res[k]||0) + v;
      if (cap != null) S.res[k] = clamp(S.res[k], 0, cap);
      if (S.res[k] < 0) S.res[k] = 0;
    } else if (S.stats[k] !== undefined) {
      S.stats[k] = clamp((S.stats[k]||0) + v, 0, 100);
    }
  }
  if (sourceName) log(`${sourceName} 完成 → ${formatGain(gain)}`);
}
function formatGain(g) {
  const parts = [];
  for (const k in g) {
    const v = g[k];
    if (v === 0) continue;
    const stat = D.theme.stats.find(s => s.key === k);
    const r    = D.theme.resources.find(r => r.key === k);
    const name = stat?.name || r?.name || k;
    parts.push(`${name}${v>0?"+":""}${v}`);
  }
  return parts.join(" / ");
}

function log(msg) {
  const t = `Day ${S.day}`;
  const lines = document.querySelector("#log-lines");
  if (lines) {
    const div = document.createElement("div");
    div.className = "log-line";
    div.innerHTML = `<span class="t">${t}</span>${msg}`;
    lines.prepend(div);
    while (lines.children.length > 30) lines.removeChild(lines.lastChild);
  }
}

// ===== 检查要求/奖励触发 =====
function checkRequires(req) {
  if (!req) return { ok: true, missing: [] };
  const missing = [];
  for (const k in req) {
    const need = req[k];
    const have = S.stats[k] ?? S.res[k] ?? 0;
    if (have < need) {
      const stat = D.theme.stats.find(s => s.key === k);
      const r    = D.theme.resources.find(r => r.key === k);
      missing.push(`${stat?.name || r?.name || k} ${have}/${need}`);
    }
  }
  return { ok: missing.length === 0, missing };
}

function checkEvents() {
  for (const ev of D.events) {
    if (S.triggered[ev.id]) continue;
    const ok = checkRequires(ev.trigger).ok;
    if (ok) {
      S.triggered[ev.id] = true;
      showEventModal(ev);
      return;  // 一次只触发一个
    }
  }
}

function checkEnding() {
  // 没达到100万粉丝不算"结局阶段"
  if ((S.res.fans||0) < 1000000) return null;
  for (const e of D.endings) {
    if (e.flag && !S.flags[e.flag]) continue;
    if (checkRequires(e.cond).ok) return e;
  }
  return null;
}

// ===== 推进时间（每次行动） =====
function tick(cost) {
  // 体力消耗
  if (cost > 0) {
    if (S.res.energy < cost) {
      alert("体力不足，先休息一下。");
      return false;
    }
    S.res.energy -= cost;
  } else if (cost < 0) {
    S.res.energy = clamp(S.res.energy - cost, 0, 100);
  }
  S.day += 1;
  // 每日任务在天数变化后随机加一条群聊
  if (Math.random() < 0.6) {
    const c = D.fan_chats[Math.floor(Math.random()*D.fan_chats.length)];
    S.chats.push({ ...c, day: S.day });
    if (S.chats.length > 50) S.chats.shift();
  }
  checkEvents();
  saveState();
  return true;
}

// ===== 动作：训练 =====
function doTrain(id) {
  const t = D.trainings.find(x => x.id === id);
  if (!t) return;
  if (!tick(t.cost)) return;
  applyGain(t.gain, t.name);
  if (t.cost > 0) {
    S.daily.trainCount += 1;
    checkDailyTasks();
  }
  render();
}

// ===== 动作：发布行程 =====
function startSchedule(id) {
  if (S.running) { alert("当前已有行程进行中。"); return; }
  const sc = D.schedules.find(x => x.id === id);
  if (!sc) return;
  const req = checkRequires(sc.requires);
  if (!req.ok) { alert("条件不足：" + req.missing.join("、")); return; }
  if (S.res.energy < sc.cost) { alert("体力不足。"); return; }
  S.res.energy -= sc.cost;
  S.running = { id, startedDay: S.day, duration: sc.duration, until: S.day + sc.duration };
  log(`开始行程：${sc.name}（持续${sc.duration}天）`);
  saveState();
  render();
}

function advanceSchedule() {
  if (!S.running) return;
  const sc = D.schedules.find(x => x.id === S.running.id);
  S.day += 1;
  if (S.day >= S.running.until) {
    applyGain(sc.gain, sc.name);
    S.running = null;
    S.daily.schedCount += 1;
    checkDailyTasks();
    checkEvents();
  }
  saveState();
  render();
}

// ===== 动作：发动态 =====
function doPost() {
  if (!tick(5)) return;
  const text = D.posts[Math.floor(Math.random()*D.posts.length)];
  S.posts.push({ text, day: S.day });
  applyGain({ fans: 300, exposure: 2 }, "发布动态");
  S.daily.postCount += 1;
  checkDailyTasks();
  render();
}

// ===== 动作：商城购买 =====
function buyItem(id) {
  const item = D.shop.find(x => x.id === id);
  if (!item) return;
  if (S.res.coin < item.price) { alert("金币不足。"); return; }
  S.res.coin -= item.price;
  applyGain(item.gain, `购买 ${item.name}`);
  saveState();
  render();
}

// ===== 每日任务 =====
function checkDailyTasks() {
  for (const t of D.daily_tasks) {
    if (S.daily.claimed[t.id]) continue;
    let met = true;
    for (const k in t.target) {
      if ((S.daily[k]||0) < t.target[k]) { met = false; break; }
    }
    if (met) {
      S.daily.claimed[t.id] = true;
      applyGain(t.reward, `每日任务「${t.name}」`);
    }
  }
}

// ===== 剧情模态 =====
function showEventModal(ev) {
  const bg = document.createElement("div");
  bg.className = "modal-bg";
  bg.innerHTML = `
    <div class="modal">
      <h2>${ev.title}</h2>
      <div class="modal-desc">${ev.desc}</div>
      <div class="options">
        ${ev.options.map((o,i) => `<button class="opt-btn" data-idx="${i}">${o.label}</button>`).join("")}
      </div>
    </div>
  `;
  document.body.appendChild(bg);
  bg.querySelectorAll(".opt-btn").forEach(b => {
    b.addEventListener("click", () => {
      const idx = parseInt(b.dataset.idx);
      const opt = ev.options[idx];
      applyGain(opt.effect, ev.title);
      if (opt.flag) S.flags[opt.flag] = true;
      log(`【剧情】${opt.log}`);
      bg.remove();
      saveState();
      render();
    });
  });
}

// ===== 雷达图 =====
function drawRadar(canvas) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width = 280, H = canvas.height = 280;
  const cx = W/2, cy = H/2, R = 100;
  ctx.clearRect(0, 0, W, H);
  const stats = D.theme.stats;
  const n = stats.length;

  // 背景网格
  ctx.strokeStyle = "#e8e8e8";
  ctx.lineWidth = 1;
  for (let lvl = 1; lvl <= 4; lvl++) {
    const r = R * lvl / 4;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = -Math.PI/2 + i * 2*Math.PI/n;
      const x = cx + r*Math.cos(a), y = cy + r*Math.sin(a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // 轴线
  ctx.strokeStyle = "#d0d0d0";
  for (let i = 0; i < n; i++) {
    const a = -Math.PI/2 + i * 2*Math.PI/n;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R*Math.cos(a), cy + R*Math.sin(a));
    ctx.stroke();
  }

  // 数据多边形
  ctx.fillStyle = "rgba(255, 91, 138, 0.18)";
  ctx.strokeStyle = "#ff5b8a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const v = (S.stats[stats[i].key] || 0) / 100;
    const a = -Math.PI/2 + i * 2*Math.PI/n;
    const x = cx + R*v*Math.cos(a), y = cy + R*v*Math.sin(a);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 顶点
  for (let i = 0; i < n; i++) {
    const v = (S.stats[stats[i].key] || 0) / 100;
    const a = -Math.PI/2 + i * 2*Math.PI/n;
    const x = cx + R*v*Math.cos(a), y = cy + R*v*Math.sin(a);
    ctx.fillStyle = "#ff5b8a";
    ctx.beginPath(); ctx.arc(x, y, 3, 0, 2*Math.PI); ctx.fill();
  }

  // 标签
  ctx.fillStyle = "#555"; ctx.font = "13px -apple-system";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let i = 0; i < n; i++) {
    const a = -Math.PI/2 + i * 2*Math.PI/n;
    const x = cx + (R+22)*Math.cos(a), y = cy + (R+22)*Math.sin(a);
    ctx.fillText(stats[i].name, x, y);
  }
}

// ===== 渲染 =====
function render() {
  const ending = checkEnding();
  if (ending && !S.ended) {
    S.ended = ending.id;
    saveState();
    setTimeout(() => alert(`🎬 结局达成：${ending.title}\n\n${ending.desc}`), 100);
  }

  // 顶栏
  document.querySelector("#brand-name").textContent = S.name || D.theme.protagonist;
  document.querySelector("#day-info").textContent = `Day ${S.day}`;

  // 资源条
  const resBar = document.querySelector("#resbar");
  resBar.innerHTML = D.theme.resources.map(r => `
    <div class="item">
      <span class="lab">${r.name}</span>
      <span class="val">${fmt(S.res[r.key])}${r.max?` / ${r.max}`:""}</span>
    </div>
  `).join("");

  // 侧栏
  const navs = [
    { id: "home",     name: "首页",   svg: '<path d="M3 12L12 4l9 8M5 10v10h14V10"/>' },
    { id: "train",    name: "养成",   svg: '<path d="M6.5 6.5h11v11h-11z M9.5 9.5h5v5h-5z"/>' },
    { id: "schedule", name: "行程",   svg: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>' },
    { id: "social",   name: "社交",   svg: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' },
    { id: "shop",     name: "商城",   svg: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>' }
  ];
  document.querySelector("#sidebar").innerHTML = navs.map(n => `
    <div class="nav-item ${S.page===n.id?"active":""}" onclick="navigate('${n.id}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${n.svg}</svg>
      ${n.name}
    </div>
  `).join("");

  // 主体
  const m = document.querySelector("#main");
  if (S.page === "home")     m.innerHTML = renderHome();
  if (S.page === "train")    m.innerHTML = renderTrain();
  if (S.page === "schedule") m.innerHTML = renderSchedule();
  if (S.page === "social")   m.innerHTML = renderSocial();
  if (S.page === "shop")     m.innerHTML = renderShop();

  if (S.page === "home") {
    const cv = document.querySelector("#radar");
    if (cv) drawRadar(cv);
  }
}

function renderHome() {
  const stats = D.theme.stats.map(s => `
    <div>
      <div class="stat-row"><span>${s.name}</span><b>${S.stats[s.key]}/100</b></div>
      <div class="bar"><div style="width:${S.stats[s.key]}%"></div></div>
    </div>
  `).join("");

  const tasks = D.daily_tasks.map(t => {
    const cur = Object.keys(t.target).map(k => S.daily[k]||0).reduce((a,b)=>a+b,0);
    const need = Object.values(t.target).reduce((a,b)=>a+b,0);
    const done = S.daily.claimed[t.id];
    return `
      <div class="task-row">
        <div>${t.name} <span class="tag">奖励 ${formatGain(t.reward)}</span></div>
        <div class="prog ${done?"done":""}">${done?"✓ 已领取":`${cur}/${need}`}</div>
      </div>
    `;
  }).join("");

  const ending = S.ended ? D.endings.find(e => e.id === S.ended) : null;

  return `
    <h2 class="page-title">${S.name || D.theme.protagonist} <span class="tag" style="margin-left:8px">${D.theme.company}</span></h2>
    <p class="page-sub">${D.theme.subtitle}</p>

    <div class="dashboard">
      <div class="card" style="padding:8px"><canvas id="radar"></canvas></div>
      <div class="card stat-list">${stats}</div>
    </div>

    <div class="card">
      <h3>每日任务（Day ${S.day}）</h3>
      ${tasks}
    </div>

    ${ending ? `<div class="card" style="border-color:var(--accent)"><h3>🎬 ${ending.title}</h3><p>${ending.desc}</p></div>` : ""}

    <div class="card">
      <h3>新手提示</h3>
      <div style="font-size:13px;color:var(--muted);line-height:1.8">
        · 在 <b>养成</b> 提升四维属性<br>
        · 在 <b>行程</b> 接通告涨粉赚钱（消耗体力+天数）<br>
        · 在 <b>社交</b> 发动态保持热度、看后援会消息<br>
        · 在 <b>商城</b> 用金币买奢侈品堆曝光<br>
        · 达到关键属性会触发剧情事件，影响结局走向
      </div>
    </div>
  `;
}

function renderTrain() {
  const items = D.trainings.map(t => {
    const can = t.cost <= 0 || S.res.energy >= t.cost;
    return `
      <div class="row">
        <div class="info">
          <div class="name">${t.name}</div>
          <div class="desc">${t.desc}</div>
          <div style="margin-top:6px">
            ${t.cost>0?`<span class="tag">消耗体力 ${t.cost}</span>`:`<span class="tag">恢复体力 ${-t.cost}</span>`}
            <span class="tag">收益 ${formatGain(t.gain) || "-"}</span>
          </div>
        </div>
        <button class="btn" ${can?"":"disabled"} onclick="doTrain('${t.id}')">开始</button>
      </div>
    `;
  }).join("");
  return `
    <h2 class="page-title">养成训练</h2>
    <p class="page-sub">提升四维属性，解锁更高级行程</p>
    <div class="card">${items}</div>
  `;
}

function renderSchedule() {
  let running = "";
  if (S.running) {
    const sc = D.schedules.find(x => x.id === S.running.id);
    const left = S.running.until - S.day;
    const pct = ((S.running.duration - left) / S.running.duration) * 100;
    running = `
      <div class="card schedule-running">
        <h3>正在进行：${sc.name}</h3>
        <div class="desc" style="color:#666">${sc.desc}</div>
        <div class="progress"><div style="width:${pct}%"></div></div>
        <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:12px;color:var(--muted)">剩余 ${left} 天</span>
          <button class="btn ghost" onclick="advanceSchedule()">推进 1 天</button>
        </div>
      </div>
    `;
  }
  const items = D.schedules.map(sc => {
    const req = checkRequires(sc.requires);
    const canEnergy = S.res.energy >= sc.cost;
    return `
      <div class="row">
        <div class="info">
          <div class="name">${sc.name}</div>
          <div class="desc">${sc.desc}</div>
          <div style="margin-top:6px">
            <span class="tag">体力 ${sc.cost}</span>
            <span class="tag">${sc.duration}天</span>
            <span class="tag">收益 ${formatGain(sc.gain)}</span>
            ${req.missing.map(m => `<span class="tag req-fail">需 ${m}</span>`).join("")}
          </div>
        </div>
        <button class="btn" ${req.ok&&canEnergy&&!S.running?"":"disabled"} onclick="startSchedule('${sc.id}')">出发</button>
      </div>
    `;
  }).join("");
  return `
    <h2 class="page-title">行程</h2>
    <p class="page-sub">接通告攒粉丝，跑通告赚金币</p>
    ${running}
    <div class="card">${items}</div>
  `;
}

function renderSocial() {
  const myPosts = [...S.posts].reverse().slice(0, 10).map(p => `
    <div class="row"><div class="info"><div class="name">Day ${p.day}</div><div class="desc">${p.text}</div></div></div>
  `).join("") || `<div style="color:var(--muted);padding:20px;text-align:center">还没发过动态</div>`;

  const chats = [...S.chats].slice(-15).map(c => `
    <div class="chat-msg">
      <div class="avatar">${c.name[3]||c.name[0]}</div>
      <div class="bubble"><div class="nm">${c.name} · Day ${c.day}</div>${c.text}</div>
    </div>
  `).join("") || `<div style="color:var(--muted);padding:20px;text-align:center">后援会还没消息</div>`;

  return `
    <h2 class="page-title">社交</h2>
    <p class="page-sub">动态保热度，群聊看反馈</p>
    <div class="card">
      <h3>我的动态 <button class="btn" style="float:right" onclick="doPost()">发动态（体力-5）</button></h3>
      ${myPosts}
    </div>
    <div class="card">
      <h3>后援会群聊</h3>
      <div class="chat-list">${chats}</div>
    </div>
  `;
}

function renderShop() {
  const items = D.shop.map(item => {
    const can = S.res.coin >= item.price;
    return `
      <div class="row">
        <div class="info">
          <div class="name">${item.name}</div>
          <div class="desc">${item.desc}</div>
          <div style="margin-top:6px">
            <span class="tag">${item.price} 金币</span>
            <span class="tag">效果 ${formatGain(item.gain)}</span>
          </div>
        </div>
        <button class="btn" ${can?"":"disabled"} onclick="buyItem('${item.id}')">购买</button>
      </div>
    `;
  }).join("");
  return `
    <h2 class="page-title">商城</h2>
    <p class="page-sub">用金币买曝光与属性</p>
    <div class="card">${items}</div>
  `;
}

function navigate(page) { S.page = page; saveState(); render(); }

// ===== 启动 =====
window.doTrain = doTrain;
window.startSchedule = startSchedule;
window.advanceSchedule = advanceSchedule;
window.doPost = doPost;
window.buyItem = buyItem;
window.navigate = navigate;
window.resetState = resetState;

function init() {
  if (!S.name) {
    setTimeout(() => {
      const n = prompt("给你的偶像起个艺名吧：", "");
      if (n) { S.name = n.trim(); saveState(); render(); }
      else { S.name = D.theme.protagonist; saveState(); render(); }
    }, 200);
  }
  render();
}
init();
