-- ============================================================
-- xiuixian 表白墙增强（v31）
-- 发布收费 ¥1 · 置顶 ¥5/天 · 后台管理 · 故事后续 · 双方确认关系（被表白人接受 → 表白人确认 → 双方传截图/补充后续）
-- 执行方式：Supabase 控制台 → SQL Editor → 粘贴全部 → Run
-- 本脚本幂等，可重复执行。
-- 前端已做「新函数未部署则回退旧逻辑」的兼容，因此：
--   · 未执行本脚本前：发布免费、置顶 ¥2/天、删除/故事后续/确认 暂不可用（按钮会提示「需先执行SQL升级」）。
--   · 执行后：全部生效。
-- ============================================================

-- 1) 扩展 confessions 表（新增字段）
alter table public.confessions add column if not exists amount            numeric      not null default 1;
alter table public.confessions add column if not exists story_update      text         default '';
alter table public.confessions add column if not exists story_updated_at  timestamptz;
alter table public.confessions add column if not exists confirm_a         boolean      not null default false;
alter table public.confessions add column if not exists confirm_b         boolean      not null default false;
alter table public.confessions add column if not exists confirm_screenshot text         default '';
alter table public.confessions add column if not exists confirmed_at      timestamptz;

-- 2) 发布表白并扣费 ¥1（前端优先调用 pay_create_confession；未部署时回退到原 create_confession 免费）
create or replace function public.pay_create_confession(
  p_content      text,
  p_to_name      text    default '',
  p_is_anonymous boolean default true,
  p_image        text    default '',
  p_school_id    integer default null,
  p_amount       numeric default 1
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id  int;
  v_bal numeric;
begin
  select balance into v_bal from public.profiles where id = auth.uid();
  if v_bal is null or v_bal < p_amount then
    return jsonb_build_object('error', '余额不足，请先签到领1元或充值');
  end if;
  update public.profiles set balance = balance - p_amount where id = auth.uid();
  insert into public.confessions (user_id, content, to_name, is_anonymous, image, school_id, amount)
  values (auth.uid(), p_content, p_to_name, p_is_anonymous, p_image, p_school_id, p_amount)
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end;
$$;

-- 3) 置顶并扣费 ¥5/天（前端优先调用 pin_confession_paid；未部署时回退 pin_confession ¥2/天）
create or replace function public.pin_confession_paid(
  p_id     integer default null,
  p_days   integer default 1,
  p_amount numeric default 5
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid;
  v_bal   numeric;
  v_until timestamptz;
begin
  select user_id into v_uid from public.confessions where id = p_id;
  if v_uid is null then return jsonb_build_object('error', '表白不存在'); end if;
  if v_uid <> auth.uid() then return jsonb_build_object('error', '只能置顶自己的表白'); end if;
  select balance into v_bal from public.profiles where id = auth.uid();
  if v_bal is null or v_bal < p_amount then return jsonb_build_object('error', '余额不足'); end if;
  update public.profiles set balance = balance - p_amount where id = auth.uid();
  v_until := now() + (p_days || ' days')::interval;
  update public.confessions set pinned = true, pinned_until = v_until where id = p_id;
  return jsonb_build_object('ok', true, 'pinned_until', v_until);
end;
$$;

-- 4) 个人删除自己的表白
create or replace function public.delete_my_confession(p_id integer) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  delete from public.confessions where id = p_id and user_id = auth.uid();
  if not found then return jsonb_build_object('error', '无权限或不存在'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- 5) 作者/关系双方 补充故事后续
--    · 表白人本人始终可补充；
--    · 被表白人（非发布者）在「已接受」之后可补充；
--    · 其他无关用户不可补充。
create or replace function public.update_confession_story(p_id integer, p_text text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid; v_acc timestamptz; v_conf timestamptz;
begin
  select user_id, accepted_at, confirmed_at into v_uid, v_acc, v_conf
    from public.confessions where id = p_id;
  if v_uid is null then return jsonb_build_object('error', '表白不存在'); end if;
  if v_uid <> auth.uid() and v_acc is null and v_conf is null then
    return jsonb_build_object('error', '仅表白人或关系双方可补充后续');
  end if;
  update public.confessions set story_update = p_text, story_updated_at = now() where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- 6) 表白人 确认关系并上传截图（需发布者本人）
