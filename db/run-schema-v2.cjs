const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const PROJECT_REF = 'nwxtyxjborhrbesssopg';
const PASSWORD = 'qpalWOSK159';

const HOSTS = [
  { host: `aws-0-ap-southeast-1.pooler.supabase.com`, port: 5432, label: 'Singapore-5432' },
  { host: `aws-0-ap-southeast-1.pooler.supabase.com`, port: 6543, label: 'Singapore-6543' },
  { host: `aws-0-ap-northeast-1.pooler.supabase.com`, port: 5432, label: 'Tokyo-5432' },
  { host: `aws-0-ap-northeast-1.pooler.supabase.com`, port: 6543, label: 'Tokyo-6543' },
  { host: `aws-0-us-east-1.pooler.supabase.com`, port: 5432, label: 'USEast-5432' },
  { host: `aws-0-us-east-1.pooler.supabase.com`, port: 6543, label: 'USEast-6543' },
  { host: `aws-0-us-west-1.pooler.supabase.com`, port: 5432, label: 'USWest-5432' },
  { host: `aws-0-eu-west-1.pooler.supabase.com`, port: 5432, label: 'EUWest-5432' },
  { host: `aws-0-eu-west-2.pooler.supabase.com`, port: 5432, label: 'EUWest2-5432' },
  { host: `aws-0-ap-south-1.pooler.supabase.com`, port: 5432, label: 'Mumbai-5432' },
  { host: `aws-0-ap-east-1.pooler.supabase.com`, port: 5432, label: 'HK-5432' },
  { host: `aws-0-ca-central-1.pooler.supabase.com`, port: 5432, label: 'Canada-5432' },
  { host: `aws-0-sa-east-1.pooler.supabase.com`, port: 5432, label: 'SaoPaulo-5432' },
  { host: `aws-0-eu-central-1.pooler.supabase.com`, port: 5432, label: 'EUCentral-5432' },
  { host: `aws-0-eu-central-2.pooler.supabase.com`, port: 5432, label: 'EUCentral2-5432' },
];

async function tryConnect() {
  const sqlPath = path.join(__dirname, 'supabase-schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  for (const cfg of HOSTS) {
    const config = {
      host: cfg.host,
      port: cfg.port,
      database: 'postgres',
      user: `postgres.${PROJECT_REF}`,
      password: PASSWORD,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    };

    console.log(`Trying ${cfg.label} (${cfg.host}:${cfg.port})...`);
    const client = new Client(config);
    try {
      await client.connect();
      console.log(`  ✓ Connected on ${cfg.label}!`);

      // Execute schema
      await client.query(sql);
      console.log('  Schema SQL executed successfully!');

      // Verify
      const res = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
      console.log('  Tables:', res.rows.map(r => r.tablename).join(', '));

      await client.end();
      console.log('\n✅ Database schema created!');
      return true;
    } catch (err) {
      console.log(`  ✗ ${err.message.substring(0, 80)}`);
      try { await client.end(); } catch {}
    }
  }
  return false;
}

tryConnect().then(ok => {
  if (!ok) {
    console.log('\n❌ All connection attempts failed.');
    console.log('Please check your Supabase Dashboard -> Settings -> Database for the correct connection string.');
    process.exit(1);
  }
});
