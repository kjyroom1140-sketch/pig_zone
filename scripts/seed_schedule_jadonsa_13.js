/**
 * 이미지 자료 기준 — 자돈사 일정 13건을 schedule_items 테이블에 추가
 * - 구분: 돼지(pig), 대상장소: 자돈사, 기준: 전입일/출생일, 작업유형: 이동/환경/관찰/예방접종/관리/준비
 *
 * 실행: node scripts/seed_schedule_jadonsa_13.js
 * (중복 실행 시 동일 데이터가 추가될 수 있음)
 */
const { ScheduleTaskType, ScheduleBasisType, ScheduleItem, StructureTemplate } = require('../models');
const { sequelize } = require('../config/database');

// [ 대상장소명, 기준명, dayMin, dayMax, 작업유형명, 작업내용 ]
const ROWS = [
    ['자돈사', '전입일', 0, 0, '이동', '자돈사 전입'],
    ['자돈사', '전입일', 0, 0, '이동', '군 편성'],
    ['자돈사', '전입일', 0, 0, '환경', '온·습도 초기 세팅'],
    ['자돈사', '전입일', 1, 3, '관찰', '이유 스트레스·설사 관찰'],
    ['자돈사', '출생일', 21, 21, '예방접종', '써코바이러스(PCV2) 2차'],
    ['자돈사', '출생일', 21, 21, '예방접종', '마이코플라즈마 폐렴 2차'],
    ['자돈사', '출생일', 28, 28, '예방접종', '돼지 흉막폐렴(APP)'],
    ['자돈사', '출생일', 35, 35, '예방접종', '돼지 위축성 비염(AR)'],
    ['자돈사', '전입일', 1, 3, '관리', '탈수 자돈 보온·보습'],
    ['자돈사', '출생일', 28, 35, '관리', '이유 후 성장 정체 점검'],
    ['자돈사', '전입일', 14, 14, '관리', '균일도 재평가'],
    ['자돈사', '전입일', 10, 14, '이동', '분군(체중 기준)'],
    ['자돈사', '전입일', 21, 21, '준비', '육성사 전입 준비']
];

async function ensureTaskType(code, name, sortOrder) {
    const [row] = await ScheduleTaskType.findOrCreate({
        where: { code },
        defaults: { name, sortOrder }
    });
    return row.id;
}

async function run() {
    try {
        await sequelize.authenticate();

        const [struct] = await StructureTemplate.findOrCreate({
            where: { name: '자돈사' },
            defaults: { name: '자돈사', category: 'production', description: '일정 대상장소: 자돈사' }
        });
        const structureTemplateId = struct.id;

        const [basisEntry] = await ScheduleBasisType.findOrCreate({
            where: { name: '전입일' },
            defaults: { code: 'ENTRY_DAY', name: '전입일', sortOrder: 1 }
        });
        const [basisBirth] = await ScheduleBasisType.findOrCreate({
            where: { name: '출생일' },
            defaults: { code: 'BIRTH_DAY', name: '출생일', sortOrder: 3 }
        });

        const taskTypes = {};
        for (const [code, name, order] of [
            ['MOVE', '이동', 1],
            ['ENV', '환경', 2],
            ['OBSERVE', '관찰', 3],
            ['VACCINE', '예방접종', 4],
            ['MGMT', '관리', 5],
            ['PREP', '준비', 6]
        ]) {
            taskTypes[name] = await ensureTaskType(code, name, order);
        }

        const basisByName = { '전입일': basisEntry.id, '출생일': basisBirth.id };
        let created = 0;

        for (let i = 0; i < ROWS.length; i++) {
            const [structName, basisName, dayMin, dayMax, taskName, description] = ROWS[i];
            const taskTypeId = taskTypes[taskName];
            const basisTypeId = basisByName[basisName];
            if (!taskTypeId || !basisTypeId) {
                console.warn(`[${i + 1}] 건너뜀: ${taskName} 또는 ${basisName} 없음`);
                continue;
            }

            await ScheduleItem.create({
                targetType: 'pig',
                structureTemplateId,
                basisTypeId,
                dayMin,
                dayMax,
                taskTypeId,
                description,
                sortOrder: i + 1,
                isActive: true
            });
            created++;
        }

        console.log(`자돈사 일정 ${ROWS.length}건 처리, 신규 ${created}건 추가됨.`);
    } catch (err) {
        console.error('시드 실패:', err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
