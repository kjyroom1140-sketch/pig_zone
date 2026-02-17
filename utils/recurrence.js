/**
 * 반복 일정 확장: 규칙 1건 → 기간 내 발생(occurrence) 배열
 * 요일: 0=일, 1=월, ..., 6=토
 */

function parseDate(str) {
    if (!str) return null;
    if (str instanceof Date) return str;
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

function toDateString(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function addDays(d, n) {
    const out = new Date(d);
    out.setDate(out.getDate() + n);
    return out;
}

function addWeeks(d, n) {
    return addDays(d, n * 7);
}

function addMonths(d, n) {
    const out = new Date(d);
    out.setMonth(out.getMonth() + n);
    return out;
}

function addYears(d, n) {
    const out = new Date(d);
    out.setFullYear(out.getFullYear() + n);
    return out;
}

function getDayOfWeek(d) {
    return d.getDay();
}

function isInRange(d, rangeStart, rangeEnd) {
    const t = d.getTime();
    return t >= rangeStart.getTime() && t <= rangeEnd.getTime();
}

/**
 * @param {object} item - schedule_item (plain or Sequelize), recurrenceType, recurrenceStartDate, recurrenceEndDate, recurrenceInterval, recurrenceWeekdays, recurrenceMonthDay
 * @param {Date|string} rangeStart - 조회 기간 시작
 * @param {Date|string} rangeEnd - 조회 기간 끝
 * @returns {Array<{date: string, scheduleItemId: number, ...}>} 발생 목록 (date는 YYYY-MM-DD)
 */
function expandRecurrence(item, rangeStart, rangeEnd) {
    const start = parseDate(rangeStart);
    const end = parseDate(rangeEnd);
    if (!start || !end || start > end) return [];

    const type = (item.recurrenceType || '').toLowerCase();
    if (!type || type === 'none') {
        const single = parseDate(item.recurrenceStartDate) || parseDate(item.createdAt);
        if (!single) return [];
        if (!isInRange(single, start, end)) return [];
        return [{
            date: toDateString(single),
            scheduleItemId: item.id,
            targetType: item.targetType,
            structureTemplateId: item.structureTemplateId,
            structureName: item.structureTemplate?.name,
            taskTypeId: item.taskTypeId,
            taskTypeName: item.taskType?.name,
            description: item.description
        }];
    }

    const interval = Math.max(1, parseInt(item.recurrenceInterval, 10) || 1);
    const recStart = parseDate(item.recurrenceStartDate) || parseDate(item.createdAt) || start;
    const recEnd = item.recurrenceEndDate ? parseDate(item.recurrenceEndDate) : null;
    const effectiveEnd = recEnd && recEnd < end ? recEnd : end;
    if (recStart > effectiveEnd) return [];

    const occurrences = [];
    const push = (d) => {
        const dateStr = toDateString(d);
        if (isInRange(d, start, end)) {
            occurrences.push({
                date: dateStr,
                scheduleItemId: item.id,
                targetType: item.targetType,
                structureTemplateId: item.structureTemplateId,
                structureName: item.structureTemplate?.name,
                taskTypeId: item.taskTypeId,
                taskTypeName: item.taskType?.name,
                description: item.description
            });
        }
    };

    if (type === 'daily') {
        let d = new Date(recStart);
        d.setHours(0, 0, 0, 0);
        const startT = start.getTime();
        const endT = end.getTime();
        while (d.getTime() <= effectiveEnd.getTime()) {
            if (d.getTime() >= startT && d.getTime() <= endT) push(d);
            d = addDays(d, interval);
        }
        return occurrences;
    }

    if (type === 'weekly') {
        const weekdays = (item.recurrenceWeekdays || '')
            .split(',')
            .map(s => parseInt(s.trim(), 10))
            .filter(n => !isNaN(n) && n >= 0 && n <= 6);
        if (weekdays.length === 0) weekdays.push(getDayOfWeek(recStart));

        const startT = start.getTime();
        const endT = effectiveEnd.getTime();
        let weekStart = new Date(recStart);
        weekStart.setHours(0, 0, 0, 0);
        weekStart = addDays(weekStart, -getDayOfWeek(weekStart));
        let weeks = 0;
        while (weekStart.getTime() <= endT + 7 * 24 * 60 * 60 * 1000) {
            if (weeks % interval === 0) {
                for (const wd of weekdays) {
                    const candidate = addDays(weekStart, wd);
                    if (candidate.getTime() >= startT && candidate.getTime() <= endT && candidate.getTime() >= recStart.getTime()) {
                        if (!recEnd || candidate.getTime() <= recEnd.getTime()) push(candidate);
                    }
                }
            }
            weekStart = addWeeks(weekStart, 1);
            weeks++;
        }
        return occurrences.sort((a, b) => a.date.localeCompare(b.date));
    }

    if (type === 'monthly') {
        const dayOfMonth = item.recurrenceMonthDay != null ? parseInt(item.recurrenceMonthDay, 10) : recStart.getDate();
        let d = new Date(recStart.getFullYear(), recStart.getMonth(), Math.min(dayOfMonth, 28));
        d.setHours(0, 0, 0, 0);
        const startT = start.getTime();
        const endT = end.getTime();
        for (let i = 0; i <= (end.getFullYear() - recStart.getFullYear()) * 12 + (end.getMonth() - recStart.getMonth()) + 24; i++) {
            const monthDate = new Date(d.getFullYear(), d.getMonth(), Math.min(dayOfMonth, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
            if (monthDate.getTime() < recStart.getTime()) {
                d = addMonths(d, interval);
                continue;
            }
            if (monthDate.getTime() > endT) break;
            if (recEnd && monthDate.getTime() > recEnd.getTime()) break;
            if (monthDate.getTime() >= startT) push(monthDate);
            d = addMonths(d, interval);
        }
        return occurrences.sort((a, b) => a.date.localeCompare(b.date));
    }

    if (type === 'yearly') {
        let d = new Date(recStart);
        d.setHours(0, 0, 0, 0);
        const startT = start.getTime();
        const endT = end.getTime();
        for (let i = 0; i <= end.getFullYear() - recStart.getFullYear() + 5; i++) {
            const y = addYears(recStart, i * interval);
            if (y.getTime() < startT) continue;
            if (y.getTime() > endT) break;
            if (recEnd && y.getTime() > recEnd.getTime()) break;
            push(y);
        }
        return occurrences.sort((a, b) => a.date.localeCompare(b.date));
    }

    return [];
}

module.exports = { expandRecurrence, toDateString, parseDate };
