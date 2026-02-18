/**
 * 일정관리 관련 테이블 데이터만 초기화 (테이블 구조는 유지)
 * 사용: CONFIRM=1 node scripts/reset_schedule_data.js
 *
 * 삭제 순서 (자식 → 부모, FK 제약 준수):
 * - farm_schedule_work_plans
 * - pig_movements.schedule_item_id → NULL
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
 * 주의: 실서비스 DB에서는 사용하지 말 것. 개발/테스트용.
 */

const { sequelize } = require('../config/database');

async function run() {
    if (process.env.CONFIRM !== '1') {
        console.log('일정관리 테이블 데이터를 비우려면 다음처럼 실행하세요:');
        console.log('  CONFIRM=1 node scripts/reset_schedule_data.js');
        console.log('\n실행 시 위 테이블들의 데이터가 삭제됩니다. (테이블은 유지)');
        process.exit(1);
    }

    try {
        await sequelize.authenticate();
        console.log('✅ DB 연결됨\n');

        await sequelize.query('BEGIN');

        // 1) 농장 작업 계획
        await sequelize.query('DELETE FROM farm_schedule_work_plans');
        console.log('1. farm_schedule_work_plans 삭제 OK');

        // 2) 이동 이력에서 일정 연계만 끊기
        await sequelize.query(
            "UPDATE pig_movements SET schedule_item_id = NULL WHERE schedule_item_id IS NOT NULL"
        );
        console.log('2. pig_movements.schedule_item_id NULL 처리 OK');

        // 3) 농장 일정 항목
        await sequelize.query('DELETE FROM farm_schedule_items');
        console.log('3. farm_schedule_items 삭제 OK');

        // 4) 농장 작업유형 ↔ 시설
        await sequelize.query('DELETE FROM farm_schedule_task_type_structures');
        console.log('4. farm_schedule_task_type_structures 삭제 OK');

        // 5) 농장 작업유형
        await sequelize.query('DELETE FROM farm_schedule_task_types');
        console.log('5. farm_schedule_task_types 삭제 OK');

        // 6) 농장 기준 유형
        await sequelize.query('DELETE FROM farm_schedule_basis_types');
        console.log('6. farm_schedule_basis_types 삭제 OK');

        // 7) 전역 일정 항목
        await sequelize.query('DELETE FROM schedule_items');
        console.log('7. schedule_items 삭제 OK');

        // 8) 세부 작업유형 ↔ 장소/구분
        await sequelize.query('DELETE FROM schedule_work_detail_type_structures');
        await sequelize.query('DELETE FROM schedule_work_detail_type_divisions');
        console.log('8. schedule_work_detail_type_* 삭제 OK');

        // 9) 세부 작업유형(작업 내용)
        await sequelize.query('DELETE FROM schedule_work_detail_types');
        console.log('9. schedule_work_detail_types 삭제 OK');

        // 10) 작업유형 대분류 ↔ 장소/구분
        await sequelize.query('DELETE FROM schedule_work_type_structures');
        await sequelize.query('DELETE FROM schedule_work_type_divisions');
        console.log('10. schedule_work_type_* 삭제 OK');

        // 11) 작업유형 대분류
        await sequelize.query('DELETE FROM schedule_work_types');
        console.log('11. schedule_work_types 삭제 OK');

        // 12) 구분 ↔ 대상장소 매핑
        await sequelize.query('DELETE FROM schedule_division_structures');
        console.log('12. schedule_division_structures 삭제 OK');

        // 13) 기준
        await sequelize.query('DELETE FROM schedule_bases');
        console.log('13. schedule_bases 삭제 OK');

        // 14) 구분
        await sequelize.query('DELETE FROM schedule_divisions');
        console.log('14. schedule_divisions 삭제 OK');

        await sequelize.query('COMMIT');
        console.log('\n✅ 일정관리 테이블 초기화 완료.');
    } catch (err) {
        await sequelize.query('ROLLBACK').catch(() => {});
        console.error('오류:', err.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
