/**
 * farms 테이블에 농장 정보 컬럼 추가 (대표자명, 사업자번호, 농장주소 등)
 * 사용: node scripts/run_add_farms_info_columns.js
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
  const sqlPath = path.join(__dirname, 'add_farms_info_columns.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new pg.Client(config);
  try {
    await client.connect();
    await client.query(sql);
    console.log('완료: farms 테이블에 농장 정보 컬럼 추가됨.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
