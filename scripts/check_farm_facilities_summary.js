const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    });
}

async function main() {
  loadEnv();
  const farmName = process.argv[2];
  if (!farmName) {
    console.error("사용법: node scripts/check_farm_facilities_summary.js <농장명>");
    process.exit(1);
  }
  const client = new Client({
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    database: process.env.POSTGRES_DB || "pig_farm_db",
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "postgres",
  });
  await client.connect();
  try {
    const farmRes = await client.query('SELECT id FROM farms WHERE "farmName"=$1 LIMIT 1', [farmName]);
    if (!farmRes.rowCount) {
      console.log("NOT_FOUND");
      return;
    }
    const farmId = farmRes.rows[0].id;
    const summary = await client.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE LOWER(COALESCE(ba.name, '')) = 'barn') AS barns_named_barn,
        COUNT(*) FILTER (WHERE r.name LIKE '%踰%') AS garbled_rooms,
        COUNT(*) FILTER (WHERE s.name LIKE '%踰%') AS garbled_sections
      FROM farm_buildings b
      LEFT JOIN farm_barns ba ON ba."buildingId"=b.id
      LEFT JOIN farm_rooms r ON r."barnId"=ba.id
      LEFT JOIN farm_sections s ON s."roomId"=r.id
      WHERE b."farmId"=$1
      `,
      [farmId]
    );
    console.log(JSON.stringify(summary.rows[0], null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});

