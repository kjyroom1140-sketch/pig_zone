/**
 * SQL 파일 실행 (마이그레이션/스키마 적용)
 * 사용: node scripts/run_sql.js scripts/파일명.sql
 * 프로젝트 루트에서 실행. .env 의 POSTGRES_* 설정 사용.
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
  const sqlArg = process.argv[2];
  if (!sqlArg) {
    console.error('사용법: node scripts/run_sql.js scripts/파일명.sql');
    process.exit(1);
  }
  const sqlPath = path.isAbsolute(sqlArg) ? sqlArg : path.join(__dirname, '..', sqlArg);
  if (!fs.existsSync(sqlPath)) {
    console.error('파일 없음:', sqlPath);
    process.exit(1);
  }
  let pg;
  try {
    pg = require('pg');
  } catch (e) {
    console.error('pg 패키지가 필요합니다. 프로젝트 루트에서: npm install pg');
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new pg.Client(config);
  try {
    await client.connect();
    await client.query(sql);
    console.log('완료:', path.basename(sqlPath));
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
