const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'pig_farm_db',
});

(async () => {
  try {
    await client.connect();
    const res = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns 
       WHERE table_name = 'structure_templates' AND column_name = 'category'`
    );
    console.log('structure_templates.category 타입:');
    console.table(res.rows);
  } finally {
    await client.end();
  }
})();
