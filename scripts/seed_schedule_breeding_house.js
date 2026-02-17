/**
 * 교배사 일정 11건 추가 (기준: 전입일/교배일/임신확정/교배 전, 작업: 환경/이동/번식/기록/관리/관찰/검사)
 * 실행: node scripts/seed_schedule_breeding_house.js
 */
const { sequelize } = require('../config/database');
const { ScheduleItem, StructureTemplate, ScheduleBasisType, ScheduleTaskType } = require('../models');
const { Op } = require('sequelize');

// [ 기준명, dayStart, dayEnd, 작업유형명, 작업내용 ]
const ROWS = [
    ['전입일', '0', '', '환경', '온·습도 초기 설정'],
    ['전입일', '0', '', '이동', '교배사 전입'],
    ['전입일', '0', '', '번식', '1차 교배/AI'],
    ['전입일', '0', '', '기록', '정액번호·웅돈ID 기록'],
    ['전입일', '0', '3', '관리', '교배 후 스트레스 최소화'],
    ['전입일', '1', '', '번식', '2차 교배'],
    ['교배일', '7', '14', '관찰', '조기 재발정 확인'],
    ['교배일', '18', '24', '관찰', '재발정 확인'],
    ['교배일', '25', '35', '검사', '임신 확인(초음파 등)'],
    ['임신확정', '0', '3', '이동', '임신사 이동'],
    ['교배 전', '0', '0', '관리', 'PPV·JE 접종 완료 여부 확인']
];

function parseDayRange(startStr, endStr) {
    let dayMin = null, dayMax = null;
    if (startStr !== '' && startStr !== null && startStr !== undefined) {
        const s = String(startStr).trim();
        if (s === '완료') {
            dayMin = 0;
            dayMax = 0;
        } else {
            const n = parseInt(s, 10);
            if (!Number.isNaN(n)) dayMin = n;
        }
    }
    if (endStr !== '' && endStr !== null && endStr !== undefined) {
        const s = String(endStr).trim();
        if (s !== '완료') {
            const n = parseInt(s, 10);
            if (!Number.isNaN(n)) dayMax = n;
        }
    }
    if (dayMin != null && dayMax == null && endStr === '') dayMax = dayMin;
    return { dayMin, dayMax };
}

async function ensureBasisType(name, code, sortOrder) {
    const [row] = await ScheduleBasisType.findOrCreate({
        where: { name },
        defaults: { code: code || name.replace(/\s/g, '_').toUpperCase(), name, sortOrder: sortOrder ?? 99, targetType: 'pig' }
    });
    return row.id;
}

async function ensureTaskType(name, code, sortOrder) {
    const [row] = await ScheduleTaskType.findOrCreate({
        where: { name },
        defaults: { code: code || name.replace(/\s/g, '_').toUpperCase(), name, sortOrder: sortOrder ?? 99 }
    });
    return row.id;
}

async function run() {
    try {
        await sequelize.authenticate();

        const basisNames = ['전입일', '교배일', '임신확정', '교배 전'];
        const basisCodes = { '전입일': 'ENTRY_DAY', '교배일': 'MATING_DAY', '임신확정': 'PREGNANCY_CONFIRMED', '교배 전': 'BEFORE_MATING' };
        const basisOrder = { '전입일': 1, '교배일': 5, '임신확정': 6, '교배 전': 0 };
        const basisIds = {};
        for (const name of basisNames) {
            basisIds[name] = await ensureBasisType(name, basisCodes[name], basisOrder[name]);
        }
        console.log('📌 기준 유형 확인:', basisIds);

        const taskNames = ['환경', '이동', '번식', '기록', '관리', '관찰', '검사'];
        const taskCodes = { '환경': 'ENV', '이동': 'MOVE', '번식': 'BREED', '기록': 'RECORD', '관리': 'MANAGE', '관찰': 'OBSERVE', '검사': 'CHECK' };
        const taskIds = {};
        for (const name of taskNames) {
            taskIds[name] = await ensureTaskType(name, taskCodes[name]);
        }
        console.log('📌 작업 유형 확인:', taskIds);

        const structure = await StructureTemplate.findOne({ where: { name: '교배사' } });
        if (!structure) {
            console.error('교배사(structure_templates)가 없습니다. 시설 템플릿을 먼저 등록하세요.');
            process.exit(1);
        }
        const structureTemplateId = structure.id;
        console.log('📌 대상장소: 교배사 id=', structureTemplateId);

        let maxSort = 0;
        const existing = await ScheduleItem.max('sortOrder');
        if (existing != null) maxSort = existing;

        let created = 0;
        for (let i = 0; i < ROWS.length; i++) {
            const [basisName, dayStart, dayEnd, taskName, description] = ROWS[i];
            const basisTypeId = basisIds[basisName];
            const taskTypeId = taskIds[taskName];
            if (!basisTypeId || !taskTypeId) {
                console.warn(`   [${i + 1}] 건너뜀: 기준=${basisName}, 작업=${taskName}`);
                continue;
            }
            const { dayMin, dayMax } = parseDayRange(dayStart, dayEnd);

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
                console.log(`   [${i + 1}] 이미 존재: ${description}`);
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
                sortOrder: maxSort + 1 + i,
                isActive: true
            });
            created++;
        }
        console.log(`\n✅ 교배사 일정 반영 완료. 신규 ${created}건 추가.\n`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
