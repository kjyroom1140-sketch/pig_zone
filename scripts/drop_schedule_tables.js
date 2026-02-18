/**
 * 일정관리 관련 테이블 삭제 (데이터 + 구조)
 * 사용: CONFIRM=1 node scripts/drop_schedule_tables.js
 *
 * 삭제 순서 (자식 → 부모, CASCADE로 참조 제거):
 * - farm_schedule_work_plans
 * - farm_schedule_items
 * - farm_schedule_task_type_structures
 * - farm_schedule_task_types
 * - farm_schedule_basis_types
 * - schedule_items
 * - schedule_work_detail_type_structures
 * - schedule_work_detail_type_divisions
 * - schedule_work_detail_types
 * - schedule_work_type_structures
 * - schedule_work_type_divisions
 * - schedule_work_types
 * - schedule_division_structures
 * - schedule_bases
 * - schedule_divisions
 *
 * 주의: 실서비스 DB에서는 사용하지 말 것. 삭제 후 테이블 재생성은 서버 기동 시 Sequelize sync로 생성됩니다.
 */

const { sequelize } = require('../config/database');

const TABLES = [
    'farm_schedule_work_plans',
    'farm_schedule_items',
    'farm_schedule_task_type_structures',
    'farm_schedule_task_types',
    'farm_schedule_basis_types',
    'schedule_items',
    'schedule_work_detail_type_structures',
    'schedule_work_detail_type_divisions',
    'schedule_work_detail_types',
    'schedule_work_type_structures',
    'schedule_work_type_divisions',
    'schedule_work_types',
    'schedule_division_structures',
    'schedule_bases',
    'schedule_divisions'
];

async function run() {
    if (process.env.CONFIRM !== '1') {
        console.log('일정관리 테이블을 삭제하려면 다음처럼 실행하세요:');
        console.log('  CONFIRM=1 node scripts/drop_schedule_tables.js');
        console.log('\n삭제 대상:', TABLES.join(', '));
        process.exit(1);
    }

    try {
        await sequelize.authenticate();
        console.log('✅ DB 연결됨\n');

        for (let i = 0; i < TABLES.length; i++) {
            const table = TABLES[i];
            await sequelize.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
            console.log(`${i + 1}. DROP TABLE ${table} OK`);
        }

        console.log('\n✅ 일정관리 테이블 삭제 완료.');
        console.log('테이블 자동 재생성은 비활성화되어 있습니다. 재생성 시 config/database의 sync를 수동 실행하세요.');
    } catch (err) {
        console.error('오류:', err.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
