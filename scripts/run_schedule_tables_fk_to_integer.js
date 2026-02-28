/**
 * 구분/기준/작업유형 테이블의 FK 컬럼을 INTEGER로 통일
 * 사용: node scripts/run_schedule_tables_fk_to_integer.js
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
  const sqlPath = path.join(__dirname, 'schedule_tables_fk_to_integer.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new pg.Client(config);
  try {
    await client.connect();
    console.log('DB 연결됨:', config.database);
    await client.query(sql);
    console.log('완료: schedule_sortations.structure_template_id, schedule_criterias.schedule_sortations_id, schedule_jobtypes.schedule_criterias_id → INTEGER 통일');
  } catch (err) {
    console.error('실행 실패:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
main();
