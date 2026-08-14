const { Client } = require('pg');
const HOST = process.env.DB_HOST || 'aws-0-ap-northeast-1.pooler.supabase.com';
const PORT = +(process.env.DB_PORT || 5432);
const DB = process.env.DB_NAME || 'postgres';
const USER = process.env.DB_USER || 'postgres.nwxtyxjborhrbesssopg';
const PASS = process.env.DB_PASS || 'qpalWOSK159';

(async () => {
  const client = new Client({ host: HOST, port: PORT, database: DB, user: USER, password: PASS, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
  await client.connect();
  try {
    await client.query('BEGIN');

    // 1) 删除测试数据（NO ACTION 外键的表，先手动清）
    await client.query(`DELETE FROM public.user_penalties WHERE user_id IN ('eff1235b-4213-4d75-910c-d70e9530926d','f6947a88-2196-4b89-9b4c-a03e27ae55d0','7fc9a85f-001f-4f2b-b28e-11733450a67b','2cbc32d4-b7b7-41dc-ac17-733e988d05bb','7b6139e5-adae-414d-bdc9-50ebd47321e6')`);
    await client.query(`DELETE FROM public.promotion_requests WHERE user_id IN ('eff1235b-4213-4d75-910c-d70e9530926d','f6947a88-2196-4b89-9b4c-a03e27ae55d0','7fc9a85f-001f-4f2b-b28e-11733450a67b','2cbc32d4-b7b7-41dc-ac17-733e988d05bb','7b6139e5-adae-414d-bdc9-50ebd47321e6')`);
    await client.query(`DELETE FROM public.credit_logs WHERE user_id IN ('eff1235b-4213-4d75-910c-d70e9530926d','f6947a88-2196-4b89-9b4c-a03e27ae55d0','7fc9a85f-001f-4f2b-b28e-11733450a67b','2cbc32d4-b7b7-41dc-ac17-733e988d05bb','7b6139e5-adae-414d-bdc9-50ebd47321e6')`);
    await client.query(`DELETE FROM public.announcements WHERE id = 2`); // 删除“封禁公告”测试公告

    // 2) 删除 5 个体验账号（级联删除其内容/点赞/关注/私信等）
    await client.query(`DELETE FROM auth.users WHERE id IN ('eff1235b-4213-4d75-910c-d70e9530926d','f6947a88-2196-4b89-9b4c-a03e27ae55d0','7fc9a85f-001f-4f2b-b28e-11733450a67b','2cbc32d4-b7b7-41dc-ac17-733e988d05bb','7b6139e5-adae-414d-bdc9-50ebd47321e6')`);
    const remain = await client.query(`SELECT count(*) FROM auth.users`);
    console.log('剩余 auth.users:', remain.rows[0].count);

    // 3) 创建管理员账号 mazhenzhou1996@163.com / qweasd123321
    const adminId = 'a1b2c3d4-0000-4000-8000-00000000a1b2';
    await client.query(`INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, last_sign_in_at)
      VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, crypt($3, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"phone":"","nickname":"管理员"}', now(), now(), '', '', '', '', now())
      ON CONFLICT (id) DO NOTHING`, [adminId, 'mazhenzhou1996@163.com', 'qweasd123321']);
    await client.query(`INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), $1::text, $1::uuid, jsonb_build_object('sub', $1::text, 'email', $2::text, 'email_verified', true), 'email', now(), now(), now())
      ON CONFLICT (provider_id, provider) DO NOTHING`, [adminId, 'mazhenzhou1996@163.com']);
    // 更新 profile：管理员身份
    await client.query(`UPDATE public.profiles SET is_admin = true, nickname = '管理员', school = '' WHERE id = $1::uuid`, [adminId]);

    // 4) 注册自动确认触发器：新用户注册后立即 email_confirmed（公开注册无需收信）
    await client.query(`
      CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
      RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
      BEGIN
        IF NEW.email_confirmed_at IS NULL THEN
          UPDATE auth.users SET email_confirmed_at = now() WHERE id = NEW.id;
        END IF;
        RETURN NEW;
      END $$;
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_auto_confirm_new_user ON auth.users;
      CREATE TRIGGER trg_auto_confirm_new_user
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_new_user();
    `);

    // 5) 更新欢迎公告
    await client.query(`UPDATE public.announcements SET title = '欢迎来到修仙问答', content = '这里是大学生自己的问答社区：提问、回答、论道，与全国道友一起修仙。注册即用，欢迎加入！' WHERE id = 1`);

    await client.query('COMMIT');
    console.log('ACCOUNT OPS DONE');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ERR:', e.message);
    process.exit(1);
  }
  await client.end();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
