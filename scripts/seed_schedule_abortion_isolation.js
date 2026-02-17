/**
 * 유산일(임신사) + 격리사 전입일 일정 추가
 * - 임신사 유산일 4건: 격리, 위생, 방역, 기록
 * - 격리사 전입일 8건: 관찰, 치료, 판단, 이동
 * 실행: node scripts/seed_schedule_abortion_isolation.js
 */
const { sequelize } = require('../config/database');
const { ScheduleItem, StructureTemplate, ScheduleBasisType, ScheduleTaskType } = require('../models');

// [ 대상장소명, 기준명, dayStart, dayEnd, 작업유형명, 작업내용 ]
const ROWS = [
    ['임신사', '유산일', '0', '', '격리', '격리사 이동'],
    ['임신사', '유산일', '0', '', '위생', '태아·태반 제거'],
    ['임신사', '유산일', '0', '', '방역', '발생 돈방 소독'],
    ['임신사', '유산일', '0', '', '기록', '유산 발생 기록'],
    ['격리사', '전입일', '0', '', '관찰', '체온·식욕·활력 확인'],
    ['격리사', '전입일', '1', '', '관찰', '질 분비물 상태 확인'],
    ['격리사', '전입일', '1', '', '치료', '항생제 투여(수의사 처방)'],
    ['격리사', '전입일', '2', '', '관찰', '자궁염 여부 확인'],
    ['격리사', '전입일', '3', '', '판단', '회복 상태 평가'],
    ['격리사', '전입일', '7', '', '판단', '재번식 가능 여부 판단'],
    ['격리사', '전입일', '7', '14', '관찰', '발정 재개 여부 확인'],
    ['격리사', '전입일', '종료', '', '이동', '교배사 재전입 또는 도태']
];

function parseDayRange(startStr, endStr) {
    let dayMin = null, dayMax = null;
    const s = String(startStr || '').trim();
    const e = String(endStr || '').trim();
    if (s === '종료' || s === '') {
        return { dayMin: null, dayMax: null };
    }
    const nMin = parseInt(s, 10);
    if (!Number.isNaN(nMin)) dayMin = nMin;
    if (e !== '' && e !== '종료') {
        const nMax = parseInt(e, 10);
        if (!Number.isNaN(nMax)) dayMax = nMax;
    }
    if (dayMin != null && dayMax == null && e === '') dayMax = dayMin;
    return { dayMin, dayMax };
}

async function ensureBasisType(name, code) {
    const [row] = await ScheduleBasisType.findOrCreate({
        where: { name },
        defaults: { code: code || name.replace(/\s/g, '_').toUpperCase(), name, sortOrder: 99, targetType: 'pig' }
    });
    return row.id;
}

async function ensureTaskType(name, code) {
    const [row] = await ScheduleTaskType.findOrCreate({
        where: { name },
        defaults: { code: code || name.replace(/\s/g, '_').toUpperCase(), name, sortOrder: 99 }
    });
    return row.id;
}

async function ensureStructure(name) {
    let row = await StructureTemplate.findOne({ where: { name } });
    if (!row) {
        row = await StructureTemplate.create({
            name,
            category: 'production',
            description: name === '격리사' ? '유산·질병 등 격리 관리용 시설' : null
        });
    }
    return row.id;
}

async function run() {
    try {
        await sequelize.authenticate();

        const basisIds = {};
        for (const name of ['유산일', '전입일']) {
            basisIds[name] = await ensureBasisType(name, name === '유산일' ? 'ABORTION_DAY' : 'ENTRY_DAY');
        }

        const taskNames = ['격리', '위생', '방역', '기록', '치료', '판단', '관찰', '이동'];
        const taskCodes = { 격리: 'ISOLATE', 위생: 'HYGIENE', 방역: 'QUARANTINE', 기록: 'RECORD', 치료: 'TREAT', 판단: 'JUDGE', 관찰: 'OBSERVE', 이동: 'MOVE' };
        const taskIds = {};
        for (const name of taskNames) {
            taskIds[name] = await ensureTaskType(name, taskCodes[name]);
        }

        const structureIds = {};
        for (const name of ['임신사', '격리사']) {
            structureIds[name] = await ensureStructure(name);
        }

        let maxSort = (await ScheduleItem.max('sortOrder')) || 0;
        let created = 0;

        for (const [structName, basisName, dayStart, dayEnd, taskName, description] of ROWS) {
            const { dayMin, dayMax } = parseDayRange(dayStart, dayEnd);
            const structureTemplateId = structureIds[structName];
            const basisTypeId = basisIds[basisName];
            const taskTypeId = taskIds[taskName];
            if (!structureTemplateId || !basisTypeId || !taskTypeId) {
                console.warn(`   건너뜀: ${structName}, ${basisName}, ${taskName}`);
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

        console.log(`\n✅ 유산일(임신사) + 격리사 전입일 일정 반영 완료. 신규 ${created}건 추가.\n`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
