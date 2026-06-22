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
    posts: [],
    running: null,
    triggered: {},
    daily: { trainCount: 0, postCount: 0, schedCount: 0, claimed: {} },
    weekly: { trainCount: 0, postCount: 0, schedCount: 0, weekStart: 1, claimed: {} },
    chats: [],
    messages: [],
    page: "home",
    ended: null,
    lastMilestone: 0,
    // 新系统
    achievements: [],        // 已解锁徽章 id 数组
    albums: [],              // 已发布专辑 {id, name, day}
    awards: [],              // 已获奖项 {id, name, day}
    collections: [],         // 收藏品 id 数组
    chartScore: 0,           // 打榜积分（行程产出）
    chartHistory: [],        // 打榜历史 [{day, score}]
    checkinStreak: 0,        // 连续签到
    lastCheckinDay: 0,       // 最后签到的 day
    meetPoints: 0,           // 见面会积分
    dnd: false               // 免打扰
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

// NPC 消息触发器 — 优先用 AI 实时生成，失败就用预写池
function triggerNpcMessage(eventType) {
  const pool = D.npc_messages.filter(m => m.trigger === eventType);
  if (pool.length === 0) return;
  // 随机挑一个 NPC（按这个 event 池里的 from 分布）
  const msg = pool[Math.floor(Math.random() * pool.length)];
  const npc = D.npcs.find(n => n.id === msg.from);
  if (!npc) return;

  // 先用预写文案占位（万一 AI 失败/慢也能玩）
  const placeholder = {
    from: msg.from, fromName: npc.name, color: npc.color,
    text: msg.text, day: S.day, read: false, ai: false
  };
  S.messages.unshift(placeholder);
  if (S.messages.length > 50) S.messages.pop();
  saveState();

  // 异步用 DeepSeek 重写一句更生动的，回来后替换
  if (window.GAME_AI && window.GAME_AI.enabled) {
    aiRewriteMessage(npc, eventType, placeholder).catch(()=>{});
  }
}

// AI 接口（DeepSeek）
window.GAME_AI = {
  enabled: true,                  // 用户可在设置关闭
  key: "sk-e333640b3a214a0c80595d0e0856e0f6",
  endpoint: "https://api.deepseek.com/v1/chat/completions",
  model: "deepseek-chat"          // 自动路由到便宜的 v4-flash
};

