const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'pig_farm_db',
});

async function checkDB() {
  try {
    await client.connect();
    console.log('✅ DB 연결 성공\n');

    // 1. 성오농장 찾기
    console.log('=== 1️⃣ 성오농장 찾기 ===');
    const farmRes = await client.query(
      `SELECT id, "farmName", "farmCode" FROM farms WHERE "farmName" ILIKE $1`,
      ['%성오%']
    );
    console.log('결과:', farmRes.rows);
    
    if (farmRes.rows.length === 0) {
      console.log('❌ 성오농장을 찾을 수 없습니다.\n');
      
      // 모든 농장 목록
      console.log('=== 전체 농장 목록 ===');
      const allFarmsRes = await client.query(
        `SELECT id, "farmName", "farmCode" FROM farms ORDER BY "farmName" ASC`
      );
      console.log(allFarmsRes.rows);
      return;
    }

    const farmId = farmRes.rows[0].id;
    console.log(`✅ 농장 ID: ${farmId}\n`);

    // 2. farm_structure 테이블의 데이터 확인
    console.log('=== 2️⃣ farm_structure 테이블 확인 (production) ===');
    const structureRes = await client.query(
      `SELECT 
        fs.id,
        fs."farmId",
        fs."templateId",
        st.name as template_name,
        fs.name,
        fs.weight,
        fs."optimalDensity",
        fs.category,
        fs."createdAt",
        fs."updatedAt"
      FROM farm_structure fs
      LEFT JOIN structure_templates st ON st.id = fs."templateId"
      WHERE fs."farmId" = $1
        AND fs.category = 'production'
      ORDER BY fs.id ASC`,
      [farmId]
    );
    
    console.log(`행 개수: ${structureRes.rows.length}`);
    if (structureRes.rows.length === 0) {
      console.log('❌ 저장된 사육시설이 없습니다.\n');
    } else {
      console.log('✅ 저장된 사육시설:');
      console.table(structureRes.rows);
    }

    // 3. farm_structure 테이블 스키마 확인
    console.log('\n=== 3️⃣ farm_structure 테이블 스키마 ===');
    const schemaRes = await client.query(
      `
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'farm_structure'
      ORDER BY ordinal_position ASC
      `
    );
    console.table(schemaRes.rows);

    // 4. farm_structure의 category 값 확인
    console.log('\n=== 4️⃣ farm_structure category 데이터 타입 확인 ===');
    const categoryCheckRes = await client.query(
      `SELECT DISTINCT category, typeof(category::text) as type FROM farm_structure`
    );
    console.table(categoryCheckRes.rows);

    // 5. 모든 structure_templates 확인
    console.log('\n=== 5️⃣ structure_templates 테이블 ===');
    const templatesRes = await client.query(
      `SELECT id, name, category FROM structure_templates WHERE id IN (3, 4) ORDER BY id ASC`
    );
    console.table(templatesRes.rows);

  } catch (err) {
    console.error('❌ 오류 발생:', err.message);
  } finally {
    await client.end();
    console.log('\n✅ DB 연결 종료');
  }
}

checkDB();
