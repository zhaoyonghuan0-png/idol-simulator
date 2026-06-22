// 游戏数据表 — 改造为其他主题模拟器时，主要改这个文件即可
// 主题字段：theme.* / 属性字段：stats.* / 行程/剧情/商城/任务表分别为数组

window.GAME_DATA = {
  theme: {
    title: "爱豆模拟器",
    subtitle: "从练习生到顶流，掌控你的偶像人生",
    protagonist: "新晋偶像",
    company: "STAR娱乐",
    // 四维属性 — 改主题时调成"剧本/营销/拍摄/剪辑"等
    stats: [
      { key: "vocal",    name: "唱功", icon: "♪" },
      { key: "dance",    name: "舞蹈", icon: "♫" },
      { key: "create",   name: "创作", icon: "✎" },
      { key: "charm",    name: "颜值", icon: "✦" }
    ],
    // 资源
    resources: [
      { key: "energy",   name: "体力",     max: 100, init: 100 },
      { key: "stress",   name: "压力",     max: 100, init: 20  },
      { key: "reputation", name: "口碑",   max: 100, init: 50  },
      { key: "fans",     name: "粉丝",     max: null, init: 0 },
      { key: "coin",     name: "金币",     max: null, init: 500 },
      { key: "exposure", name: "曝光度",   max: 100, init: 10 }
    ],
    // 形象风格 — 创建角色时选，每个带初始加成（改主题时换成"硬汉/儒雅/书卷"等）
    appearances: [
      { k: "sweet",   name: "甜美系", desc: "邻家亲和，路人缘好",  bonus: { charm: 5, reputation: 5 } },
      { k: "cool",    name: "酷飒系", desc: "气场全开，自带话题",  bonus: { charm: 6, exposure: 3 } },
      { k: "pure",    name: "清纯系", desc: "干净透明，粉丝黏性高", bonus: { charm: 4, fans: 2000 } },
      { k: "mature",  name: "御姐系", desc: "成熟有质感，代言青睐", bonus: { charm: 6, coin: 500 } },
      { k: "sunny",   name: "阳光系", desc: "元气满满，体力充沛",  bonus: { charm: 4, energy: 15 } },
      { k: "mystery", name: "神秘系", desc: "高冷神秘，曝光加成",  bonus: { charm: 5, exposure: 5 } }
    ],
    // 出道方式
    debutTypes: [
      { k: "solo",  name: "solo 单人", desc: "单枪匹马闯荡，资源独享" },
      { k: "group", name: "团体出道", desc: "组团出发，互相成就" }
    ]
  },

  // 养成训练（耗体力 → 加属性 + 压力）
  trainings: [
    { id: "t_vocal",   name: "声乐训练", desc: "专业声乐老师一对一教学，唱功大幅提升", cost: 20, gain: { vocal: 8, exposure: 1, stress: 8 } },
    { id: "t_dance",   name: "舞蹈训练", desc: "基础功、编舞拆解，全面提升舞技",       cost: 20, gain: { dance: 8, exposure: 1, stress: 8 } },
    { id: "t_create",  name: "创作训练", desc: "专注音乐创作，提升原创实力",           cost: 20, gain: { create: 8, exposure: 1, stress: 10 } },
    { id: "t_style",   name: "造型训练", desc: "发型、妆容、服装搭配，提升颜值",       cost: 15, gain: { charm: 8, exposure: 2, stress: 5 } },
    { id: "t_rest",    name: "休息放松", desc: "运动按摩+营养补充，迅速恢复体力",     cost: -40, gain: { stress: -15 } },  // 休息：体力+40, 压力-15
    { id: "t_therapy", name: "心理疏导", desc: "专业心理咨询，全面释放压力",          cost: 10, gain: { stress: -40, reputation: 2 } }
  ],

  // 行程（挂机任务：消耗体力 + 时间 → 收获粉丝/金币/曝光 + 压力 + 口碑）
  schedules: [
    { id: "s_stage_small", name: "剧场舞台",   desc: "积累打榜基础分",         cost: 25, duration: 3, gain: { fans: 8000,    coin: 200,  exposure: 5,  stress: 10, reputation: 1  }, requires: { vocal: 0,  dance: 0  } },
    { id: "s_variety",     name: "综艺通告",   desc: "参加热门综艺，提升路人好感", cost: 30, duration: 4, gain: { fans: 25000,   coin: 600,  exposure: 12, stress: 15, reputation: 3  }, requires: { charm: 30 } },
    { id: "s_album",       name: "发布单曲",   desc: "在专辑工作室发布新单曲",     cost: 40, duration: 6, gain: { fans: 50000,   coin: 1500, exposure: 20, stress: 20, reputation: 5  }, requires: { vocal: 50, create: 30 } },
    { id: "s_concert_mid", name: "中型演唱会", desc: "中等规模演出，积累现场口碑", cost: 50, duration: 8, gain: { fans: 120000,  coin: 3500, exposure: 25, stress: 25, reputation: 8  }, requires: { vocal: 60, dance: 60 } },
    { id: "s_endorse",     name: "品牌代言",   desc: "拍摄商业广告，金主爸爸来了", cost: 35, duration: 5, gain: { fans: 40000,   coin: 8000, exposure: 18, stress: 10, reputation: 10 }, requires: { charm: 70 } },
    { id: "s_concert_big", name: "万人音乐节", desc: "万人舞台压轴演出",           cost: 70, duration: 10, gain: { fans: 350000,  coin: 12000, exposure: 40, stress: 30, reputation: 15 }, requires: { vocal: 80, dance: 80, charm: 70 } },
    { id: "s_award",       name: "颁奖典礼",   desc: "出席年度颁奖典礼，展示风采", cost: 60, duration: 8, gain: { fans: 500000,  coin: 20000, exposure: 60, stress: 20, reputation: 20 }, requires: { fans: 10000000 } }
  ],

  // 商城（金币购买，加固定属性 or 装饰）
  shop: [
    { id: "i_lipstick",  name: "顶级护肤疗程",   desc: "肌肤焕新",           price: 800,    gain: { charm: 5  } },
    { id: "i_voice",     name: "私教声乐课",     desc: "唱功+5",             price: 1200,   gain: { vocal: 5 } },
    { id: "i_dance",     name: "MJ街舞大师课",   desc: "舞技跨越式提升",     price: 1500,   gain: { dance: 6 } },
    { id: "i_outfit_xmas",  name: "圣诞限定套装", desc: "圣诞星形话筒+雪精灵造型", price: 3000, gain: { charm: 10, exposure: 5 } },
    { id: "i_outfit_hw",    name: "万圣节暗黑风", desc: "哥特神秘，恐怖与时尚共存",  price: 2800, gain: { charm: 10, exposure: 5 } },
    { id: "i_car",       name: "大牌SUV",        desc: "出行排面十足",       price: 50000,  gain: { exposure: 15 } },
    { id: "i_mansion",   name: "顶豪庄园",       desc: "明星级豪宅",         price: 200000, gain: { exposure: 30, charm: 10 } }
  ],

  // 剧情事件（达成条件随机触发，多分支）
  events: [
    {
      id: "e_first_fans",
      trigger: { fans: 10000 },
      title: "你迎来了第一批死忠粉",
      desc: "粉丝后援会刚刚组建，会长私信你想征集应援口号。",
      options: [
        { label: "亲自参与设计", effect: { fans: 2000, energy: -10, exposure: 5 }, log: "你和会长聊到凌晨，应援口号上了热搜。" },
        { label: "委托工作室",   effect: { fans: 500,  exposure: 2 }, log: "工作室给了一个安全版本，粉丝有点失望。" }
      ]
    },
    {
      id: "e_paparazzi",
      trigger: { exposure: 40 },
      title: "门口蹲了一个陌生人",
      desc: "对方自称掌握你的「独家爆料」，要求面谈。",
      options: [
        { label: "你认错人了，请离开",  effect: { exposure: -5 },          log: "对方悻悻离开，但留下了警告。" },
        { label: "你所谓的爆料是什么？", effect: { exposure: 10, fans: -1000 }, log: "被狗仔拍下面谈画面，舆论炸锅。" },
        { label: "报警处理",            effect: { exposure: 5, fans: 3000 },  log: "粉丝一边倒支持你，路人缘飙升。" }
      ]
    },
    {
      id: "e_company_cut",
      trigger: { coin: 30000 },
      title: "公司想压缩你的分成",
      desc: "新合约要求把你的分成从35%降到20%，但承诺加大资源投入。",
      options: [
        { label: "接受，换资源",       effect: { exposure: 15, coin: -5000 },                log: "新代言纷至沓来，但你心里有根刺。" },
        { label: "保守谈判",           effect: { coin: 2000 },                                log: "维持30%分成，关系平稳。" },
        { label: "不接受，准备解约",   effect: { coin: -10000, exposure: 20 },                log: "解约风波登上热搜，粉丝两极化。", flag: "solo_path" }
      ]
    },
    {
      id: "e_award_nom",
      trigger: { fans: 500000 },
      title: "新人奖提名",
      desc: "你获得了新人奖提名，但和演唱会档期撞了。",
      options: [
        { label: "全力冲奖",       effect: { exposure: 25, coin: -3000, energy: -30 }, log: "你拿到了新人奖，行业地位坐实。" },
        { label: "保持偶像活动同时备战颁奖", effect: { exposure: 15, energy: -50 },             log: "两头跑累垮，但都做完了。" },
        { label: "放弃，专心演唱会", effect: { fans: 10000 },                                    log: "粉丝感动哭了，但媒体说你格局小。" }
      ]
    },
    {
      id: "e_overseas",
      trigger: { fans: 2000000 },
      title: "海外厂牌抛来橄榄枝",
      desc: "美国一家厂牌要签你，但需要你常驻洛杉矶一年。",
      options: [
        { label: "出海发展", effect: { exposure: 40, fans: -50000, coin: 30000 }, log: "国际化路线开启，国内粉丝有些失落。", flag: "overseas" },
        { label: "坚守本土", effect: { fans: 100000, exposure: 10 },               log: "你拒绝了，国内市场愈发稳固。", flag: "domestic" }
      ]
    }
  ],

  // 每日任务（每天刷新）
  daily_tasks: [
    { id: "d_train_3", name: "完成3次训练",     target: { trainCount: 3 }, reward: { coin: 300, exposure: 2 } },
    { id: "d_post_1",  name: "发布1条动态",     target: { postCount: 1 },  reward: { fans: 500 } },
    { id: "d_sched_1", name: "完成1个行程",     target: { schedCount: 1 }, reward: { coin: 500, exposure: 5 } }
  ],

  // 动态模板（点击"发动态"随机用一条）
  posts: [
    "今天的练习室，又是被自己感动到的一天。",
    "感谢每一位坚持留下来的小伙伴，你们才是我的勋章。",
    "新歌demo录了一晚上，等我打磨好给你们听。",
    "刚下飞机，落地就想你们了。",
    "凌晨两点的录音棚，灯比月亮还亮。",
    "看到弹幕里有人说被治愈，我才是被你们治愈的那个。",
    "彩排现场偷拍工作人员加班的样子，这个团队真的牛。",
    "今天试新造型，自己都吓一跳，大家觉得呢？",
    "粉丝送的手写信我每一封都看了，对不起最近回得慢。",
    "新单曲上线，去听我！等你们的评论！"
  ],

  // 粉丝群聊（按场景分类触发，参考原站 fc_c/d/e/n 结构）
  fansp_c: [  // 应援/活动组织
    { name: "应援组长阿然",   text: "应援口号定稿了！「星河万里，唯你最亮！」回复✅确认！" },
    { name: "物料组CC",       text: "这次周边定了荧光棒升级版！颜色是爱豆签名款专属色！" },
    { name: "后勤组小圆",     text: "到场的小伙伴记得提前两小时到，要占前排！" },
    { name: "后援会会长",     text: "这次应援活动全程无事故！大家辛苦了！" }
  ],
  fansp_n: [  // 新闻/热搜/新内容
    { name: "后援会小鹿",     text: "新单曲的预告出了！！光是预告就听哭了！！" },
    { name: "后援会暖暖",     text: "官博发新封面图了！！太好看了吧！！" },
    { name: "后援会阿糖",     text: "上热搜了！！快去评论区控评！！" },
    { name: "副会长小敏",     text: "获奖了！！感谢所有投票的小可爱！！！" },
    { name: "数据组小橙",     text: "播放量破新纪录了！！比预计早了整整三天！！" }
  ],
  fansp_d: [  // 日常闲聊
    { name: "后援会暖暖",     text: "今天上班路上听爱豆的歌，通勤都变得有意义了哈哈" },
    { name: "后援会小鹿",     text: "今天心情不好来群里找能量，果然追星让人开心！" },
    { name: "后援会早早",     text: "昨天的直播那个手势！！太可爱了反复看了七遍！！" },
    { name: "后援会小树",     text: "无聊翻以前的现场视频，每次都能被重新圈粉" },
    { name: "数据组小橙",     text: "后援团官方号今天涨粉五千，我们越来越大了！！" }
  ],
  fansp_e: [  // 情绪/支持
    { name: "后援会小鹿",     text: "看到爱豆在练习室那张状态照……累成那样还在坚持……心疼" },
    { name: "后援会阿糖",     text: "无论发生什么，我们都会陪在爱豆身边，不忘初心！" },
    { name: "后援会会长",     text: "家人们，今天爱豆压力很大，我们去评论区刷温暖的话" },
    { name: "打榜组阿璃",     text: "互帮互助！新人朋友看过来，打榜教程五分钟学会！" }
  ],
  fansp_all: [  // 通用池，兜底
    { name: "后援会会长",     text: "今天有个新人朋友加群，大家欢迎一下！" },
    { name: "后援会阿糖",     text: "评论区有黑粉，姐妹们去用事实说话不要情绪化！" },
    { name: "宣传组云云",     text: "大家转发今天的新闻稿！扩散！" },
    { name: "打榜组阿璃",     text: "打榜教程已更新在群文件！五分钟学会！" }
  ],

  // 结局（满足条件触发）— 阈值×10，避免开局就结束
  endings: [
    { id: "ending_god",     cond: { fans: 500000000, vocal: 90, dance: 90, charm: 90, create: 80 }, title: "顶流封神", desc: "你以全维度顶尖姿态完成谢幕演唱会，行业再无后继。" },
    { id: "ending_actor",   cond: { fans: 50000000, charm: 90 },                                     title: "影视破圈", desc: "你转战大银幕，成为新一代国民演员。" },
    { id: "ending_overseas",cond: { fans: 30000000 }, flag: "overseas",                              title: "海外征途", desc: "你在格莱美舞台用母语高歌一曲，国际化路线开花。" },
    { id: "ending_solo",    cond: { fans: 20000000 }, flag: "solo_path",                             title: "创立厂牌", desc: "你从0组建独立厂牌，签下三位新人，行业地位重塑。" },
    { id: "ending_retire",  cond: { fans: 10000000 },                                                title: "低调隐退", desc: "你选择在事业上升期退场，留下一个干净的偶像传说。" },
    { id: "ending_rookie",  cond: {},                                                                title: "初心未改", desc: "粉丝不多，但每一个都还在听你的歌。" }
  ],
  // 技能等级阶梯（0-100 映射成 Lv.1 - Lv.10）
  skill_levels: [
    { min: 0,  lv: 1,  name: "新手" },
    { min: 15, lv: 2,  name: "入门" },
    { min: 25, lv: 3,  name: "熟练" },
    { min: 40, lv: 4,  name: "进阶" },
    { min: 55, lv: 5,  name: "专精" },
    { min: 65, lv: 6,  name: "卓越" },
    { min: 75, lv: 7,  name: "大师" },
    { min: 85, lv: 8,  name: "宗师" },
    { min: 92, lv: 9,  name: "封神" },
    { min: 98, lv: 10, name: "传奇" }
  ],

  // NPC 联系人 — 不同角色发不同类型消息
  npcs: [
    { id: "agent",    name: "经纪人·林姐", role: "agent",    color: "#3b82f6" },
    { id: "brand",    name: "品牌方·王总监", role: "brand",    color: "#f59e0b" },
    { id: "fanclub",  name: "后援会·会长",  role: "fanclub",  color: "#f43f5e" },
    { id: "friend",   name: "圈内好友·小宇", role: "friend",   color: "#10b981" },
    { id: "media",    name: "媒体记者·陈姐", role: "media",    color: "#8b5cf6" }
  ],

  // NPC 消息池 — 按场景触发（trigger.event 可为：post/schedule_done/stress_high/fans_milestone/random）
  npc_messages: [
    // ==== 经纪人（事务通知 / 行程相关） ====
    { from: "agent", trigger: "schedule_done", text: "刚收到节目组反馈，这次表现不错，下个月还有同档期的资源给你。" },
    { from: "agent", trigger: "schedule_done", text: "刚谈下一个杂志拍摄，给你留了空档，回头详细对一下。" },
    { from: "agent", trigger: "stress_high",   text: "看你最近行程排太满，要不要先停两天？身体是本钱。" },
    { from: "agent", trigger: "fans_milestone",text: "粉丝量过线了，公司想给你提一档资源位，等你确认。" },
    { from: "agent", trigger: "random",        text: "提醒一下，本月通告费已结，金额已到账。" },
    // ==== 品牌方 ====
    { from: "brand", trigger: "fans_milestone",text: "看到你最近的数据很爆，我们有个新品想邀请你做主推，价位可以聊。" },
    { from: "brand", trigger: "schedule_done", text: "上次代言反响超出预期，加签一年的合作意向已发邮件。" },
    { from: "brand", trigger: "random",        text: "节假日礼盒已经走快递了，附了张手写卡。" },
    // ==== 后援会 ====
    { from: "fanclub", trigger: "post",         text: "新动态我们已经做了图文整理，转评赞数据正在拉高！" },
    { from: "fanclub", trigger: "schedule_done",text: "现场视频剪辑稿组里同步了，等你授权就发！" },
    { from: "fanclub", trigger: "fans_milestone",text: "里程碑庆祝企划上线了，应援物已经印厂在赶工。" },
    { from: "fanclub", trigger: "random",       text: "周报上线了，本周打榜数据稳居前三。" },
    // ==== 圈内好友 ====
    { from: "friend", trigger: "schedule_done", text: "刚才路过看你彩排了，状态比上回好多了。" },
    { from: "friend", trigger: "stress_high",   text: "兄弟，看你这阵子忙得离谱，约个夜宵透透气？" },
    { from: "friend", trigger: "random",        text: "新歌做完了？我这边有个 demo 想找你听一下。" },
    // ==== 媒体记者 ====
    { from: "media", trigger: "fans_milestone", text: "想做一个专访，主题是你这一年成长，方便约个时间吗？" },
    { from: "media", trigger: "post",           text: "刚转了你的动态，关注度涨得很快，建议保持节奏。" },
    { from: "media", trigger: "stress_high",    text: "听说你最近超负荷，要注意黑稿可能借机抹黑，提前打个招呼。" }
  ],

  // 成就系统（里程碑徽章，条件检测，一次性解锁）
  achievements: [
    { id: "a_train10",   name: "勤奋练习生",   desc: "完成10次训练",     icon: "🔥" },
    { id: "a_sched5",    name: "通告狂魔",     desc: "完成5次行程",     icon: "🎤" },
    { id: "a_fans10k",   name: "人气初起",     desc: "粉丝突破1万",     icon: "⭐" },
    { id: "a_fans100k",  name: "小有名气",     desc: "粉丝突破10万",    icon: "🌟" },
    { id: "a_fans1m",    name: "明日之星",     desc: "粉丝突破100万",   icon: "💫" },
    { id: "a_fans10m",   name: "顶流巨星",     desc: "粉丝突破1000万",  icon: "👑" },
    { id: "a_album1",    name: "首发之作",     desc: "发布第1张专辑",   icon: "💿" },
    { id: "a_album5",    name: "高产艺术家",   desc: "累计发布5张专辑", icon: "📀" },
    { id: "a_award1",    name: "初获殊荣",     desc: "获得第1个奖项",   icon: "🏆" },
    { id: "a_award5",    name: "奖项收割机",   desc: "累计获得5个奖项", icon: "🏅" },
    { id: "a_master",    name: "宗师境界",     desc: "任意属性达到宗师 Lv.8", icon: "🧘" },
    { id: "a_collect5",  name: "收藏达人",     desc: "收集5件收藏品",   icon: "🎁" },
    { id: "a_chart1",    name: "榜上有名",     desc: "打榜积分达到1000",icon: "📊" },
    { id: "a_chart10k",  name: "榜单王者",     desc: "打榜积分达到10000",icon: "📈" },
    { id: "a_checkin7",  name: "持之以恒",     desc: "累计签到7天",     icon: "📅" },
    { id: "a_post50",    name: "社交达人",     desc: "累计发布50条动态",icon: "💬" },
    { id: "a_coin100k",  name: "身价百万",     desc: "累计金币超10万",  icon: "💰" },
    { id: "a_meet100",   name: "粉丝之心",     desc: "见面会积分达100", icon: "💖" }
  ],

  // 周任务（每周一刷新）
  weekly_tasks: [
    { id: "w_train30",   name: "本周完成30次训练",   target: { trainCount: 30 }, reward: { fans: 50000, coin: 5000 } },
    { id: "w_sched10",   name: "本周完成10次行程",   target: { schedCount: 10 }, reward: { fans: 100000, coin: 10000 } },
    { id: "w_post10",    name: "本周发布10条动态",   target: { postCount: 10 },  reward: { fans: 20000, coin: 3000 } }
  ],

  // 专辑预设（可发布的专辑题材，决定销量基数）
  album_types: [
    { id: "alb_ballad",  name: "抒情专辑",     desc: "走心的情歌路线",       cost: 3000,  duration: 7,  requires: { vocal: 40, create: 30 },   gain: { fans: 80000,  coin: 5000,  reputation: 6, stress: 25 } },
    { id: "alb_dance",   name: "舞曲专辑",     desc: "高燃舞台向，洗脑节奏", cost: 4000,  duration: 8,  requires: { dance: 50, create: 30 },   gain: { fans: 120000, coin: 7000,  reputation: 5, stress: 28 } },
    { id: "alb_concept", name: "概念专辑",     desc: "完整故事线，艺术性强", cost: 8000,  duration: 12, requires: { vocal: 65, create: 70 },   gain: { fans: 250000, coin: 18000, reputation: 15, stress: 35 } },
    { id: "alb_remix",   name: "翻唱合辑",     desc: "致敬经典，话题度高",   cost: 1500,  duration: 5,  requires: { vocal: 30 },               gain: { fans: 30000,  coin: 2500,  reputation: 2, stress: 12 } }
  ],

  // 奖项预设（达成条件自动颁发）
  awards: [
    { id: "aw_rookie",     name: "年度新人奖",   icon: "🥉", cond: { fans: 100000 } },
    { id: "aw_chart",      name: "数字音乐榜冠军", icon: "🥈", cond: { fans: 500000 } },
    { id: "aw_charisma",   name: "最具人气艺人", icon: "💫", cond: { fans: 1000000, charm: 70 } },
    { id: "aw_album",      name: "年度专辑奖",   icon: "💿", cond: { albumCount: 3 } },
    { id: "aw_overseas",   name: "亚洲音乐节大奖", icon: "🌏", cond: { fans: 3000000 } },
    { id: "aw_top",        name: "年度顶流",     icon: "👑", cond: { fans: 10000000 } }
  ],

  // 收藏品（随机活动掉落，无属性加成纯收集）
  collectibles: [
    { id: "col_signbook", name: "限定签名本",   icon: "📓", desc: "首演纪念，每张独一无二" },
    { id: "col_lightstick", name: "应援棒升级版", icon: "🪄", desc: "粉丝送的镶钻款" },
    { id: "col_concert_ticket", name: "首演门票", icon: "🎫", desc: "舞台生涯起点" },
    { id: "col_award_medal", name: "新人奖奖牌", icon: "🏅", desc: "第一座奖" },
    { id: "col_letter",   name: "粉丝手写信",   icon: "💌", desc: "厚厚一摞的爱" },
    { id: "col_album_demo", name: "首张专辑母带", icon: "💽", desc: "录音棚原版" },
    { id: "col_polaroid", name: "复古拍立得",   icon: "📷", desc: "成员合影" },
    { id: "col_costume",  name: "舞台首战战服", icon: "👗", desc: "签上日期收藏" }
  ]
};
