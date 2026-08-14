-- ============================================================
-- 修仙问答 · 高校下沉市场冷启动种子内容
-- 执行位置：Supabase Dashboard → SQL Editor 粘贴全部执行
-- 作用：公测首日全站不再空荡，给新访客（高校学子）即时可见的内容
-- 幂等：以标题去重，重复执行不会重复插入
-- 说明：用站内已存在的任一 profile 作为种子作者；若尚无用户则跳过
-- ============================================================

DO $$
DECLARE
  v_author UUID;
  v_qid INTEGER;
BEGIN
  SELECT id INTO v_author FROM public.profiles ORDER BY created_at LIMIT 1;
  IF v_author IS NULL THEN
    RAISE NOTICE '站内尚无用户，跳过种子内容（请先注册一个账号再执行）';
    RETURN;
  END IF;

  -- 1) 考研二战还是就业？
  IF NOT EXISTS (SELECT 1 FROM public.questions WHERE title = '考研二战还是就业？修仙路上如何抉择') THEN
    INSERT INTO public.questions (user_id, title, content, type, status)
    VALUES (v_author, '考研二战还是就业？修仙路上如何抉择',
      '大三下，绩点中等，家里想让我考研，但同寝室的已经拿到offer了。感觉自己卡在"筑基"还是"出山"的关口，求过来人道友指点。',
      'normal', 'active') RETURNING id INTO v_qid;
    INSERT INTO public.answers (question_id, user_id, content, like_count)
    VALUES (v_qid, v_author, '先想清楚你考研是为了"避世"还是真有研究方向。如果只是为了延缓就业，二战风险极高——行情每年都在变。建议先投一波简历试水，拿到保底offer再决定要不要全职备考，进可攻退可守。', 12);
  END IF;

  -- 2) 四六级怎么过
  IF NOT EXISTS (SELECT 1 FROM public.questions WHERE title = '四级考了三次还没过，是不是该放弃') THEN
    INSERT INTO public.questions (user_id, title, content, type, status)
    VALUES (v_author, '四级考了三次还没过，是不是该放弃',
      '每次都卡在420分上下，听力完全听不懂。室友说我是"心魔未除"，求一份能落地的破局法。',
      'normal', 'active') RETURNING id INTO v_qid;
    INSERT INTO public.answers (question_id, user_id, content, like_count)
    VALUES (v_qid, v_author, '别放弃。四级本质是"套路题"，听力用精听法（每天1套真题听写），阅读先题后文找关键词，作文背3套模板。你卡420说明底子有，差的是方法。一个月足够破局。', 28);
  END IF;

  -- 3) 宿舍关系
  IF NOT EXISTS (SELECT 1 FROM public.questions WHERE title = '室友半夜打游戏开麦，该怎么体面地刚') THEN
    INSERT INTO public.questions (user_id, title, content, type, status)
    VALUES (v_author, '室友半夜打游戏开麦，该怎么体面地刚',
      '十二点后依旧"敌已在我脚下"，我已经连续一周没睡好。直接说怕伤和气，不说自己又吃亏。',
      'normal', 'active') RETURNING id INTO v_qid;
    INSERT INTO public.answers (question_id, user_id, content, like_count)
    VALUES (v_qid, v_author, '体面刚的法子：先共情再立规矩。可以说"兄弟我最近失眠，咱们约个十二点静音怎么样，我请你喝奶茶"。把"要求"包装成"互相照顾"，大多数人会接。真遇上油盐不进的，再找宿管或班导协调，别自己内耗。', 41);
  END IF;

  -- 4) 考公还是考研
  IF NOT EXISTS (SELECT 1 FROM public.questions WHERE title = '双非本科，考公和考研哪个更稳') THEN
    INSERT INTO public.questions (user_id, title, content, type, status)
    VALUES (v_author, '双非本科，考公和考研哪个更稳',
      '家里让我考公求稳，我自己想读研换个赛道。纠结"体制内筑基"还是"深造飞升"。',
      'normal', 'active') RETURNING id INTO v_qid;
    INSERT INTO public.answers (question_id, user_id, content, like_count)
    VALUES (v_qid, v_author, '双非背景，考研想翻身进大厂/名校难度不低；考公则更看考试能力，双非也能报大量岗位。建议：先准备考研英语+申论通用的内容，秋招同时投国企/选调，拿到任一保底再冲。别把鸡蛋放一个篮子。', 19);
  END IF;

  -- 5) 挂科逆袭
  IF NOT EXISTS (SELECT 1 FROM public.questions WHERE title = '大一高数挂了，会影响后续"飞升"吗') THEN
    INSERT INTO public.questions (user_id, title, content, type, status)
    VALUES (v_author, '大一高数挂了，会影响后续"飞升"吗',
      '补考能过，但怕留痕影响保研和简历。道心有点动摇。',
      'normal', 'active') RETURNING id INTO v_qid;
    INSERT INTO public.answers (question_id, user_id, content, like_count)
    VALUES (v_qid, v_author, '补考过就不算大事，多数学校补考合格后会覆盖或标注"补考通过"，保研看的是重修后的绩点。关键是别再挂第二门。把高数当"心魔"正面刚，习题册刷三遍，你这关能过。', 23);
  END IF;

  RAISE NOTICE '高校种子内容已写入（作者: %）', v_author;
END $$;