async function aiRewriteMessage(npc, eventType, msgRef) {
  const ROLE_DESC = {
    agent:   "经纪人林姐，干练直接，关心偶像的事业和身体",
    brand:   "品牌方王总监，商务务实，注重数据和合作",
    fanclub: "后援会会长，热情亲切，代表粉丝心声",
    friend:  "圈内好友小宇，同行兼朋友，说话随意",
    media:   "媒体记者陈姐，敏锐专业，常给提醒"
  };
  const SCENE = {
    post:           "偶像刚发了一条社交动态",
    schedule_done:  "偶像刚跑完一档行程（综艺/演唱会/代言）",
    stress_high:    "偶像压力很大，看起来很疲惫",
    fans_milestone: `偶像粉丝数刚突破 ${fmt(S.res.fans)}`,
    random:         `偶像日常状态：粉丝${fmt(S.res.fans)}，压力${S.res.stress}，口碑${S.res.reputation}`
  };
  const prompt = `你扮演${ROLE_DESC[npc.role]}，给偶像"${S.name||"新人"}"发一条微信。场景：${SCENE[eventType]||"日常聊天"}。要求：30字内，自然口语，不要引号不要"亲爱的"开头不要解释，直接说一句。`;

  try {
    const r = await fetch(window.GAME_AI.endpoint, {
      method: "POST",
      headers: { "Authorization": `Bearer ${window.GAME_AI.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: window.GAME_AI.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 80, stream: false, temperature: 1.0
      })
    });
    if (!r.ok) throw new Error("ai " + r.status);
    const json = await r.json();
    const text = json.choices?.[0]?.message?.content?.trim().replace(/^["「『]|["」』]$/g, "");
    if (text && text.length > 4) {
      msgRef.text = text;
      msgRef.ai = true;
      saveState();
      if (S.page === "message") render();
    }
  } catch (e) {
    // 静默失败，保留预写文案
    console.warn("AI 消息生成失败:", e.message);
  }
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

// ===== 检查成就 =====
function checkAchievements() {
  for (const a of D.achievements) {
    if (S.achievements.includes(a.id)) continue;
    let met = false;
    if (a.id === "a_train10") met = (S.weekly.trainCount + S.daily.trainCount) >= 10;
    else if (a.id === "a_sched5") met = (S.weekly.schedCount + S.daily.schedCount) >= 5;
    else if (a.id === "a_fans10k") met = S.res.fans >= 10000;
    else if (a.id === "a_fans100k") met = S.res.fans >= 100000;
    else if (a.id === "a_fans1m") met = S.res.fans >= 1000000;
    else if (a.id === "a_fans10m") met = S.res.fans >= 10000000;
    else if (a.id === "a_album1") met = S.albums.length >= 1;
    else if (a.id === "a_album5") met = S.albums.length >= 5;
    else if (a.id === "a_award1") met = S.awards.length >= 1;
    else if (a.id === "a_award5") met = S.awards.length >= 5;
    else if (a.id === "a_master") met = Math.max(...D.theme.stats.map(st => S.stats[st.key]||0)) >= 85;
    else if (a.id === "a_collect5") met = S.collections.length >= 5;
    else if (a.id === "a_chart1") met = S.chartScore >= 1000;
    else if (a.id === "a_chart10k") met = S.chartScore >= 10000;
    else if (a.id === "a_checkin7") met = S.checkinStreak >= 7;
    else if (a.id === "a_post50") met = S.posts.length >= 50;
    else if (a.id === "a_coin100k") met = S.res.coin >= 100000;
    else if (a.id === "a_meet100") met = S.meetPoints >= 100;
    if (met) {
      S.achievements.push(a.id);
      log(`🏆 成就解锁：${a.name} — ${a.desc}`);
    }
  }
}

// ===== 检查奖项 + 收藏品掉落 =====
function checkAwards() {
  for (const aw of D.awards) {
    if (S.awards.find(a => a.id === aw.id)) continue;
    let met = true;
    if (aw.cond.fans && S.res.fans < aw.cond.fans) met = false;
    if (aw.cond.charm && S.stats.charm < aw.cond.charm) met = false;
    if (aw.cond.albumCount && S.albums.length < aw.cond.albumCount) met = false;
    if (met) {
      S.awards.push({ id: aw.id, name: aw.name, icon: aw.icon, day: S.day });
      log(`🎉 获得奖项：${aw.name}！`);
      // 获奖随机掉落收藏品
      if (Math.random() < 0.6) {
        const pool = D.collectibles.filter(c => !S.collections.includes(c.id));
        if (pool.length > 0) {
          const col = pool[Math.floor(Math.random()*pool.length)];
          S.collections.push(col.id);
          log(`🎁 收集到：${col.name}`);
        }
      }
    }
  }
}

// ===== 打榜积分 =====
function addChartScore(base) {
  const mult = (S.res.reputation||0) / 50;
  S.chartScore += Math.round(base * mult);
  if (S.chartScore > 0) {
    S.chartHistory.push({ day: S.day, score: S.chartScore });
    if (S.chartHistory.length > 100) S.chartHistory.shift();
  }
}

// ===== 签到 =====
function doCheckin() {
  if (S.lastCheckinDay >= S.day) { return; }
  const streak = (S.lastCheckinDay >= S.day - 1) ? S.checkinStreak + 1 : 1;
  S.checkinStreak = streak;
  S.lastCheckinDay = S.day;
  S.meetPoints += 5;
  S.res.coin += streak >= 7 ? 5000 : (streak >= 3 ? 1000 : 200);
  S.res.energy = Math.min(100, (S.res.energy||0) + 20);
  log(`📅 签到 (连续${streak}天) 体力+20 金币+${streak >= 7 ? 5000 : (streak >= 3 ? 1000 : 200)}`);
  checkAchievements();
  saveState();
  render();
}

// ===== 制作专辑 =====
function startAlbum(id) {
  if (S.running) { alert("当前行程进行中"); return; }
  const al = D.album_types.find(x => x.id === id);
  if (!al) return;
  const req = checkRequires(al.requires);
  if (!req.ok) { alert("条件不足：" + req.missing.join("、")); return; }
  if (S.res.coin < al.cost) { alert("金币不足"); return; }
  S.res.coin -= al.cost;
  S.running = { id: "album_"+al.id, startedDay: S.day, duration: al.duration, until: S.day + al.duration, albumData: al };
  log(`🎵 开始制作：${al.name}（${al.duration}天）`);
  saveState(); render(); startAutoAdvance();
}

// ===== 推进时间（每次行动） =====
function tick(cost) {
  if (cost > 0) {
    if (S.res.energy < cost) { alert("体力不足"); return false; }
    S.res.energy -= cost;
  } else if (cost < 0) {
    S.res.energy = clamp(S.res.energy - cost, 0, 100);
  }
  S.day += 1;
  // 周任务重置
  if (S.day - S.weekly.weekStart >= 7) {
    S.weekly = { trainCount: 0, postCount: 0, schedCount: 0, weekStart: S.day, claimed: {} };
  }
  // 群聊
  if (Math.random() < 0.6) {
    let pool = D.fansp_all;
    if ((S.res.stress||0) >= 60) pool = [...pool, ...D.fansp_e];
    if (S.res.fans >= S.lastMilestone && S.lastMilestone > 0) pool = [...pool, ...D.fansp_n];
    pool = [...pool, ...D.fansp_d];
    const c = pool[Math.floor(Math.random()*pool.length)];
    S.chats.push({ ...c, day: S.day });
    if (S.chats.length > 50) S.chats.shift();
  }
  // NPC 消息（免打扰跳过）
  if (!S.dnd) {
    if (Math.random() < 0.3) triggerNpcMessage("random");
    if ((S.res.stress||0) >= 70 && Math.random() < 0.5) triggerNpcMessage("stress_high");
  }
  // 粉丝里程碑
  const milestones = [1000, 10000, 100000, 1000000, 10000000];
  for (const m of milestones) {
    if (S.res.fans >= m && S.lastMilestone < m) {
      S.lastMilestone = m;
      if (!S.dnd) triggerNpcMessage("fans_milestone");
      log(`🎉 粉丝突破 ${fmt(m)}！`);
      break;
    }
  }
  checkEvents();
  checkAchievements();
  checkAwards();
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
    S.weekly.trainCount += 1;
    S.meetPoints += 1;
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
  log(`开始行程：${sc.name}（${sc.duration}天自动跑）`);
  saveState();
  render();
  startAutoAdvance();
}

function advanceSchedule() {
  if (!S.running) return;
  const sc = D.schedules.find(x => x.id === S.running.id);
  S.day += 1;
  if (S.day >= S.running.until) {
    // 如果是专辑类型，存到 albums
    if (S.running.albumData) {
      const al = S.running.albumData;
      S.albums.push({ id: al.id, name: al.name, day: S.day });
      applyGain(al.gain, al.name);
      addChartScore(500);
    } else {
      applyGain(sc.gain, sc.name);
      addChartScore(sc.gain.fans ? Math.round(sc.gain.fans / 100) : 50);
    }
    S.running = null;
    S.daily.schedCount += 1;
    S.weekly.schedCount += 1;
    S.meetPoints += 3;
    triggerNpcMessage("schedule_done");
    const fc = D.fansp_c[Math.floor(Math.random()*D.fansp_c.length)];
    S.chats.push({ ...fc, day: S.day });
    checkDailyTasks();
    checkEvents();
    checkAchievements();
    checkAwards();
    if (S._advanceTimer) { clearInterval(S._advanceTimer); S._advanceTimer = null; }
  }
  saveState();
  render();
}

// 自动推进：行程开始后每 2 秒推一天（不可暂停，原站逻辑）
function startAutoAdvance() {
  if (S._advanceTimer) clearInterval(S._advanceTimer);
  S._advanceTimer = setInterval(() => {
    if (!S.running) { clearInterval(S._advanceTimer); S._advanceTimer = null; return; }
    advanceSchedule();
  }, 2000);
}

// ===== 动作：发动态 =====
function doPost() {
  if (!tick(5)) return;
  const text = D.posts[Math.floor(Math.random()*D.posts.length)];
  S.posts.push({ text, day: S.day });
  applyGain({ fans: 300, exposure: 2 }, "发布动态");
  S.daily.postCount += 1;
  S.weekly.postCount += 1;
  S.meetPoints += 2;
  triggerNpcMessage("post");
  // 发动态触发后援会"新内容"反应
  const fc = D.fansp_n[Math.floor(Math.random()*D.fansp_n.length)];
  S.chats.push({ ...fc, day: S.day });
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
    { id: "album",    name: "专辑",   svg: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>' },
    { id: "message",  name: "消息",   svg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' },
    { id: "social",   name: "社交",   svg: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' },
    { id: "shop",     name: "商城",   svg: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>' },
    { id: "trophy",   name: "成就",   svg: '<path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2"/><path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2"/><path d="M6 3v9a6 6 0 0 0 12 0V3"/><path d="M9 21h6M12 17v4"/>' }
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
  if (S.page === "album")    m.innerHTML = renderAlbum();
  if (S.page === "message")  m.innerHTML = renderMessages();
  if (S.page === "social")   m.innerHTML = renderSocial();
  if (S.page === "shop")     m.innerHTML = renderShop();
  if (S.page === "trophy")   m.innerHTML = renderTrophy();

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
      <h3>数据总览</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px">
        <div><span style="color:#8e8e93">打榜积分</span><br><b style="font-size:18px">${fmt(S.chartScore)}</b></div>
        <div><span style="color:#8e8e93">专辑数</span><br><b style="font-size:18px">${S.albums.length}</b></div>
        <div><span style="color:#8e8e93">奖项</span><br><b style="font-size:18px">${S.awards.length}</b></div>
        <div><span style="color:#8e8e93">收藏品</span><br><b style="font-size:18px">${S.collections.length}/${D.collectibles.length}</b></div>
      </div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn ghost" onclick="doCheckin()">${S.lastCheckinDay>=S.day?'✅ 已签到':'📅 签到'} (${S.checkinStreak}天)</button>
        <button class="btn ghost" onclick="toggleDnd()">${S.dnd?'🔕 免打扰已开':'🔔 免打扰'}</button>
        ${S.running ? '' : `<button class="btn ghost" onclick="endGameManual()">🎬 主动谢幕</button>`}
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
          <span style="font-size:12px;color:#8e8e93">自动跑……剩余 ${left} 天</span>
          <button class="btn ghost" onclick="advanceSchedule()">加速</button>
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

function renderAlbum() {
  const myAlbums = S.albums.length > 0
    ? S.albums.slice().reverse().map(a => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(0,0,0,0.04);font-size:13px"><span>${a.name}</span><span style="color:#a1a1aa;font-size:11px">Day ${a.day}</span></div>`).join("")
    : `<div style="color:#a1a1aa;text-align:center;padding:16px;font-size:12px">还没发过专辑</div>`;
  const items = D.album_types.map(al => {
    const req = checkRequires(al.requires);
    const canCoin = S.res.coin >= al.cost;
    const reqTags = req.missing.map(m => `<span class="tag fail">需 ${m}</span>`).join("");
    return `
      <div class="row">
        <div class="info">
          <div class="nm">${al.name}</div>
          <div class="desc">${al.desc}</div>
          <div class="tags">
            <span class="tag">${al.cost}金币</span>
            <span class="tag">${al.duration}天</span>
            <span class="tag met">${formatGain(al.gain)}</span>
            ${reqTags}
          </div>
        </div>
        <button class="btn" ${req.ok&&canCoin&&!S.running?"":"disabled"} onclick="startAlbum('${al.id}')">制作</button>
      </div>
    `;
  }).join("");
  return `
    <div class="page-title">专辑制作</div>
    <div class="page-sub">已发布 ${S.albums.length} 张 · 选题决定走向</div>
    <div class="card"><h3>已发布</h3>${myAlbums}</div>
    <div class="card">${items}</div>
  `;
}

function renderTrophy() {
  // 成就
  const unlocked = D.achievements.filter(a => S.achievements.includes(a.id));
  const locked   = D.achievements.filter(a => !S.achievements.includes(a.id));
  const achItems = [
    ...unlocked.map(a => `
      <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid rgba(0,0,0,0.04)">
        <div style="font-size:22px;line-height:1">${a.icon}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;color:#f43f5e">${a.name}</div>
          <div style="font-size:11px;color:#71717a;margin-top:2px">${a.desc}</div>
        </div>
        <div style="font-size:10px;color:#16a34a;align-self:center">✓ 已达成</div>
      </div>
    `),
    ...locked.map(a => `
      <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid rgba(0,0,0,0.04);opacity:0.4">
        <div style="font-size:22px;line-height:1;filter:grayscale(1)">${a.icon}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500">${a.name}</div>
          <div style="font-size:11px;color:#71717a;margin-top:2px">${a.desc}</div>
        </div>
      </div>
    `)
  ].join("");

  // 奖项
  const awItems = S.awards.length > 0
    ? S.awards.slice().reverse().map(a => `<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.04);font-size:13px"><span style="font-size:18px">${a.icon}</span><span style="flex:1">${a.name}</span><span style="font-size:11px;color:#a1a1aa">Day ${a.day}</span></div>`).join("")
    : `<div style="color:#a1a1aa;text-align:center;padding:12px;font-size:12px">还没拿到奖项</div>`;

  // 收藏品
  const colItems = D.collectibles.map(c => {
    const has = S.collections.includes(c.id);
    return `
      <div style="text-align:center;padding:10px;border-radius:12px;background:${has?'rgba(244,63,94,0.1)':'rgba(0,0,0,0.03)'};opacity:${has?1:0.35}">
        <div style="font-size:28px">${c.icon}</div>
        <div style="font-size:11px;font-weight:500;margin-top:4px">${c.name}</div>
        <div style="font-size:9px;color:#a1a1aa;margin-top:2px">${has?c.desc:'未获得'}</div>
      </div>
    `;
  }).join("");

  return `
    <div class="page-title">成就 · 奖项 · 收藏</div>
    <div class="page-sub">${S.achievements.length}/${D.achievements.length} 成就 · ${S.awards.length} 奖项 · ${S.collections.length}/${D.collectibles.length} 收藏品</div>
    <div class="card">
      <h3>🏆 成就徽章</h3>
      ${achItems}
    </div>
    <div class="card">
      <h3>🎖️ 奖项记录</h3>
      ${awItems}
    </div>
    <div class="card">
      <h3>🎁 收藏品</h3>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${colItems}</div>
    </div>
  `;
}

function renderMessages() {
  const msgs = (S.messages||[]).length > 0
    ? S.messages.map(m => `
      <div style="display:flex;gap:10px;margin-bottom:12px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,0.04)">
        <div style="width:34px;height:34px;border-radius:50%;background:${m.color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;flex-shrink:0">${m.fromName.slice(-2).trim().slice(-1)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:500;display:flex;justify-content:space-between;align-items:center">
            <span style="color:${m.color}">${m.fromName}${m.ai ? ' <span style="font-size:9px;padding:1px 4px;border-radius:4px;background:rgba(244,63,94,0.1);color:#f43f5e;font-weight:600;margin-left:4px">AI</span>' : ''}</span>
            <span style="font-size:10px;color:#a1a1aa">Day ${m.day}</span>
          </div>
          <div style="font-size:12px;color:#52525b;margin-top:3px">${m.text}</div>
        </div>
      </div>
    `).join("")
    : `<div style="color:#a1a1aa;text-align:center;padding:24px 0;font-size:12px">还没有消息</div>`;
  return `
    <div class="page-title">消息</div>
    <div class="page-sub">5位NPC的私信 · AI实时生成 · 不愿用可在顶栏关</div>
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
window.doCheckin = doCheckin;
window.startAlbum = startAlbum;
window.toggleDnd = () => { S.dnd=!S.dnd; saveState(); render(); };
window.endGameManual = () => { if(!confirm('确定谢幕吗？要主动结束生涯。'))return; S.ended='ending_retire'; saveState(); render(); };
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
  // 加载存档时恢复自动推进
  if (S.running) startAutoAdvance();
}
init();
