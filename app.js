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
    messages: [],       // NPC 私信 {from, text, day, read}
    page: "home",
    ended: null,
    lastMilestone: 0    // 已触发过的最大里程碑（粉丝数）
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
  // 压力惩罚：压力≥70 时，粉丝/口碑收益打 6 折；压力≥85 时打 3 折
  const stress = S.res.stress || 0;
  const penalty = stress >= 85 ? 0.3 : (stress >= 70 ? 0.6 : 1);
  const realGain = { ...gain };
  if (penalty < 1) {
    if (realGain.fans       > 0) realGain.fans       = Math.round(realGain.fans * penalty);
    if (realGain.reputation > 0) realGain.reputation = Math.round(realGain.reputation * penalty);
  }
  for (const k in realGain) {
    const v = realGain[k];
    if (k === "energy") {
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
  if (sourceName) {
    const tail = penalty < 1 ? `（高压力，收益${Math.round(penalty*100)}%）` : "";
    log(`${sourceName} → ${formatGain(realGain)}${tail}`);
  }
}

// 技能等级映射（0-100 → Lv.1-10）
function getLevel(value) {
  const v = value || 0;
  let lv = D.skill_levels[0];
  for (const s of D.skill_levels) {
    if (v >= s.min) lv = s;
  }
  return lv;
}

// NPC 消息触发器 — 按事件随机选 1 条消息
function triggerNpcMessage(eventType) {
  const pool = D.npc_messages.filter(m => m.trigger === eventType);
  if (pool.length === 0) return;
  const msg = pool[Math.floor(Math.random() * pool.length)];
  const npc = D.npcs.find(n => n.id === msg.from);
  if (!npc) return;
  S.messages.unshift({
    from: msg.from,
    fromName: npc.name,
    color: npc.color,
    text: msg.text,
    day: S.day,
    read: false
  });
  if (S.messages.length > 50) S.messages.pop();
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
  // 随机概率触发 NPC 私信（30%）
  if (Math.random() < 0.3) {
    triggerNpcMessage("random");
  }
  // 高压力时触发关心消息
  if ((S.res.stress||0) >= 70 && Math.random() < 0.5) {
    triggerNpcMessage("stress_high");
  }
  // 粉丝里程碑检查（每翻10倍触发一次）
  const milestones = [1000, 10000, 100000, 1000000, 10000000];
  for (const m of milestones) {
    if (S.res.fans >= m && S.lastMilestone < m) {
      S.lastMilestone = m;
      triggerNpcMessage("fans_milestone");
      log(`🎉 粉丝突破 ${fmt(m)}！`);
      break;
    }
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
    triggerNpcMessage("schedule_done");
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
  triggerNpcMessage("post");
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

// ===== 剧情模态（实现见文件末尾的玻璃风版本） =====

// ===== 雷达图 =====
function drawRadar(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 320;
  const cssH = 200;
  canvas.width  = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.height = cssH + "px";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const W = cssW, H = cssH;
  const cx = W/2, cy = H/2, R = Math.min(W, H)/2 - 30;
  ctx.clearRect(0, 0, W, H);
  const stats = D.theme.stats;
  const n = stats.length;

  // 背景网格
  ctx.strokeStyle = "rgba(0,0,0,0.06)";
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
  ctx.strokeStyle = "rgba(0,0,0,0.06)";
  for (let i = 0; i < n; i++) {
    const a = -Math.PI/2 + i * 2*Math.PI/n;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R*Math.cos(a), cy + R*Math.sin(a));
    ctx.stroke();
  }

  // 数据多边形
  ctx.fillStyle = "rgba(244, 63, 94, 0.12)";
  ctx.strokeStyle = "#f43f5e";
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
    ctx.fillStyle = "#f43f5e";
    ctx.beginPath(); ctx.arc(x, y, 3, 0, 2*Math.PI); ctx.fill();
  }

  // 标签
  ctx.fillStyle = "#8e8e93"; ctx.font = "12px -apple-system";
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
  const bn = document.querySelector("#brand-name");
  if (bn) bn.textContent = S.name || D.theme.protagonist;
  const di = document.querySelector("#day-info");
  if (di) di.textContent = `Day ${S.day} · ${D.theme.company}`;

  // 资源条
  const resBar = document.querySelector("#resbar");
  resBar.innerHTML = D.theme.resources.map(r => `
    <div class="item">
      <span class="lab">${r.name}</span>
      <span class="val">${fmt(S.res[r.key])}${r.max?`/${r.max}`:""}</span>
    </div>
  `).join("");

  // 底部 tab 栏
  const tabs = [
    { id: "home",     name: "首页",   svg: '<path d="M3 12L12 4l9 8M5 10v10h14V10"/>' },
    { id: "train",    name: "养成",   svg: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>' },
    { id: "schedule", name: "行程",   svg: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>' },
    { id: "message",  name: "消息",   svg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' },
    { id: "social",   name: "社交",   svg: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' },
    { id: "shop",     name: "商城",   svg: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>' }
  ];
  const unread = (S.messages||[]).filter(m => !m.read).length;
  document.querySelector("#tabbar").innerHTML = tabs.map(n => {
    const badge = (n.id === "message" && unread > 0) ? `<span class="tab-badge">${unread}</span>` : "";
    return `
    <button class="tab-item ${S.page===n.id?"active":""}" onclick="navigate('${n.id}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${n.svg}</svg>
      <span>${n.name}</span>${badge}
    </button>`;
  }).join("");

  // 主体
  const m = document.querySelector("#main");
  if (S.page === "home")     m.innerHTML = renderHome();
  if (S.page === "train")    m.innerHTML = renderTrain();
  if (S.page === "schedule") m.innerHTML = renderSchedule();
  if (S.page === "message")  m.innerHTML = renderMessages();
  if (S.page === "social")   m.innerHTML = renderSocial();
  if (S.page === "shop")     m.innerHTML = renderShop();

  if (S.page === "home") {
    const cv = document.querySelector("#radar");
    if (cv) drawRadar(cv);
  }
  if (S.page === "message") {
    // 进入消息页自动标记已读
    (S.messages||[]).forEach(m => m.read = true);
    saveState();
  }
}

function renderHome() {
  const statsHtml = D.theme.stats.map(s => {
    const v = S.stats[s.key]||0;
    return `
      <div class="stat-block">
        <div class="stat-label">${s.name} · <b style="color:#f43f5e">Lv.${getLevel(v).lv} ${getLevel(v).name}</b></div>
        <div class="stat-num">${v}<span style="font-size:11px;color:#8e8e93;font-weight:500"> /100</span></div>
        <div class="bar"><div style="width:${v}%"></div></div>
      </div>
    `;
  }).join("");

  const tasks = D.daily_tasks.map(t => {
    const cur = Object.keys(t.target).map(k => S.daily[k]||0).reduce((a,b)=>a+b,0);
    const need = Object.values(t.target).reduce((a,b)=>a+b,0);
    const done = S.daily.claimed[t.id];
    return `
      <div class="task-row">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500">${t.name}</div>
          <div style="font-size:11px;color:#8e8e93;margin-top:2px">奖励 ${formatGain(t.reward)}</div>
        </div>
        <div class="prog ${done?"done":""}">${done?"✓ 已领取":`${cur}/${need}`}</div>
      </div>
    `;
  }).join("");

  const ending = S.ended ? D.endings.find(e => e.id === S.ended) : null;

  return `
    <div class="page-title">${S.name || D.theme.protagonist}</div>
    <div class="page-sub">${D.theme.subtitle}</div>

    <div class="card dashboard">
      <h3>四维属性 <span style="font-size:11px;color:#8e8e93;font-weight:400">Day ${S.day}</span></h3>
      <canvas id="radar"></canvas>
      <div class="stat-grid" style="margin-top:10px">${statsHtml}</div>
    </div>

    <div class="card">
      <h3>每日任务</h3>
      ${tasks}
    </div>

    ${ending ? `<div class="card" style="border:1.5px solid #ff3b7f"><h3 style="color:#ff3b7f">🎬 ${ending.title}</h3><div style="font-size:13px;color:#555;line-height:1.6">${ending.desc}</div></div>` : ""}

    <div class="card">
      <h3>玩法提示</h3>
      <div style="font-size:12px;color:#6b6b70;line-height:1.9">
        · <b>养成</b>：用体力训练，提升四维属性<br>
        · <b>行程</b>：接通告涨粉赚钱（消耗体力+天数）<br>
        · <b>社交</b>：发动态保热度、看后援会消息<br>
        · <b>商城</b>：用金币买奢侈品堆曝光<br>
        · 关键属性达标会触发剧情，影响结局
      </div>
    </div>
  `;
}

function renderTrain() {
  const items = D.trainings.map(t => {
    const can = t.cost <= 0 || S.res.energy >= t.cost;
    const tag = t.cost > 0
      ? `<span class="tag">体力 -${t.cost}</span>`
      : `<span class="tag met">体力 +${-t.cost}</span>`;
    return `
      <div class="row">
        <div class="info">
          <div class="nm">${t.name}</div>
          <div class="desc">${t.desc}</div>
          <div class="tags">${tag}${Object.keys(t.gain).length?`<span class="tag met">${formatGain(t.gain)}</span>`:""}</div>
        </div>
        <button class="btn" ${can?"":"disabled"} onclick="doTrain('${t.id}')">开始</button>
      </div>
    `;
  }).join("");
  return `
    <div class="page-title">养成训练</div>
    <div class="page-sub">提升属性，解锁更高级行程</div>
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
        <h3>进行中：${sc.name}</h3>
        <div style="font-size:12px;color:#666">${sc.desc}</div>
        <div class="pbar"><div style="width:${pct}%"></div></div>
        <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:12px;color:#8e8e93">剩余 ${left} 天</span>
          <button class="btn" onclick="advanceSchedule()">推进 1 天</button>
        </div>
      </div>
    `;
  }
  const items = D.schedules.map(sc => {
    const req = checkRequires(sc.requires);
    const canEnergy = S.res.energy >= sc.cost;
    const reqTags = req.missing.map(m => `<span class="tag fail">需 ${m}</span>`).join("");
    return `
      <div class="row">
        <div class="info">
          <div class="nm">${sc.name}</div>
          <div class="desc">${sc.desc}</div>
          <div class="tags">
            <span class="tag">体力 ${sc.cost}</span>
            <span class="tag">${sc.duration}天</span>
            <span class="tag met">${formatGain(sc.gain)}</span>
            ${reqTags}
          </div>
        </div>
        <button class="btn" ${req.ok&&canEnergy&&!S.running?"":"disabled"} onclick="startSchedule('${sc.id}')">出发</button>
      </div>
    `;
  }).join("");
  return `
    <div class="page-title">行程</div>
    <div class="page-sub">接通告攒粉丝，跑通告赚金币</div>
    ${running}
    <div class="card">${items}</div>
  `;
}

function renderMessages() {
  const msgs = (S.messages||[]).length > 0
    ? S.messages.map(m => `
      <div style="display:flex;gap:10px;margin-bottom:12px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,0.04)">
        <div style="width:34px;height:34px;border-radius:50%;background:${m.color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;flex-shrink:0">${m.fromName.slice(-2).trim().slice(-1)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:500;display:flex;justify-content:space-between">
            <span style="color:${m.color}">${m.fromName}</span>
            <span style="font-size:10px;color:#a1a1aa">Day ${m.day}</span>
          </div>
          <div style="font-size:12px;color:#52525b;margin-top:3px">${m.text}</div>
        </div>
      </div>
    `).join("")
    : `<div style="color:#a1a1aa;text-align:center;padding:24px 0;font-size:12px">还没有消息</div>`;
  return `
    <div class="page-title">消息</div>
    <div class="page-sub">来自经纪人、品牌方、后援会、好友、媒体的私信</div>
    <div class="card">${msgs}</div>
  `;
}

function renderSocial() {
  const myPosts = [...S.posts].reverse().slice(0, 10).map(p => `
    <div class="post-item">
      <div class="day">Day ${p.day}</div>
      <div class="txt">${p.text}</div>
    </div>
  `).join("") || `<div style="color:#8e8e93;padding:16px 0;text-align:center;font-size:12px">还没发过动态</div>`;

  const chats = [...S.chats].slice(-15).reverse().map(c => `
    <div class="chat-msg">
      <div class="ava">${c.name.slice(-1)}</div>
      <div class="bub"><div class="nm">${c.name} · Day ${c.day}</div>${c.text}</div>
    </div>
  `).join("") || `<div style="color:#8e8e93;padding:16px 0;text-align:center;font-size:12px">后援会还没消息</div>`;

  return `
    <div class="page-title">社交</div>
    <div class="page-sub">动态保热度，群聊看反馈</div>
    <div class="card">
      <h3>我的动态<button class="btn" onclick="doPost()">发动态 体力-5</button></h3>
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
          <div class="nm">${item.name}</div>
          <div class="desc">${item.desc}</div>
          <div class="tags">
            <span class="tag">${fmt(item.price)} 金币</span>
            <span class="tag met">${formatGain(item.gain)}</span>
          </div>
        </div>
        <button class="btn" ${can?"":"disabled"} onclick="buyItem('${item.id}')">购买</button>
      </div>
    `;
  }).join("");
  return `
    <div class="page-title">商城</div>
    <div class="page-sub">金币买曝光与属性</div>
    <div class="card">${items}</div>
  `;
}

function navigate(page) { S.page = page; saveState(); render(); }
function toggleLog() {
  const p = document.querySelector("#log-panel");
  p.style.display = p.style.display === "none" ? "block" : "none";
}

// ===== 剧情模态 — 重写为玻璃风 =====
function showEventModal(ev) {
  const bg = document.createElement("div");
  bg.className = "modal-bg";
  bg.innerHTML = `
    <div class="modal">
      <h2>${ev.title}</h2>
      <div class="mdesc">${ev.desc}</div>
      <div class="opts">
        ${ev.options.map((o,i) => `<button class="opt" data-idx="${i}">${o.label}</button>`).join("")}
      </div>
    </div>
  `;
  document.body.appendChild(bg);
  bg.querySelectorAll(".opt").forEach(b => {
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

// ===== 启动 =====
window.doTrain = doTrain;
window.startSchedule = startSchedule;
window.advanceSchedule = advanceSchedule;
window.doPost = doPost;
window.buyItem = buyItem;
window.navigate = navigate;
window.resetState = resetState;
window.toggleLog = toggleLog;

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
