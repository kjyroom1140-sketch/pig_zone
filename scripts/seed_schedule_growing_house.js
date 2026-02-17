/**
 * 육성사 돼지 관리 일정 12건 추가 (전입일/출생일 기준, 일령 숫자)
 * 실행: node scripts/seed_schedule_growing_house.js
 */
const { sequelize } = require('../config/database');
const { ScheduleItem, StructureTemplate, ScheduleBasisType, ScheduleTaskType } = require('../models');

// [ 대상장소, 기준, dayStart, dayEnd, ageLabel, 작업유형, 작업내용 ]
const ROWS = [
    ['육성사', '전입일', '0', '0', '50~60', '이동', '육성사 전입'],
    ['육성사', '전입일', '0', '0', '', '환경', '온·습도 초기 설정'],
    ['육성사', '전입일', '0', '0', '', '이동', '군 재편성'],
    ['육성사', '전입일', '1', '3', '', '관찰', '이동 스트레스 확인'],
    ['육성사', '전입일', '7', '7', '60~70', '측정', '체중 측정'],
    ['육성사', '출생일', '60', '60', '60', '예방접종', '구제역(FMD)'],
    ['육성사', '출생일', '70', '70', '70', '예방접종', '돼지열병(CSF)'],
    ['육성사', '출생일', '80', '80', '80', '예방접종', '단독/혼합 호흡기 백신'],
    ['육성사', '전입일', '14', '14', '65~75', '관리', '성장 균일도 점검'],
    ['육성사', '전입일', '30', '30', '80~90', '관찰', '증체 속도 확인'],
    ['육성사', '전입일', '45', '45', '95~105', '준비', '비육사 전입 준비'],
    ['육성사', '전입일', '종료', '종료', '100~110', '이동', '비육사 전입']
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
            where: { name: '육성사' },
            defaults: { name: '육성사', category: 'production', description: '일정 대상장소: 육성사' }
        });
        const structureTemplateId = structure.id;

        const basisEntry = await ScheduleBasisType.findOne({ where: { name: '전입일' } });
        const basisBirth = await ScheduleBasisType.findOne({ where: { name: '출생일' } });
        if (!basisEntry || !basisBirth) {
            console.error('전입일 또는 출생일(schedule_basis_types)이 없습니다.');
            process.exit(1);
        }
        const basisIds = { '전입일': basisEntry.id, '출생일': basisBirth.id };

        async function ensureTaskType(name, code) {
            const [row] = await ScheduleTaskType.findOrCreate({
                where: { name },
                defaults: { code: code || name.replace(/\s/g, '_').toUpperCase(), name, sortOrder: 99 }
            });
            return row.id;
        }
        const taskNames = ['이동', '환경', '관찰', '측정', '예방접종', '관리', '준비'];
        const taskCodes = { 이동: 'MOVE', 환경: 'ENV', 관찰: 'OBSERVE', 측정: 'MEASURE', 예방접종: 'VACCINE', 관리: 'MANAGE', 준비: 'PREP' };
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

        console.log(`\n✅ 육성사 일정 12건 반영 완료. 신규 ${created}건 추가.\n`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
