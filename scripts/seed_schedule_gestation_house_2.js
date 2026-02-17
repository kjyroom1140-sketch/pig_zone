/**
 * 임신사 돼지 관리 일정 13건 추가 (전입일/교배일 기준, 교배일 기준 상세)
 * 실행: node scripts/seed_schedule_gestation_house_2.js
 */
const { sequelize } = require('../config/database');
const { ScheduleItem, StructureTemplate, ScheduleBasisType, ScheduleTaskType } = require('../models');

// [ 기준명, dayStart, dayEnd, 작업유형명, 작업내용 ]
const ROWS = [
    ['전입일', '0', '', '이동', '임신사 전입'],
    ['전입일', '0', '', '환경', '온·습도 초기 설정'],
    ['전입일', '7', '', '관찰', '초기 적응·스트레스 확인'],
    ['교배일', '30', '', '사양', '임신 중기 사료량 조정'],
    ['교배일', '35', '40', '관리', 'BCS 1차 평가'],
    ['교배일', '70', '', '예방접종', '대장균 + 클로스트리디움'],
    ['교배일', '70', '80', '관리', 'BCS 2차 평가'],
    ['교배일', '90', '', '예방접종', 'PRRS(농장 선택)'],
    ['교배일', '90', '95', '관찰', '유방·보행 상태 확인'],
    ['교배일', '100', '', '사양', '분만 전 사료량 조절'],
    ['교배일', '104', '', '관찰', '외음부·유성 변화 확인'],
    ['교배일', '105', '', '준비', '분만사 이동 준비'],
    ['교배일', '107', '', '이동', '분만사 이동']
];

function parseDayRange(startStr, endStr) {
    let dayMin = null, dayMax = null;
    if (startStr !== '' && startStr != null) {
        const n = parseInt(String(startStr).trim(), 10);
        if (!Number.isNaN(n)) dayMin = n;
    }
    if (endStr !== '' && endStr != null) {
        const n = parseInt(String(endStr).trim(), 10);
        if (!Number.isNaN(n)) dayMax = n;
    }
    if (dayMin != null && dayMax == null && (endStr === '' || endStr == null)) dayMax = dayMin;
    return { dayMin, dayMax };
}

async function ensureTaskType(name, code) {
    const [row] = await ScheduleTaskType.findOrCreate({
        where: { name },
        defaults: { code: code || name.replace(/\s/g, '_').toUpperCase(), name, sortOrder: 99 }
    });
    return row.id;
}

async function run() {
    try {
        await sequelize.authenticate();

        const structure = await StructureTemplate.findOne({ where: { name: '임신사' } });
        if (!structure) {
            console.error('임신사(structure_templates)가 없습니다.');
            process.exit(1);
        }
        const structureTemplateId = structure.id;

        const basisEntry = await ScheduleBasisType.findOne({ where: { name: '전입일' } });
        const basisMating = await ScheduleBasisType.findOne({ where: { name: '교배일' } });
        if (!basisEntry || !basisMating) {
            console.error('전입일 또는 교배일(schedule_basis_types)이 없습니다.');
            process.exit(1);
        }
        const basisIds = { '전입일': basisEntry.id, '교배일': basisMating.id };

        const taskNames = ['이동', '환경', '관찰', '사양', '관리', '예방접종', '준비'];
        const taskCodes = { '이동': 'MOVE', '환경': 'ENV', '관찰': 'OBSERVE', '사양': 'FEED', '관리': 'MANAGE', '예방접종': 'VACCINE', '준비': 'PREP' };
        const taskIds = {};
        for (const name of taskNames) {
            taskIds[name] = await ensureTaskType(name, taskCodes[name]);
        }

        let maxSort = (await ScheduleItem.max('sortOrder')) || 0;
        let created = 0;

        for (const [basisName, dayStart, dayEnd, taskName, description] of ROWS) {
            const { dayMin, dayMax } = parseDayRange(dayStart, dayEnd);
            const basisTypeId = basisIds[basisName];
            const taskTypeId = taskIds[taskName];
            if (!basisTypeId || !taskTypeId) {
                console.warn(`   건너뜀: 기준=${basisName}, 작업=${taskName}`);
                continue;
            }

            const exists = await ScheduleItem.findOne({
                where: {
                    targetType: 'pig',
                    structureTemplateId,
                    basisTypeId,
                    taskTypeId,
                    dayMin: dayMin ?? null,
                    dayMax: dayMax ?? null,
                    description
                }
            });
            if (exists) {
                console.log(`   이미 존재: ${description}`);
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
                sortOrder: ++maxSort,
                isActive: true
            });
            created++;
        }

        console.log(`\n✅ 임신사 일정 13건 반영 완료. 신규 ${created}건 추가.\n`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
