/**
 * 구분→작업유형→기준 계층 변경: 데이터 삭제 후 스키마 변경
 * 사용: node scripts/run_schedule_hierarchy_redesign.js
 * 주의: 구분·기준·작업유형 데이터가 모두 삭제됩니다.
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
  const sqlPath = path.join(__dirname, 'schedule_hierarchy_redesign.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new pg.Client(config);
  try {
    await client.connect();
    await client.query(sql);
    console.log('완료: 구분·기준·작업유형 데이터 삭제 및 스키마 변경 (jobtypes.sortation_id, criterias.jobtype_id)');
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
