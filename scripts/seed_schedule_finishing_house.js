/**
 * 비육사 돼지 관리 일정 10건 추가 (전입일 기준, 일령 숫자)
 * 실행: node scripts/seed_schedule_finishing_house.js
 */
const { sequelize } = require('../config/database');
const { ScheduleItem, StructureTemplate, ScheduleBasisType, ScheduleTaskType } = require('../models');

// [ 대상장소, 기준, dayStart, dayEnd, ageLabel, 작업유형, 작업내용 ]
const ROWS = [
    ['비육사', '전입일', '0', '0', '100~110', '이동', '비육사 전입'],
    ['비육사', '전입일', '0', '0', '', '환경', '온·습도 초기 설정'],
    ['비육사', '전입일', '0', '0', '', '사양', '비육 사료 전환'],
    ['비육사', '전입일', '0', '1', '', '관리', '이상돈(절음·식욕저하) 선별'],
    ['비육사', '전입일', '1', '3', '', '관찰', '식욕·음수 확인'],
    ['비육사', '전입일', '7', '7', '110~120', '측정', '체중(표본) 측정'],
    ['비육사', '전입일', '30', '30', '130~140', '관찰', '증체 속도 점검'],
    ['비육사', '전입일', '45', '45', '145~155', '선별', '출하 후보 1차 선별'],
    ['비육사', '전입일', '60', '60', '160~170', '선별', '출하 최종 선별'],
    ['비육사', '전입일', '종료', '종료', '170~180', '이동', '출하']
];

function parseDayRange(startStr, endStr) {
    let dayMin = null, dayMax = null;
    const s = String(startStr || '').trim();
    const e = String(endStr || '').trim();
    if (s === '종료') return { dayMin: null, dayMax: null };
    const nMin = parseInt(s, 10);
    if (!Number.isNaN(nMin)) dayMin = nMin;
    if (e !== '' && e !== '종료') {
        const nMax = parseInt(e, 10);
        if (!Number.isNaN(nMax)) dayMax = nMax;
    }
    if (dayMin != null && dayMax == null && e === '') dayMax = dayMin;
    return { dayMin, dayMax };
}

async function run() {
    try {
        await sequelize.authenticate();

        const [structure] = await StructureTemplate.findOrCreate({
            where: { name: '비육사' },
            defaults: { name: '비육사', category: 'production', description: '일정 대상장소: 비육사' }
        });
        const structureTemplateId = structure.id;

        const basisEntry = await ScheduleBasisType.findOne({ where: { name: '전입일' } });
        if (!basisEntry) {
            console.error('전입일(schedule_basis_types)이 없습니다.');
            process.exit(1);
        }
        const basisIds = { '전입일': basisEntry.id };

        async function ensureTaskType(name, code) {
            const [row] = await ScheduleTaskType.findOrCreate({
                where: { name },
                defaults: { code: code || name.replace(/\s/g, '_').toUpperCase(), name, sortOrder: 99 }
            });
            return row.id;
        }
        const taskNames = ['이동', '환경', '사양', '관리', '관찰', '측정', '선별'];
        const taskCodes = { 이동: 'MOVE', 환경: 'ENV', 사양: 'FEED', 관리: 'MANAGE', 관찰: 'OBSERVE', 측정: 'MEASURE', 선별: 'SELECT' };
        const taskIds = {};
        for (const name of taskNames) {
            taskIds[name] = await ensureTaskType(name, taskCodes[name]);
        }

        let maxSort = (await ScheduleItem.max('sortOrder')) || 0;
        let created = 0;

        for (const [structName, basisName, dayStart, dayEnd, ageLabelRaw, taskName, description] of ROWS) {
            const { dayMin, dayMax } = parseDayRange(dayStart, dayEnd);
            const basisTypeId = basisIds[basisName];
            const taskTypeId = taskIds[taskName];
            const ageLabel = (ageLabelRaw || '').trim() || null;
            if (!basisTypeId || !taskTypeId) {
                console.warn(`   건너뜀: ${basisName}, ${taskName}`);
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
                ageLabel,
                dayMin,
                dayMax,
                taskTypeId,
                description,
                sortOrder: ++maxSort,
                isActive: true
            });
            created++;
        }

        console.log(`\n✅ 비육사 일정 10건 반영 완료. 신규 ${created}건 추가.\n`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
