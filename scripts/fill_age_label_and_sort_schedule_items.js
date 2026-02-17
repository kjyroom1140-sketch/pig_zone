/**
 * schedule_items 테이블: 누락된 일령(ageLabel) 보정 + 일령별 순서(sortOrder) 정리
 * 실행: node scripts/fill_age_label_and_sort_schedule_items.js
 */
const { sequelize } = require('../config/database');
const { ScheduleItem, StructureTemplate, ScheduleBasisType, ScheduleTaskType } = require('../models');

function formatDayRange(dayMin, dayMax) {
    if (dayMin == null && dayMax == null) return null;
    const min = dayMin != null ? Number(dayMin) : null;
    const max = dayMax != null ? Number(dayMax) : null;
    if (min != null && max != null) {
        if (min === max) return `${min}`;
        return `${min}~${max}`;
    }
    if (min != null) return `${min}`;
    if (max != null) return `${max}`;
    return null;
}

/**
 * 돼지 일정에 대해 기준/대상장소/일수로 일령(ageLabel) 문구 생성
 */
function inferAgeLabel(item) {
    if (item.targetType !== 'pig') return null;
    const basis = (item.basisTypeRef && item.basisTypeRef.name) || '';
    const structureName = (item.structureTemplate && item.structureTemplate.name) || '';
    const dayMin = item.dayMin != null ? item.dayMin : null;
    const dayMax = item.dayMax != null ? item.dayMax : null;
    const range = formatDayRange(dayMin, dayMax);
    if (!range) return null;

    if (basis === '출생일') {
        if (dayMin === dayMax) return `${dayMin}`;
        return `${range}`;
    }
    if (basis === '이유일' && structureName === '자돈사') {
        return `이유 ${range}일`;
    }
    if (basis === '전입일') {
        if (structureName === '자돈사') return `전입 ${range}일`;
        if (structureName === '분만사') return `전입 ${range}일`;
        if (structureName === '임신사') return `전입 ${range}일`;
        if (structureName === '육성사') return `전입 ${range}일`;
        if (structureName === '비육사') return `전입 ${range}일`;
        if (structureName === '후보돈사') return `전입 ${range}일`;
        if (structureName === '교배사') return `전입 ${range}일`;
        if (structureName === '웅돈사') return `전입 ${range}일`;
        return `전입 ${range}일`;
    }
    if (basis === '교배일') {
        return `교배 ${range}일`;
    }
    if (basis === '출산일') {
        return `출산 ${range}일`;
    }
    return null;
}

/**
 * 일령·생애주기 순서용 정렬 키 (작을수록 먼저)
 * 1: 출생일(자돈 일령) 2: 이유일(자돈사) 3: 분만사 전입/출산 4: 교배일 5: 임신사 6: 육성 7: 비육 8: 후보 9: 웅돈 10: 시설
 */
function sortKey(item) {
    const basis = (item.basisTypeRef && item.basisTypeRef.name) || '';
    const structureName = (item.structureTemplate && item.structureTemplate.name) || '';
    const dayMin = item.dayMin != null ? item.dayMin : 0;

    if (item.targetType === 'facility') {
        const facilityOrder = { 분만사: 1, 자돈사: 2, 육성사: 3, 비육사: 4, 후보돈사: 5, 교배사: 6, 임신사: 7, 웅돈사: 8 };
        return (9000 + (facilityOrder[structureName] || 9)) * 10000 + dayMin;
    }

    // 돼지: 생애주기 순서
    if (basis === '출생일' && structureName === '분만사') return 1000 + dayMin;           // 0~21일령
    if (basis === '이유일' && structureName === '자돈사') return 2000 + dayMin;             // 이유 후
    if (structureName === '자돈사' && basis === '전입일') return 3000 + dayMin;
    if (structureName === '육성사') return 4000 + dayMin;
    if (structureName === '비육사') return 5000 + dayMin;
    if (structureName === '후보돈사') return 6000 + dayMin;
    if (basis === '교배일' && structureName === '교배사') return 7000 + dayMin;
    if (structureName === '교배사' && basis === '전입일') return 7100 + dayMin;
    if (structureName === '임신사') return 7200 + dayMin;
    if (structureName === '분만사') {
        if (basis === '출산일') return 7300 + dayMin;
        if (basis === '전입일') return 7400 + dayMin;
    }
    if (structureName === '웅돈사') return 8000 + dayMin;
    return 9999 * 10000 + dayMin;
}

async function run() {
    try {
        await sequelize.authenticate();
        const items = await ScheduleItem.findAll({
            include: [
                { model: StructureTemplate, as: 'structureTemplate', attributes: ['id', 'name'] },
                { model: ScheduleBasisType, as: 'basisTypeRef', attributes: ['id', 'name', 'code'] },
                { model: ScheduleTaskType, as: 'taskType', attributes: ['id', 'name'] }
            ],
            order: [['id', 'ASC']]
        });

        console.log(`\n📋 schedule_items ${items.length}건 조회\n`);

        const updates = [];
        for (const item of items) {
            const newAgeLabel = inferAgeLabel(item);
            const currentAgeLabel = item.ageLabel || null;
            const shouldSetAge = item.targetType === 'pig' && newAgeLabel != null;
            const ageLabelToSave = shouldSetAge ? newAgeLabel : (currentAgeLabel || null);

            updates.push({
                id: item.id,
                ageLabel: ageLabelToSave,
                sortKey: sortKey(item),
                structureName: (item.structureTemplate && item.structureTemplate.name) || '-',
                basis: (item.basisTypeRef && item.basisTypeRef.name) || '-',
                dayMin: item.dayMin,
                dayMax: item.dayMax,
                description: (item.description || '').slice(0, 30)
            });
        }

        // sortOrder = 일령별 순서
        updates.sort((a, b) => a.sortKey - b.sortKey);
        const idToSortOrder = {};
        updates.forEach((u, i) => { idToSortOrder[u.id] = i; });

        let ageLabelCount = 0;
        for (const item of items) {
            const u = updates.find(x => x.id === item.id);
            const newAgeLabel = u ? u.ageLabel : (item.ageLabel || null);
            const newSortOrder = idToSortOrder[item.id] ?? item.sortOrder ?? 0;

            if ((newAgeLabel || '') !== (item.ageLabel || '') && item.targetType === 'pig' && newAgeLabel) ageLabelCount++;

            await item.update({
                ageLabel: newAgeLabel || null,
                sortOrder: newSortOrder
            });
        }

        console.log(`✅ ageLabel 보정 및 sortOrder(일령별) 반영 완료. 일령 보정 ${ageLabelCount}건.\n`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
