/**
 * farms 테이블에 API에서 사용하는 모든 컬럼 추가 (없으면 추가)
 * 사용: node scripts/run_ensure_farms_columns.js
 * (프로젝트 루트에서 실행. .env 의 POSTGRES_* 설정 사용)
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
    console.error('pg 패키지가 필요합니다. 프로젝트 루트에서 실행: npm install pg');
    process.exit(1);
  }
  const sqlPath = path.join(__dirname, 'ensure_farms_columns.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new pg.Client(config);
  try {
    await client.connect();
    await client.query(sql);
    console.log('완료: farms 테이블에 필요한 컬럼이 추가되었습니다.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