--    被表白人先 accept 后，表白人在此确认；双方都完成则标记 confirmed_at。
create or replace function public.confirm_confession(
  p_id         integer,
  p_screenshot text default ''
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid; v_acc timestamptz; v_pos timestamptz;
begin
  select user_id into v_uid from public.confessions where id = p_id;
  if v_uid is null then return jsonb_build_object('error', '表白不存在'); end if;
  if v_uid <> auth.uid() then return jsonb_build_object('error', '只能由表白人本人确认'); end if;
  update public.confessions
     set poster_confirmed_at = coalesce(poster_confirmed_at, now()),
         confirm_screenshot_a = coalesce(nullif(p_screenshot, ''), confirm_screenshot_a)
   where id = p_id;
  select accepted_at, poster_confirmed_at into v_acc, v_pos from public.confessions where id = p_id;
  if v_acc is not null and v_pos is not null then
    update public.confessions set confirmed_at = now() where id = p_id;
  end if;
  return jsonb_build_object('ok', true, 'confirmed', (v_acc is not null and v_pos is not null));
end;
$$;

-- 6.1) 被表白人 接受表白并上传截图（需非发布者本人）
create or replace function public.accept_confession(
  p_id         integer,
  p_screenshot text default ''
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid; v_acc timestamptz; v_pos timestamptz;
begin
  select user_id into v_uid from public.confessions where id = p_id;
  if v_uid is null then return jsonb_build_object('error', '表白不存在'); end if;
  if v_uid = auth.uid() then return jsonb_build_object('error', '不能接受自己的表白'); end if;
  update public.confessions
     set accepted_at = coalesce(accepted_at, now()),
         confirm_screenshot_b = coalesce(nullif(p_screenshot, ''), confirm_screenshot_b)
   where id = p_id;
  select accepted_at, poster_confirmed_at into v_acc, v_pos from public.confessions where id = p_id;
  if v_acc is not null and v_pos is not null then
    update public.confessions set confirmed_at = now() where id = p_id;
  end if;
  return jsonb_build_object('ok', true, 'confirmed', (v_acc is not null and v_pos is not null));
end;
$$;

-- 6.2) 新增字段：被表白人接受时间 / 表白人确认时间 / 双方截图
alter table public.confessions add column if not exists accepted_at           timestamptz;
alter table public.confessions add column if not exists poster_confirmed_at  timestamptz;
alter table public.confessions add column if not exists confirm_screenshot_a text default '';
alter table public.confessions add column if not exists confirm_screenshot_b text default '';

-- 7) 后台管理（管理员）：删除 / 置顶 / 精选 / 驳回
create or replace function public.admin_delete_confession(p_id integer) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    return jsonb_build_object('error', '无管理员权限');
  end if;
  delete from public.confessions where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_pin_confession(p_id integer, p_days integer default 1) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    return jsonb_build_object('error', '无管理员权限');
  end if;
  update public.confessions set pinned = true, pinned_until = now() + (p_days || ' days')::interval where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_feature_confession(p_id integer, p_days integer default 1) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    return jsonb_build_object('error', '无管理员权限');
  end if;
  update public.confessions set featured = true, featured_until = now() + (p_days || ' days')::interval where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_reject_confession(p_id integer) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    return jsonb_build_object('error', '无管理员权限');
  end if;
  update public.confessions set status = 'rejected' where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- 8) 后台编辑表白内容（管理员）
create or replace function public.admin_update_confession(
  p_id       integer,
  p_content  text,
  p_to_name  text default ''
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    return jsonb_build_object('error', '无管理员权限');
  end if;
  update public.confessions set content = p_content, to_name = p_to_name where id = p_id;
  if not found then return jsonb_build_object('error', '表白不存在'); end if;
  return jsonb_build_object('ok', true);
end;
$$;
