/**
 * 분만사 돼지 관리 일정 19건 추가 (교배일/전입일/출산일/출생일/이유일 기준, 일령 포함)
 * 실행: node scripts/seed_schedule_farrowing_house.js
 */
const { sequelize } = require('../config/database');
const { ScheduleItem, StructureTemplate, ScheduleBasisType, ScheduleTaskType } = require('../models');

// [ 대상장소, 기준, dayStart, dayEnd, ageLabel, 작업유형, 작업내용 ]
const ROWS = [
    ['분만사', '교배일', '105', '107', null, '이동', '분만사 전입'],
    ['분만사', '전입일', '0', '', null, '환경', '온·습도 적응 관리'],
    ['분만사', '출산일', '0', '', null, '분만', '분만 진행 확인'],
    ['분만사', '출산일', '0', '', null, '관리', '난산 여부 확인'],
    ['분만사', '출산일', '1', '', null, '관찰', '체온·식욕 확인'],
    ['분만사', '출산일', '1', '3', null, '사양', '사료 점진적 증량'],
    ['분만사', '출산일', '3', '', null, '질병', '유방염·자궁염 확인'],
    ['분만사', '이유일', '0', '', null, '이동', '교배사 이동 준비'],
    ['분만사', '출생일', '0', '', '0', '관리', '호흡 확인'],
    ['분만사', '출생일', '0', '', '0', '환경', '체온 유지(보온등·매트)'],
    ['분만사', '출생일', '0', '', '0', '사양', '초유 섭취 확인'],
    ['분만사', '출생일', '0', '', '0', '위생', '탯줄 소독'],
    ['분만사', '출생일', '1', '', '1', '질병', '철분 주사'],
    ['분만사', '출생일', '3', '', '3', '관리', '꼬리 절단(선택)'],
    ['분만사', '출생일', '5', '', '5', '사양', '음수대 접근 유도'],
    ['분만사', '출생일', '7', '', '7', '예방접종', 'PCV2 1차'],
    ['분만사', '출생일', '10', '', '10', '사양', '크립피드 시작'],
    ['분만사', '출생일', '14', '', '14', '예방접종', '마이코플라즈마 1차'],
    ['분만사', '이유일', '0', '', '21~28', '이동', '자돈사 전입']
];

function parseDayRange(startStr, endStr) {
    let dayMin = null, dayMax = null;
    const s = String(startStr || '').trim();
    const e = String(endStr || '').trim();
    if (s === '') return { dayMin: null, dayMax: null };
    const nMin = parseInt(s, 10);
    if (!Number.isNaN(nMin)) dayMin = nMin;
    if (e !== '') {
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

async function run() {
    try {
        await sequelize.authenticate();

        const structure = await StructureTemplate.findOne({ where: { name: '분만사' } });
        if (!structure) {
            console.error('분만사(structure_templates)가 없습니다.');
            process.exit(1);
        }
        const structureTemplateId = structure.id;

        const basisNames = ['교배일', '전입일', '출산일', '출생일', '이유일'];
        const basisCodes = { 교배일: 'MATING_DAY', 전입일: 'ENTRY_DAY', 출산일: 'FARROWING_DAY', 출생일: 'BIRTH_DAY', 이유일: 'WEANING_DAY' };
        const basisIds = {};
        for (const name of basisNames) {
            basisIds[name] = await ensureBasisType(name, basisCodes[name]);
        }

        const taskNames = ['이동', '환경', '분만', '관리', '관찰', '사양', '질병', '위생', '예방접종'];
        const taskCodes = { 이동: 'MOVE', 환경: 'ENV', 분만: 'FARROW', 관리: 'MANAGE', 관찰: 'OBSERVE', 사양: 'FEED', 질병: 'DISEASE', 위생: 'HYGIENE', 예방접종: 'VACCINE' };
        const taskIds = {};
        for (const name of taskNames) {
            taskIds[name] = await ensureTaskType(name, taskCodes[name]);
        }

        let maxSort = (await ScheduleItem.max('sortOrder')) || 0;
        let created = 0;

        for (const [structName, basisName, dayStart, dayEnd, ageLabel, taskName, description] of ROWS) {
            const { dayMin, dayMax } = parseDayRange(dayStart, dayEnd);
            const basisTypeId = basisIds[basisName];
            const taskTypeId = taskIds[taskName];
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
                ageLabel: ageLabel || null,
                dayMin,
                dayMax,
                taskTypeId,
                description,
                sortOrder: ++maxSort,
                isActive: true
            });
            created++;
        }

        console.log(`\n✅ 분만사 일정 19건 반영 완료. 신규 ${created}건 추가.\n`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
