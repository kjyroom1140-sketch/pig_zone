/**
 * [ deprecated ] schedule_items.basisType 컬럼은 제거됨.
 * 이 스크립트는 basisType 컬럼이 있던 시절 레거시 데이터를 basisTypeId 로 연결할 때만 사용.
 * 현재는 basisType 컬럼이 없으므로 실행하지 마세요.
 *
 * schedule_items.basisType 컬럼 값을 참고해 schedule_basis_types 에 행 추가 및 basisTypeId 연결
 * 실행: node scripts/seed_basis_types_from_schedule_items.js
 */
const { Op } = require('sequelize');
const { ScheduleItem, ScheduleBasisType } = require('../models');
const { sequelize } = require('../config/database');

// 기준명 → 코드 매핑 (선택)
const NAME_TO_CODE = {
    '전입일': 'ENTRY_DAY',
    '출산일': 'FARROWING_DAY',
    '출생일': 'BIRTH_DAY',
    '이유일': 'WEANING_DAY',
    '교배일': 'MATING_DAY',
    '매일': 'DAILY',
    '주 1회': 'WEEKLY',
    '전입': 'EVENT_ENTRY',
    '종료': 'EVENT_END',
    '출하후': 'EVENT_SHIP'
};

function toCode(name) {
    return NAME_TO_CODE[name] || name.replace(/\s+/g, '_').slice(0, 50) || null;
}

async function run() {
    try {
        await sequelize.authenticate();
        console.log('✅ DB 연결 확인\n');

        // 1) schedule_items 에서 basisType 값만 추출 (중복 제거, null/빈문자 제외)
        const items = await ScheduleItem.findAll({
            attributes: ['id', 'basisType'],
            where: { basisType: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } },
            raw: true
        });
        const distinctNames = [...new Set(items.map(i => (i.basisType || '').trim()).filter(Boolean))];
        console.log(`📌 schedule_items 에서 기준값 ${distinctNames.length}종 발견: ${distinctNames.join(', ')}\n`);

        if (distinctNames.length === 0) {
            console.log('추가할 basisType 값이 없습니다.');
            return;
        }

        // 2) schedule_basis_types 에 없으면 추가 (name 기준 findOrCreate)
        const nameToId = {};
        let order = 0;
        for (const name of distinctNames) {
            const code = toCode(name);
            const [row] = await ScheduleBasisType.findOrCreate({
                where: { name },
                defaults: {
                    code: code || null,
                    name,
                    sortOrder: ++order
                }
            });
            nameToId[name] = row.id;
        }
        console.log(`📋 schedule_basis_types 반영 완료 (${distinctNames.length}건)\n`);

        // 3) schedule_items 의 basisTypeId 업데이트
        let updated = 0;
        for (const item of items) {
            const name = (item.basisType || '').trim();
            const basisTypeId = nameToId[name];
            if (!name || basisTypeId == null) continue;
            await ScheduleItem.update(
                { basisTypeId },
                { where: { id: item.id } }
            );
            updated++;
        }
        console.log(`📅 schedule_items.basisTypeId 연결 완료 (${updated}건)\n`);
        console.log('✅ 완료.');
    } catch (err) {
        console.error('❌ 오류:', err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
