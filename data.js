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
      { key: "energy",   name: "体力",   max: 100, init: 100 },
      { key: "fans",     name: "粉丝",   max: null, init: 0 },
      { key: "coin",     name: "金币",   max: null, init: 500 },
      { key: "exposure", name: "曝光度", max: 100, init: 10 }
    ]
  },

  // 养成训练（耗体力 → 加属性）
  trainings: [
    { id: "t_vocal",   name: "声乐训练", desc: "专业声乐老师一对一教学，唱功大幅提升", cost: 20, gain: { vocal: 8, exposure: 1 } },
    { id: "t_dance",   name: "舞蹈训练", desc: "基础功、编舞拆解，全面提升舞技",       cost: 20, gain: { dance: 8, exposure: 1 } },
    { id: "t_create",  name: "创作训练", desc: "专注音乐创作，提升原创实力",           cost: 20, gain: { create: 8, exposure: 1 } },
    { id: "t_style",   name: "造型训练", desc: "发型、妆容、服装搭配，提升颜值",       cost: 15, gain: { charm: 8, exposure: 2 } },
    { id: "t_rest",    name: "休息放松", desc: "运动按摩+营养补充，迅速恢复体力",     cost: -40, gain: {} }  // cost 为负 = 回体力
  ],

  // 行程（挂机任务：消耗体力 + 时间 → 收获粉丝/金币/曝光）
  schedules: [
    { id: "s_stage_small", name: "剧场舞台",   desc: "积累打榜基础分",         cost: 25, duration: 3, gain: { fans: 800,   coin: 200,  exposure: 5  }, requires: { vocal: 0,  dance: 0  } },
    { id: "s_variety",     name: "综艺通告",   desc: "参加热门综艺，提升路人好感", cost: 30, duration: 4, gain: { fans: 2500,  coin: 600,  exposure: 12 }, requires: { charm: 30 } },
    { id: "s_album",       name: "发布单曲",   desc: "在专辑工作室发布新单曲",     cost: 40, duration: 6, gain: { fans: 5000,  coin: 1500, exposure: 20 }, requires: { vocal: 50, create: 30 } },
    { id: "s_concert_mid", name: "中型演唱会", desc: "中等规模演出，积累现场口碑", cost: 50, duration: 8, gain: { fans: 12000, coin: 3500, exposure: 25 }, requires: { vocal: 60, dance: 60 } },
    { id: "s_endorse",     name: "品牌代言",   desc: "拍摄商业广告，金主爸爸来了", cost: 35, duration: 5, gain: { fans: 4000,  coin: 8000, exposure: 18 }, requires: { charm: 70 } },
    { id: "s_concert_big", name: "万人音乐节", desc: "万人舞台压轴演出",           cost: 70, duration: 10, gain: { fans: 35000, coin: 12000, exposure: 40 }, requires: { vocal: 80, dance: 80, charm: 70 } },
    { id: "s_award",       name: "颁奖典礼",   desc: "出席年度颁奖典礼，展示风采", cost: 60, duration: 8, gain: { fans: 50000, coin: 20000, exposure: 60 }, requires: { fans: 1000000 } }
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

  // 粉丝群聊（后援会消息池，随机弹出）
  fan_chats: [
    { name: "后援会会长",   text: "今天有个新人朋友加群，大家欢迎一下！" },
    { name: "数据组小橙",   text: "播放量破亿了！比预计早三天！大家太给力了！" },
    { name: "应援组阿然",   text: "下周演唱会的应援物，颜色色卡发群文件了！" },
    { name: "后援会暖暖",   text: "刚才官博发了新图，姐妹们冲！" },
    { name: "宣传组云云",   text: "热搜上来了，控评位置已经安排好！" },
    { name: "打榜组阿璃",   text: "新人打榜教程已更新，五分钟学会！" },
    { name: "后援会小鹿",   text: "今天爱豆在练习室那张状态照……心疼……" },
    { name: "物料组CC",     text: "周边定了荧光棒升级款，预购链接发群里了！" },
    { name: "副会长小敏",   text: "啊啊啊获奖了！！愿望成真了！！！" },
    { name: "后援会阿糖",   text: "评论区有黑粉，姐妹们去用事实说话不要情绪化！" }
  ],

  // 结局（满足条件触发）
  endings: [
    { id: "ending_god",     cond: { fans: 50000000, vocal: 90, dance: 90, charm: 90, create: 80 }, title: "顶流封神", desc: "你以全维度顶尖姿态完成谢幕演唱会，行业再无后继。" },
    { id: "ending_actor",   cond: { fans: 5000000, charm: 90 },                                     title: "影视破圈", desc: "你转战大银幕，成为新一代国民演员。" },
    { id: "ending_overseas",cond: { fans: 3000000 },  flag: "overseas",                              title: "海外征途", desc: "你在格莱美舞台用母语高歌一曲，国际化路线开花。" },
    { id: "ending_solo",    cond: { fans: 2000000 },  flag: "solo_path",                             title: "创立厂牌", desc: "你从0组建独立厂牌，签下三位新人，行业地位重塑。" },
    { id: "ending_retire",  cond: { fans: 1000000 },                                                  title: "低调隐退", desc: "你选择在事业上升期退场，留下一个干净的偶像传说。" },
    { id: "ending_rookie",  cond: {},                                                                  title: "初心未改", desc: "粉丝不多，但每一个都还在听你的歌。" }
  ]
};
