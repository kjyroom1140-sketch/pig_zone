/**
 * schedule_criterias 테이블에서 sortations, description 컬럼 제거
 * 사용: node scripts/run_drop_schedule_criterias_columns.js
 * .env의 POSTGRES_* 값 사용 (또는 기본값)
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    });
  }
}
loadEnv();

const config = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'pig_farm_db',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
};

async function main() {
  let pg;
  try {
    pg = require('pg');
  } catch (e) {
    console.error('pg 패키지가 필요합니다. 실행: npm install pg');
    process.exit(1);
  }
  const client = new pg.Client(config);
  try {
    await client.connect();
    console.log('DB 연결됨:', config.database);

    const sql = `
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedule_criterias' AND column_name = 'sortations') THEN
          ALTER TABLE schedule_criterias ALTER COLUMN sortations DROP NOT NULL;
          ALTER TABLE schedule_criterias DROP COLUMN sortations;
          RAISE NOTICE 'sortations 컬럼 제거됨';
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedule_criterias' AND column_name = 'description') THEN
          ALTER TABLE schedule_criterias ALTER COLUMN description DROP NOT NULL;
          ALTER TABLE schedule_criterias DROP COLUMN description;
          RAISE NOTICE 'description 컬럼 제거됨';
        END IF;
      END $$;
    `;
    await client.query(sql);
    console.log('완료: schedule_criterias에서 sortations, description 컬럼 제거됨.');
  } catch (err) {
    console.error('실행 실패:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
main();
