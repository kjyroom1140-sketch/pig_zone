/**
 * 일정 관리 전용: 농장 구조 + 7일 그리드
 * - 접힌 행: 하위 일정을 묶어 표시
 * - 펼친 행: 부모 행에는 표시 없음, 펼쳐진 자식 행에만 해당 일정 표시
 */
(function () {
    'use strict';

    var currentFarmId = window.dashboardFarmId;
    var dashboardTreeData = [];
    var dashboardExpandedNodes = new Set();
    var scheduleWeekStartDate = null;
    var scheduleItemsList = []; // 레거시 (필요 시 fallback)
    var scheduleWorkPlansList = []; // 그리드 표시 주 데이터 (farm_schedule_work_plans)
    var barnTemplateMap = {}; // barn.id -> structureTemplateId
    var scheduleSearchQuery = ''; // 검색 필터

    function getScheduleWeekStart(d) {
        var date = new Date(d);
        date.setDate(date.getDate() - date.getDay());
        date.setHours(0, 0, 0, 0);
        return date;
    }

    function loadProductionStructures() {
        return fetch('/api/farm-structure/' + currentFarmId + '/production')
            .then(function (res) { return res.ok ? res.json() : []; })
            .catch(function () { return []; });
    }

    function loadScheduleItems() {
        return fetch('/api/farms/' + currentFarmId + '/schedule-items')
            .then(function (res) { return res.ok ? res.json() : []; })
            .catch(function () { return []; });
    }

    function toDateStr(d) {
        var y = d.getFullYear();
        var m = d.getMonth() + 1;
        var day = d.getDate();
        return y + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
    }

    function loadScheduleWorkPlans(fromDate, toDate) {
        var from = toDateStr(fromDate);
        var to = toDateStr(toDate);
        return fetch('/api/farms/' + currentFarmId + '/schedule-work-plans?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to))
            .then(function (res) { return res.ok ? res.json() : []; })
            .catch(function () { return []; });
    }

    function buildBarnTemplateMap(structures) {
        barnTemplateMap = {};
        if (!dashboardTreeData.length || !structures.length) return;
        dashboardTreeData.forEach(function (building) {
            (building.floors || []).forEach(function (floor) {
                (floor.barns || []).forEach(function (barn) {
                    var name = (barn.name || '').trim();
                    var match = structures.filter(function (s) {
                        var sn = (s.name || '').trim();
                        return sn === name || (sn && name.indexOf(sn) >= 0) || (name && sn.indexOf(name) >= 0);
                    })[0];
                    if (match && match.templateId != null) barnTemplateMap[barn.id] = match.templateId;
                });
            });
        });
    }

    function loadDashboardFacilitiesTree() {
        var tbody = document.getElementById('dashboardScheduleGridBody');
        if (!tbody || !currentFarmId) return;
        var weekStart = getScheduleWeekStart(new Date());
        var weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        scheduleWeekStartDate = weekStart;
        Promise.all([
            fetch('/api/farm-facilities/' + currentFarmId + '/tree').then(function (res) {
                if (!res.ok) throw new Error('트리 로드 실패');
                return res.json();
            }),
            loadProductionStructures(),
            loadScheduleWorkPlans(weekStart, weekEnd)
        ]).then(function (results) {
            dashboardTreeData = results[0];
            var structures = results[1];
            scheduleWorkPlansList = results[2] || [];
            dashboardExpandedNodes.clear();
            dashboardTreeData.forEach(function (b) {
                dashboardExpandedNodes.add('building-' + b.id);
                (b.floors || []).forEach(function (f) {
                    dashboardExpandedNodes.add('floor-' + b.id + '-' + f.floorNumber);
                    (f.barns || []).forEach(function (barn) {
                        dashboardExpandedNodes.add('barn-' + barn.id);
                    });
                });
            });
            buildBarnTemplateMap(structures);
            renderScheduleGrid();
            bindSearchInput();
            bindCalendarIcon();
        }).catch(function (err) {
            console.error(err);
            tbody.innerHTML = '<tr><td colspan="8" class="schedule-grid-empty">시설 데이터를 불러오는데 실패했습니다.</td></tr>';
        });
    }

    /** 칸(sections) 배열에서 현재 돼지 두수 합계 */
    function sumSectionPigs(sections) {
        return (sections || []).reduce(function (s, sec) { return s + (sec.currentPigCount || 0); }, 0);
    }
    /** 돈사(barn) 내 전체 두수 */
    function barnTotalPigs(barn) {
        return (barn.rooms || []).reduce(function (s, r) { return s + sumSectionPigs(r.sections); }, 0);
    }
    /** 층(floor) 내 전체 두수 */
    function floorTotalPigs(floor) {
        return (floor.barns || []).reduce(function (s, b) { return s + barnTotalPigs(b); }, 0);
    }
    /** 건물(building) 내 전체 두수 */
    function buildingTotalPigs(building) {
        return (building.floors || []).reduce(function (s, f) { return s + floorTotalPigs(f); }, 0);
    }

    function getFlattenedTreeRows() {
        var rows = [];
        function addBuilding(building) {
            var buildingId = 'building-' + building.id;
            var isExpanded = dashboardExpandedNodes.has(buildingId);
            var totalPigs = buildingTotalPigs(building);
            var statsStr = (building.stats && building.stats.totalBarns || 0) + '돈사, ' + (building.stats && building.stats.totalRooms || 0) + '방, ' + (building.stats && building.stats.totalSections || 0) + '칸, ' + totalPigs + '두';
            var pathLabel = building.name || '동';
            rows.push({
                level: 0,
                type: 'building',
                icon: '📦',
                label: building.name,
                pathLabel: pathLabel,
                stats: '(' + statsStr + ')',
                nodeId: buildingId,
                hasToggle: true,
                isExpanded: isExpanded,
                scopeTemplateIds: [],
                hasPigs: false,
                hasNoPigs: totalPigs === 0,
                roomIds: [],
                sectionIds: []
            });
            var floors = building.floors || [];
            var isSingleFirst = floors.length === 1 && (floors[0].floorNumber === 1 || floors[0].floorNumber == null);
            if (!isExpanded) return;
            if (isSingleFirst && floors[0].barns) {
                floors[0].barns.forEach(function (b) { addBarn(b, 1, pathLabel); });
            } else {
                floors.forEach(function (f) { addFloor(building, f); });
            }
        }
        function addFloor(building, floor) {
            var floorId = 'floor-' + building.id + '-' + floor.floorNumber;
            var isExpanded = dashboardExpandedNodes.has(floorId);
            var barnsInFloor = floor.barns || [];
            var totalR = floor.stats && floor.stats.totalRooms || barnsInFloor.reduce(function (s, b) { return s + (b.stats && b.stats.totalRooms || 0); }, 0);
            var totalS = floor.stats && floor.stats.totalSections || barnsInFloor.reduce(function (s, b) { return s + (b.stats && b.stats.totalSections || 0); }, 0);
            var floorPigs = floorTotalPigs(floor);
            var floorStatsStr = barnsInFloor.length + '동, ' + totalR + '방, ' + totalS + '칸, ' + floorPigs + '두';
            var pathLabel = (building.name || '동') + ' · ' + (floor.floorNumber || 1) + '층';
            rows.push({
                level: 1,
                type: 'floor',
                icon: '🏢',
                label: floor.floorNumber + '층',
                pathLabel: pathLabel,
                stats: '(' + floorStatsStr + ')',
                nodeId: floorId,
                hasToggle: barnsInFloor.length > 0,
                isExpanded: isExpanded,
                scopeTemplateIds: [],
                hasPigs: false,
                hasNoPigs: floorPigs === 0,
                roomIds: [],
                sectionIds: []
            });
            if (isExpanded && barnsInFloor.length) barnsInFloor.forEach(function (b) { addBarn(b, 2, pathLabel); });
        }
        function addBarn(barn, level, pathPrefix) {
            pathPrefix = pathPrefix || '';
            var barnId = 'barn-' + barn.id;
            var isExpanded = dashboardExpandedNodes.has(barnId);
            var hasRooms = barn.rooms && barn.rooms.length > 0;
            var tid = barnTemplateMap[barn.id] != null ? barnTemplateMap[barn.id] : null;
            var barnHasPigs = (barn.rooms || []).some(function (rm) {
                return (rm.sections || []).some(function (sec) {
                    return (sec.currentPigCount != null && sec.currentPigCount > 0);
                });
            });
            var roomIds = (barn.rooms || []).map(function (r) { return r.id; });
            var barnPigs = barnTotalPigs(barn);
            var barnStatsStr = (barn.stats && barn.stats.totalRooms || 0) + '방, ' + (barn.stats && barn.stats.totalSections || 0) + '칸, ' + barnPigs + '두';
            var pathLabel = pathPrefix ? pathPrefix + ' · ' + (barn.name || '돈사') : (barn.name || '돈사');
            rows.push({
                level: level,
                type: 'barn',
                icon: '🐷',
                label: barn.name,
                pathLabel: pathLabel,
                stats: '(' + barnStatsStr + ')',
                nodeId: barnId,
                hasToggle: hasRooms,
                isExpanded: isExpanded,
                scopeTemplateIds: tid != null ? [tid] : [],
                hasPigs: barnHasPigs,
                hasNoPigs: barnPigs === 0,
                roomIds: roomIds,
                sectionIds: []
            });
            if (isExpanded && hasRooms) barn.rooms.forEach(function (r) { addRoom(r, level + 1, tid, pathLabel); });
        }
        function addRoom(room, level, parentBarnTemplateId, pathPrefix) {
            pathPrefix = pathPrefix || '';
            var roomId = 'room-' + room.id;
            var isExpanded = dashboardExpandedNodes.has(roomId);
            var hasSections = room.sections && room.sections.length > 0;
            var roomHasPigs = (room.sections || []).some(function (sec) {
                return (sec.currentPigCount != null && sec.currentPigCount > 0);
            });
            var roomPigs = sumSectionPigs(room.sections);
            var roomStatsStr = (room.sectionCount || 0) + '칸, ' + roomPigs + '두';
            var pathLabel = pathPrefix ? pathPrefix + ' · ' + (room.name || '방') : (room.name || '방');
            rows.push({
                level: level,
                type: 'room',
                icon: '🚪',
                label: room.name,
                pathLabel: pathLabel,
                stats: '(' + roomStatsStr + ')',
                nodeId: roomId,
                hasToggle: hasSections,
                isExpanded: isExpanded,
                scopeTemplateIds: parentBarnTemplateId != null ? [parentBarnTemplateId] : [],
                hasPigs: roomHasPigs,
                hasNoPigs: roomPigs === 0,
                roomId: room.id,
                roomIds: [],
                sectionIds: []
            });
            if (isExpanded && hasSections) room.sections.forEach(function (s) { addSection(s, level + 1, parentBarnTemplateId, room, pathLabel); });
        }
        function addSection(section, level, parentBarnTemplateId, room, pathPrefix) {
            pathPrefix = pathPrefix || '';
            var pigInfo = (section.currentPigCount != null && section.currentPigCount > 0) ? section.currentPigCount + '두' : '0두';
            var extra = [section.averageWeight ? section.averageWeight + 'kg' : '', section.daysOld ? section.daysOld + '일령' : ''].filter(Boolean).join(', ');
            var sectionHasPigs = (section.currentPigCount != null && section.currentPigCount > 0);
            var pathLabel = pathPrefix ? pathPrefix + ' · ' + (section.name || '칸') : (section.name || '칸');
            var sectionEmpty = !sectionHasPigs;
            var sectionDaysOld = section.daysOld != null ? parseInt(section.daysOld, 10) : null;
            if (isNaN(sectionDaysOld)) sectionDaysOld = null;
            rows.push({
                level: level,
                type: 'section',
                icon: '📍',
                label: section.name,
                pathLabel: pathLabel,
                stats: '(' + pigInfo + (extra ? ', ' + extra : '') + ')',
                nodeId: null,
                hasToggle: false,
                scopeTemplateIds: parentBarnTemplateId != null ? [parentBarnTemplateId] : [],
                hasPigs: sectionHasPigs,
                hasNoPigs: sectionEmpty,
                roomId: room ? room.id : null,
                sectionId: section.id,
                roomIds: [],
                sectionIds: [section.id],
                sectionEmpty: sectionEmpty,
                sectionDaysOld: sectionDaysOld
            });
        }
        dashboardTreeData.forEach(addBuilding);
        fillParentScopeTemplateIds(rows);
        fillParentHasPigs(rows);
        fillParentRoomIds(rows);
        return rows;
    }

    function fillParentRoomIds(rows) {
        for (var i = rows.length - 1; i >= 0; i--) {
            var r = rows[i];
            if (r.hasToggle && (r.roomIds.length === 0 && r.sectionIds.length === 0)) {
                var roomIds = [];
                var sectionIds = [];
                for (var j = i + 1; j < rows.length && rows[j].level > r.level; j++) {
                    var c = rows[j];
                    if (c.roomId && roomIds.indexOf(c.roomId) < 0) roomIds.push(c.roomId);
                    (c.roomIds || []).forEach(function (id) { if (roomIds.indexOf(id) < 0) roomIds.push(id); });
                    (c.sectionIds || []).forEach(function (id) { if (sectionIds.indexOf(id) < 0) sectionIds.push(id); });
                }
                r.roomIds = roomIds;
                r.sectionIds = sectionIds;
            }
        }
    }

    function fillParentHasPigs(rows) {
        for (var i = rows.length - 1; i >= 0; i--) {
            var r = rows[i];
            if (r.hasToggle && r.hasPigs === false) {
                var anyChildHasPigs = false;
                for (var j = i + 1; j < rows.length && rows[j].level > r.level; j++) {
                    if (rows[j].hasPigs) {
                        anyChildHasPigs = true;
                        break;
                    }
                }
                r.hasPigs = anyChildHasPigs;
            }
        }
    }

    function fillParentScopeTemplateIds(rows) {
        var set = {};
        for (var i = rows.length - 1; i >= 0; i--) {
            var r = rows[i];
            if (r.hasToggle && r.scopeTemplateIds.length === 0) {
                var collected = [];
                for (var j = i + 1; j < rows.length && rows[j].level > r.level; j++) {
                    (rows[j].scopeTemplateIds || []).forEach(function (tid) {
                        if (collected.indexOf(tid) === -1) collected.push(tid);
                    });
                }
                r.scopeTemplateIds = collected;
            }
        }
    }

    function getItemsForRow(row) {
        if (row.hasToggle && row.isExpanded) return [];
        var ids = row.scopeTemplateIds || [];
        if (ids.length === 0) return [];
        var hasPigs = row.hasPigs === true;
        return scheduleItemsList.filter(function (item) {
            var tid = item.structureTemplateId != null ? item.structureTemplateId : null;
            if (tid == null || ids.indexOf(tid) < 0) return false;
            if (['pig', 'sow', 'boar', 'non_breeding'].indexOf((item.targetType || '').toLowerCase()) >= 0)
                return hasPigs;
            return true;
        });
    }

    function getWorkPlansForRowAndDay(row, dateStr) {
        if (row.hasToggle && row.isExpanded) return [];
        return scheduleWorkPlansList.filter(function (plan) {
            var start = plan.plannedStartDate || '';
            var end = plan.plannedEndDate || '';
            if (dateStr < start || dateStr > end) return false;
            if (row.sectionId && plan.sectionId === row.sectionId) return true;
            if (row.roomId && !row.sectionId && plan.roomId === row.roomId) return true;
            if (row.roomIds && row.roomIds.length && plan.roomId && row.roomIds.indexOf(plan.roomId) >= 0) return true;
            return false;
        });
    }

    function formatWorkPlanCellContent(plans) {
        if (!plans || plans.length === 0) return '';
        var parts = [];
        plans.slice(0, 5).forEach(function (plan) {
            var taskName = (plan.scheduleItem && plan.scheduleItem.taskType && plan.scheduleItem.taskType.name) ? plan.scheduleItem.taskType.name : '작업';
            var done = plan.completedDate ? ' ✓' : '';
            var text = taskName + done;
            if (text.length > 24) text = text.slice(0, 22) + '…';
            if (text) parts.push('<span class="schedule-cell-item">' + escapeHtml(text) + '</span>');
        });
        if (plans.length > 5) parts.push('<span class="schedule-cell-more">+' + (plans.length - 5) + '</span>');
        return '<div class="schedule-cell-items">' + parts.join('') + '</div>';
    }

    function applySearchFilter(rows) {
        var q = (scheduleSearchQuery || '').trim().toLowerCase();
        if (!q) {
            rows.forEach(function (r) { r._hideBySearch = false; });
            return;
        }
        rows.forEach(function (r) {
            var label = (r.label || '').toLowerCase();
            var stats = (r.stats || '').toLowerCase();
            r._matchSearch = label.indexOf(q) >= 0 || stats.indexOf(q) >= 0;
        });
        var parentIndex = [];
        for (var i = 0; i < rows.length; i++) {
            var p = -1;
            for (var j = i - 1; j >= 0; j--) {
                if (rows[j].level < rows[i].level) {
                    p = j;
                    break;
                }
            }
            parentIndex.push(p);
        }
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            var parentVisible = parentIndex[i] >= 0 ? !rows[parentIndex[i]]._hideBySearch && rows[parentIndex[i]].isExpanded : false;
            r._hideBySearch = !r._matchSearch && !parentVisible;
        }
    }

    function bindSearchInput() {
        var input = document.getElementById('scheduleSearchInput');
        if (!input || input._scheduleBound) return;
        input._scheduleBound = true;
        function onSearch() {
            scheduleSearchQuery = input.value;
            renderScheduleGrid();
        }
        input.addEventListener('input', onSearch);
        input.addEventListener('keyup', function (e) {
            if (e.key === 'Escape') {
                input.value = '';
                scheduleSearchQuery = '';
                renderScheduleGrid();
            }
        });
    }

    function getDayType(d) {
        var day = d.getDay();
        var mmdd = (d.getMonth() + 1) + '-' + d.getDate();
        var holidays = {
            '1-1': '설날', '3-1': '삼일절', '5-5': '어린이날', '6-6': '현충일',
            '8-15': '광복절', '10-3': '개천절', '10-9': '한글날', '12-25': '크리스마스'
        };
        return {
            isSunday: day === 0,
            isSaturday: day === 6,
            isHoliday: !!holidays[mmdd]
        };
    }

    function escapeHtml(s) {
        if (s == null) return '';
        var div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    function formatScheduleCellContent(items) {
        if (!items || items.length === 0) return '';
        var parts = [];
        items.slice(0, 5).forEach(function (item) {
            var taskName = (item.taskType && item.taskType.name) ? item.taskType.name : '';
            var desc = (item.description || '').trim();
            var text = taskName + (desc ? ': ' + desc : '');
            if (text.length > 24) text = text.slice(0, 22) + '…';
            if (text) parts.push('<span class="schedule-cell-item">' + escapeHtml(text) + '</span>');
        });
        if (items.length > 5) parts.push('<span class="schedule-cell-more">+' + (items.length - 5) + '</span>');
        return '<div class="schedule-cell-items">' + parts.join('') + '</div>';
    }

    function renderScheduleGrid() {
        var tbody = document.getElementById('dashboardScheduleGridBody');
        if (!tbody) return;
        var dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        if (dashboardTreeData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="schedule-grid-empty">등록된 건물이 없습니다.</td></tr>';
            return;
        }
        if (!scheduleWeekStartDate) scheduleWeekStartDate = getScheduleWeekStart(new Date());
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var todayStr = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
        var dayTypes = [];
        for (var i = 0; i < 7; i++) {
            var d = new Date(scheduleWeekStartDate);
            d.setDate(scheduleWeekStartDate.getDate() + i);
            var dStr = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
            dayTypes.push({ isToday: dStr === todayStr, isSunday: d.getDay() === 0, isSaturday: d.getDay() === 6, isHoliday: getDayType(d).isHoliday });
            var th = document.getElementById('scheduleThDay' + i);
            if (th) {
                th.textContent = (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + dayNames[d.getDay()] + ')';
                th.className = 'schedule-grid-col-day';
                if (dayTypes[i].isToday) th.classList.add('schedule-day-today');
                if (dayTypes[i].isHoliday) th.classList.add('schedule-day-holiday');
                else if (dayTypes[i].isSunday) th.classList.add('schedule-day-sun');
                else if (dayTypes[i].isSaturday) th.classList.add('schedule-day-sat');
                else th.classList.add('schedule-day-weekday');
            }
        }
        var rows = getFlattenedTreeRows();
        applySearchFilter(rows);
        var html = '';
        rows.forEach(function (r) {
            if (r._hideBySearch) return;
            var indent = (r.level * 16) + 'px';
            var toggle = r.hasToggle
                ? '<span class="schedule-grid-toggle" data-node="' + (r.nodeId || '') + '">' + (r.isExpanded ? '▼' : '▶') + '</span>'
                : '<span class="schedule-grid-toggle-placeholder"></span>';
            html += '<tr class="schedule-grid-row schedule-grid-row-' + r.type + '">';
            html += '<td class="schedule-grid-col-structure"><div class="schedule-grid-structure-cell" style="padding-left:' + indent + '">';
            html += toggle + '<span class="schedule-grid-icon">' + r.icon + '</span><span class="schedule-grid-label">' + escapeHtml(r.label) + '</span>';
            html += '<span class="schedule-grid-stats">' + escapeHtml(r.stats) + '</span></div></td>';
            for (var i = 0; i < 7; i++) {
                var d = new Date(scheduleWeekStartDate);
                d.setDate(scheduleWeekStartDate.getDate() + i);
                var dateStr = toDateStr(d);
                var dayPlans = getWorkPlansForRowAndDay(r, dateStr);
                var cellContent = formatWorkPlanCellContent(dayPlans);
                var cls = 'schedule-grid-day-cell' +
                    (dayTypes[i].isToday ? ' schedule-day-today' : '') +
                    (dayTypes[i].isHoliday ? ' schedule-day-holiday' : '') +
                    (dayTypes[i].isSunday && !dayTypes[i].isHoliday ? ' schedule-day-sun' : '') +
                    (dayTypes[i].isSaturday && !dayTypes[i].isHoliday ? ' schedule-day-sat' : '') +
                    (!dayTypes[i].isHoliday && !dayTypes[i].isSunday && !dayTypes[i].isSaturday ? ' schedule-day-weekday' : '');
                var dataRoom = (r.roomId != null) ? String(r.roomId) : '';
                var dataSection = (r.sectionId != null) ? String(r.sectionId) : '';
                var dataLabel = escapeHtml(r.pathLabel || r.label || '');
                var dataScopeIds = (r.scopeTemplateIds && r.scopeTemplateIds.length) ? r.scopeTemplateIds.join(',') : '';
                var dataSectionEmpty = (r.hasNoPigs === true) ? '1' : '0';
                var dataSectionDaysOld = (r.type === 'section' && r.sectionDaysOld != null) ? String(r.sectionDaysOld) : '';
                html += '<td class="' + cls + '" data-date="' + dateStr + '" data-room-id="' + dataRoom + '" data-section-id="' + dataSection + '" data-target-label="' + dataLabel + '" data-scope-template-ids="' + dataScopeIds + '" data-section-empty="' + dataSectionEmpty + '" data-section-days-old="' + dataSectionDaysOld + '">' + cellContent + '</td>';
            }
            html += '</tr>';
        });
        tbody.innerHTML = html;
        tbody.querySelectorAll('.schedule-grid-toggle[data-node]').forEach(function (el) {
            el.onclick = function () {
                var nodeId = this.getAttribute('data-node');
                if (dashboardExpandedNodes.has(nodeId)) dashboardExpandedNodes.delete(nodeId);
                else dashboardExpandedNodes.add(nodeId);
                renderScheduleGrid();
            };
        });
        tbody.querySelectorAll('.schedule-grid-day-cell').forEach(function (td) {
            td.onclick = function (e) {
                e.stopPropagation();
                var dateStr = td.getAttribute('data-date');
                var roomId = td.getAttribute('data-room-id') || '';
                var sectionId = td.getAttribute('data-section-id') || '';
                var targetLabel = td.getAttribute('data-target-label') || '';
                var scopeIdsStr = td.getAttribute('data-scope-template-ids') || '';
                var scopeTemplateIds = scopeIdsStr ? scopeIdsStr.split(',').map(function (s) { return parseInt(s.trim(), 10); }).filter(function (n) { return !isNaN(n); }) : [];
                var sectionEmpty = td.getAttribute('data-section-empty') === '1';
                var sectionDaysOldStr = td.getAttribute('data-section-days-old') || '';
                var sectionDaysOld = sectionDaysOldStr ? parseInt(sectionDaysOldStr, 10) : null;
                if (isNaN(sectionDaysOld)) sectionDaysOld = null;
                openAddWorkPlanModal({ dateStr: dateStr, roomId: roomId, sectionId: sectionId, targetLabel: targetLabel, scopeTemplateIds: scopeTemplateIds, sectionEmpty: sectionEmpty, sectionDaysOld: sectionDaysOld });
            };
        });
    }

    function loadWorkPlansForCurrentWeekAndRender() {
        if (!scheduleWeekStartDate || !currentFarmId) return;
        var weekEnd = new Date(scheduleWeekStartDate);
        weekEnd.setDate(weekEnd.getDate() + 6);
        loadScheduleWorkPlans(scheduleWeekStartDate, weekEnd).then(function (list) {
            scheduleWorkPlansList = list || [];
            renderScheduleGrid();
        });
    }

    function bindScheduleWeekArrows() {
        var prevBtn = document.getElementById('scheduleWeekPrev');
        var nextBtn = document.getElementById('scheduleWeekNext');
        var todayBtn = document.getElementById('scheduleWeekToday');
        if (prevBtn && !prevBtn._bound) {
            prevBtn._bound = true;
            prevBtn.addEventListener('click', function () {
                if (!scheduleWeekStartDate) scheduleWeekStartDate = getScheduleWeekStart(new Date());
                scheduleWeekStartDate.setDate(scheduleWeekStartDate.getDate() - 1);
                loadWorkPlansForCurrentWeekAndRender();
            });
        }
        if (nextBtn && !nextBtn._bound) {
            nextBtn._bound = true;
            nextBtn.addEventListener('click', function () {
                if (!scheduleWeekStartDate) scheduleWeekStartDate = getScheduleWeekStart(new Date());
                scheduleWeekStartDate.setDate(scheduleWeekStartDate.getDate() + 1);
                loadWorkPlansForCurrentWeekAndRender();
            });
        }
        if (todayBtn && !todayBtn._bound) {
            todayBtn._bound = true;
            todayBtn.addEventListener('click', function () {
                scheduleWeekStartDate = getScheduleWeekStart(new Date());
                loadWorkPlansForCurrentWeekAndRender();
            });
        }
    }

    function bindCalendarIcon() {
        var btn = document.getElementById('scheduleCalendarIcon');
        if (!btn || btn._calendarBound) return;
        btn._calendarBound = true;
        btn.addEventListener('click', function () {
            if (!scheduleWeekStartDate) scheduleWeekStartDate = getScheduleWeekStart(new Date());
            var year = scheduleWeekStartDate.getFullYear();
            var month = scheduleWeekStartDate.getMonth();
            var firstDay = new Date(year, month, 1);
            var lastDay = new Date(year, month + 1, 0);
            var startSunday = new Date(firstDay);
            startSunday.setDate(firstDay.getDate() - firstDay.getDay());
            var days = [];
            var d = new Date(startSunday);
            for (var i = 0; i < 42; i++) {
                days.push(new Date(d));
                d.setDate(d.getDate() + 1);
            }
            var monthTitle = (month + 1) + '월 ' + year + '년';
            var weekNames = ['일', '월', '화', '수', '목', '금', '토'];
            var html = '<div class="schedule-month-overlay" id="scheduleMonthOverlay">';
            html += '<div class="schedule-month-modal">';
            html += '<div class="schedule-month-title">' + escapeHtml(monthTitle) + '</div>';
            html += '<div class="schedule-month-close" id="scheduleMonthClose">×</div>';
            html += '<table class="schedule-month-table"><thead><tr>';
            weekNames.forEach(function (w) { html += '<th>' + w + '</th>'; });
            html += '</tr></thead><tbody>';
            for (var row = 0; row < 6; row++) {
                html += '<tr>';
                for (var col = 0; col < 7; col++) {
                    var idx = row * 7 + col;
                    var day = days[idx];
                    var dayNum = day.getDate();
                    var isCurrentMonth = day.getMonth() === month;
                    var cls = 'schedule-month-cell' + (isCurrentMonth ? '' : ' schedule-month-other');
                    var dateStr = day.getFullYear() + '-' + (day.getMonth() + 1) + '-' + day.getDate();
                    html += '<td class="' + cls + '" data-date="' + dateStr + '" title="이 날이 포함된 주로 이동">' + dayNum + '</td>';
                }
                html += '</tr>';
            }
            html += '</tbody></table></div></div>';
            var wrap = document.createElement('div');
            wrap.innerHTML = html;
            document.body.appendChild(wrap.firstElementChild);
            var overlay = document.getElementById('scheduleMonthOverlay');
            function closeMonth() {
                if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }
            document.getElementById('scheduleMonthClose').onclick = closeMonth;
            overlay.onclick = function (e) {
                if (e.target === overlay) closeMonth();
            };
            overlay.querySelectorAll('.schedule-month-cell[data-date]').forEach(function (cell) {
                cell.onclick = function () {
                    var dateStr = this.getAttribute('data-date');
                    if (dateStr) {
                        var parts = dateStr.split('-');
                        var pick = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                        scheduleWeekStartDate = getScheduleWeekStart(pick);
                        loadWorkPlansForCurrentWeekAndRender();
                    }
                    closeMonth();
                };
            });
        });
    }

    var addWorkPlanModalContext = { roomId: '', sectionId: '', scopeTemplateIds: [], sectionEmpty: false, sectionDaysOld: null };
    var addWorkPlanEntryItems = [];
    var addWorkPlanFacilityItems = [];

    function openAddWorkPlanModal(ctx) {
        var modal = document.getElementById('scheduleAddWorkPlanModal');
        var targetLabelEl = document.getElementById('scheduleAddWorkPlanTargetLabel');
        var noPigsNotice = document.getElementById('scheduleAddWorkPlanNoPigsNotice');
        var itemGroup = document.getElementById('scheduleAddWorkPlanItemGroup');
        var noPigsGroup = document.getElementById('scheduleAddWorkPlanNoPigsGroup');
        var startEl = document.getElementById('scheduleAddWorkPlanStart');
        var endEl = document.getElementById('scheduleAddWorkPlanEnd');
        if (!modal || !targetLabelEl || !startEl || !endEl) return;
        addWorkPlanModalContext = {
            roomId: ctx.roomId || '',
            sectionId: ctx.sectionId || '',
            scopeTemplateIds: ctx.scopeTemplateIds || [],
            sectionEmpty: !!ctx.sectionEmpty,
            sectionDaysOld: ctx.sectionDaysOld != null ? parseInt(ctx.sectionDaysOld, 10) : null
        };
        if (isNaN(addWorkPlanModalContext.sectionDaysOld)) addWorkPlanModalContext.sectionDaysOld = null;
        targetLabelEl.textContent = ctx.targetLabel || '(대상 없음)';
        if (noPigsNotice) noPigsNotice.style.display = addWorkPlanModalContext.sectionEmpty ? 'flex' : 'none';
        if (itemGroup) itemGroup.style.display = addWorkPlanModalContext.sectionEmpty ? 'none' : 'block';
        if (noPigsGroup) noPigsGroup.style.display = addWorkPlanModalContext.sectionEmpty ? 'block' : 'none';
        if (addWorkPlanModalContext.sectionEmpty) {
            var kindSel = document.getElementById('scheduleAddWorkPlanKind');
            if (kindSel) { kindSel.value = ''; }
            var entryPanel = document.getElementById('scheduleAddWorkPlanEntryPanel');
            var facilityPanel = document.getElementById('scheduleAddWorkPlanFacilityPanel');
            if (entryPanel) entryPanel.style.display = 'none';
            if (facilityPanel) facilityPanel.style.display = 'none';
            var entrySource = document.getElementById('scheduleAddWorkPlanEntrySource');
            var entryCount = document.getElementById('scheduleAddWorkPlanEntryCount');
            var breedSel = document.getElementById('scheduleAddWorkPlanBreed');
            if (entrySource) entrySource.value = '';
            if (entryCount) entryCount.value = '';
            if (breedSel) breedSel.innerHTML = '<option value="">선택하세요</option>';
            var facilitySel = document.getElementById('scheduleAddWorkPlanFacilityItem');
            if (facilitySel) { facilitySel.innerHTML = '<option value="">선택하세요</option>'; }
            var dateRangeRow = document.getElementById('scheduleAddWorkPlanDateRangeRow');
            var entryDateRow = document.getElementById('scheduleAddWorkPlanEntryDateRow');
            var submitBtn = document.getElementById('scheduleAddWorkPlanSubmit');
            if (dateRangeRow) dateRangeRow.style.display = 'none';
            if (entryDateRow) entryDateRow.style.display = 'none';
            if (submitBtn) submitBtn.textContent = '추가';
        }
        startEl.value = ctx.dateStr || '';
        endEl.value = ctx.dateStr || '';
        var dateRangeRow = document.getElementById('scheduleAddWorkPlanDateRangeRow');
        if (dateRangeRow && !addWorkPlanModalContext.sectionEmpty) dateRangeRow.style.display = 'flex';
        modal.style.display = 'flex';
        loadScheduleItemsForAddModal();
    }

    function closeAddWorkPlanModal() {
        var modal = document.getElementById('scheduleAddWorkPlanModal');
        if (modal) modal.style.display = 'none';
    }

    /** 일정 항목 셀렉트용 라벨: 작업유형 + 구조/기준/일령 등으로 구분해 중복 표기 방지 */
    function formatScheduleItemOptionLabel(item) {
        var taskName = (item.taskType && item.taskType.name) ? item.taskType.name : ('일정 #' + item.id);
        var parts = [];
        if (item.structureTemplate && item.structureTemplate.name)
            parts.push(String(item.structureTemplate.name).trim());
        if (item.basisTypeRef && item.basisTypeRef.name)
            parts.push(String(item.basisTypeRef.name).trim());
        if (item.ageLabel && String(item.ageLabel).trim())
            parts.push(String(item.ageLabel).trim());
        if (item.description && String(item.description).trim()) {
            var desc = String(item.description).trim();
            if (desc.length > 20) desc = desc.slice(0, 18) + '…';
            parts.push(desc);
        }
        if (parts.length) return taskName + ' (' + parts.join(' · ') + ')';
        return taskName;
    }

    function categoryLabelForFacility(code) {
        var map = { facility_management: '시설·관리', facility_environment: '시설·환경', facility_disinfection: '시설·방역' };
        return (code && map[code]) ? map[code] : (code || '시설');
    }

    function formatFacilityItemOptionLabel(item) {
        var cat = (item.taskType && item.taskType.category) ? item.taskType.category : '';
        var catLabel = categoryLabelForFacility(cat);
        var name = (item.taskType && item.taskType.name) ? item.taskType.name : ('일정 #' + item.id);
        return catLabel + ' · ' + name;
    }

    function loadBreedsForEntrySelect() {
        var sel = document.getElementById('scheduleAddWorkPlanBreed');
        if (!sel) return;
        sel.innerHTML = '<option value="">로딩 중...</option>';
        fetch('/api/breeds')
            .then(function (res) { return res.ok ? res.json() : []; })
            .catch(function () { return []; })
            .then(function (breeds) {
                sel.innerHTML = '<option value="">선택하세요</option>';
                (breeds || []).forEach(function (b) {
                    var opt = document.createElement('option');
                    opt.value = (b.nameKo || b.name_ko || b.code || '').trim() || '';
                    opt.textContent = (b.nameKo || b.name_ko || b.code || '품종 #' + (b.id || '')).trim();
                    if (opt.value) sel.appendChild(opt);
                });
            });
    }

    function loadScheduleItemsForAddModal() {
        var sel = document.getElementById('scheduleAddWorkPlanItem');
        var noItems = document.getElementById('scheduleAddWorkPlanNoItems');
        if (!currentFarmId) return;
        var sectionEmpty = addWorkPlanModalContext.sectionEmpty;
        if (sectionEmpty) {
            var noEntryHint = document.getElementById('scheduleAddWorkPlanNoEntryItems');
            var noFacilityHint = document.getElementById('scheduleAddWorkPlanNoFacilityItems');
            var facilitySel = document.getElementById('scheduleAddWorkPlanFacilityItem');
            if (noEntryHint) noEntryHint.style.display = 'none';
            if (noFacilityHint) noFacilityHint.style.display = 'none';
            if (facilitySel) facilitySel.innerHTML = '<option value="">로딩 중...</option>';
        } else {
            if (sel) sel.innerHTML = '<option value="">로딩 중...</option>';
            if (noItems) noItems.style.display = 'none';
        }
        fetch('/api/farms/' + currentFarmId + '/schedule-items')
            .then(function (res) { return res.ok ? res.json() : []; })
            .catch(function () { return []; })
            .then(function (items) {
                var scopeIds = addWorkPlanModalContext.scopeTemplateIds || [];
                if (scopeIds.length > 0) {
                    items = (items || []).filter(function (item) {
                        var tid = item.structureTemplateId != null ? item.structureTemplateId : null;
                        return tid == null || scopeIds.indexOf(tid) >= 0;
                    });
                }
                if (sectionEmpty) {
                    addWorkPlanEntryItems = (items || []).filter(function (item) {
                        var cat = (item.taskType && item.taskType.category) ? item.taskType.category : null;
                        return cat === 'entry';
                    });
                    addWorkPlanFacilityItems = (items || []).filter(function (item) {
                        var cat = (item.taskType && item.taskType.category) ? item.taskType.category : null;
                        return cat === 'facility_management' || cat === 'facility_environment' || cat === 'facility_disinfection';
                    });
                    var noEntryHint = document.getElementById('scheduleAddWorkPlanNoEntryItems');
                    var noFacilityHint = document.getElementById('scheduleAddWorkPlanNoFacilityItems');
                    var facilitySel = document.getElementById('scheduleAddWorkPlanFacilityItem');
                    if (facilitySel) {
                        facilitySel.innerHTML = '';
                        if (addWorkPlanFacilityItems.length === 0) {
                            facilitySel.innerHTML = '<option value="">시설 일정 없음</option>';
                            if (noFacilityHint) noFacilityHint.style.display = 'block';
                        } else {
                            facilitySel.innerHTML = '<option value="">선택하세요</option>';
                            addWorkPlanFacilityItems.forEach(function (item) {
                                var opt = document.createElement('option');
                                opt.value = item.id;
                                opt.textContent = formatFacilityItemOptionLabel(item);
                                facilitySel.appendChild(opt);
                            });
                        }
                    }
                    var kindSel = document.getElementById('scheduleAddWorkPlanKind');
                    if (kindSel && kindSel.value === 'entry') {
                        if (noEntryHint) noEntryHint.style.display = addWorkPlanEntryItems.length === 0 ? 'block' : 'none';
                    }
                    if (kindSel && kindSel.value === 'facility') {
                        if (noFacilityHint) noFacilityHint.style.display = addWorkPlanFacilityItems.length === 0 ? 'block' : 'none';
                    }
                    return;
                }
                if (!items || items.length === 0) {
                    if (sel) sel.innerHTML = '<option value="">일정 없음</option>';
                    if (noItems) noItems.style.display = 'block';
                    return;
                }
                var sectionDaysOld = addWorkPlanModalContext.sectionDaysOld;
                if (sectionDaysOld != null) {
                    items = items.filter(function (item) {
                        var dayMin = item.dayMin != null ? parseInt(item.dayMin, 10) : null;
                        if (dayMin == null) return true;
                        return dayMin <= sectionDaysOld;
                    });
                }
                if (!items || items.length === 0) {
                    if (sel) sel.innerHTML = '<option value="">해당 조건의 일정 없음</option>';
                    if (noItems) noItems.style.display = 'block';
                    return;
                }
                if (sel) {
                    sel.innerHTML = '';
                    items.forEach(function (item) {
                        var opt = document.createElement('option');
                        opt.value = item.id;
                        opt.textContent = formatScheduleItemOptionLabel(item);
                        sel.appendChild(opt);
                    });
                }
            });
    }

    function submitAddWorkPlan() {
        var body = {};
        var plannedStartDate = '';
        var plannedEndDate = '';
        if (addWorkPlanModalContext.sectionEmpty) {
            var kindSel = document.getElementById('scheduleAddWorkPlanKind');
            var kind = kindSel ? kindSel.value : '';
            if (kind === 'entry') {
                var plannedDateEl = document.getElementById('scheduleAddWorkPlanPlannedDate');
                var plannedDate = plannedDateEl ? plannedDateEl.value.trim() : '';
                if (!plannedDate) {
                    alert('전입예정일을 선택해 주세요.');
                    return;
                }
                plannedStartDate = plannedDate;
                plannedEndDate = plannedDate;
                var completedCheck = document.getElementById('scheduleAddWorkPlanCompletedCheck');
                if (completedCheck && completedCheck.checked) body.completedDate = plannedDate;
            } else {
                var startEl = document.getElementById('scheduleAddWorkPlanStart');
                var endEl = document.getElementById('scheduleAddWorkPlanEnd');
                plannedStartDate = startEl ? startEl.value.trim() : '';
                plannedEndDate = endEl ? endEl.value.trim() : '';
            }
        } else {
            var startEl = document.getElementById('scheduleAddWorkPlanStart');
            var endEl = document.getElementById('scheduleAddWorkPlanEnd');
            plannedStartDate = startEl ? startEl.value.trim() : '';
            plannedEndDate = endEl ? endEl.value.trim() : '';
        }
        if (!plannedStartDate || !plannedEndDate) {
            alert('예정 시작일과 종료일을 선택해 주세요.');
            return;
        }
        if (plannedStartDate > plannedEndDate) {
            alert('예정 시작일이 종료일보다 늦을 수 없습니다.');
            return;
        }
        body.plannedStartDate = plannedStartDate;
        body.plannedEndDate = plannedEndDate;
        var farmScheduleItemId = null;
        if (addWorkPlanModalContext.sectionEmpty) {
            var kindSel = document.getElementById('scheduleAddWorkPlanKind');
            var kind = kindSel ? kindSel.value : '';
            if (kind !== 'entry' && kind !== 'facility') {
                alert('구분에서 전입 또는 시설을 선택해 주세요.');
                return;
            }
            if (kind === 'entry') {
                var entrySource = document.getElementById('scheduleAddWorkPlanEntrySource');
                var entryCountEl = document.getElementById('scheduleAddWorkPlanEntryCount');
                var entrySourceVal = entrySource ? entrySource.value.trim() : '';
                var entryCountVal = entryCountEl ? entryCountEl.value.trim() : '';
                if (!entrySourceVal) {
                    alert('전입처를 입력해 주세요.');
                    return;
                }
                if (!entryCountVal || parseInt(entryCountVal, 10) < 1) {
                    alert('전입 두수를 입력해 주세요 (1 이상).');
                    return;
                }
                if (addWorkPlanEntryItems.length > 0) {
                    farmScheduleItemId = addWorkPlanEntryItems[0].id;
                }
                if (farmScheduleItemId != null) body.farmScheduleItemId = farmScheduleItemId;
                body.entrySource = entrySourceVal;
                body.entryCount = parseInt(entryCountVal, 10);
                body.plannedDate = plannedStartDate;
                var breedSel = document.getElementById('scheduleAddWorkPlanBreed');
                var breedVal = breedSel ? (breedSel.value || '').trim() : '';
                if (breedVal) body.breedType = breedVal;
            } else {
                var facilitySel = document.getElementById('scheduleAddWorkPlanFacilityItem');
                var facilityVal = facilitySel ? facilitySel.value : '';
                if (!facilityVal || addWorkPlanFacilityItems.length === 0) {
                    alert('시설 작업을 선택해 주세요.');
                    return;
                }
                body.farmScheduleItemId = parseInt(facilityVal, 10);
            }
        } else {
            var sel = document.getElementById('scheduleAddWorkPlanItem');
            farmScheduleItemId = sel ? sel.value : '';
            if (!farmScheduleItemId) {
                alert('일정(작업)을 선택해 주세요.');
                return;
            }
            body.farmScheduleItemId = parseInt(farmScheduleItemId, 10);
        }
        if (addWorkPlanModalContext.roomId) body.roomId = addWorkPlanModalContext.roomId;
        if (addWorkPlanModalContext.sectionId) body.sectionId = addWorkPlanModalContext.sectionId;
        fetch('/api/farms/' + currentFarmId + '/schedule-work-plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })
            .then(function (res) {
                if (res.ok) return res.json();
                return res.json().then(function (j) { throw new Error(j.error || j.message || '작업 추가 실패'); });
            })
            .then(function () {
                closeAddWorkPlanModal();
                loadWorkPlansForCurrentWeekAndRender();
            })
            .catch(function (err) {
                alert(err.message || '작업 추가에 실패했습니다.');
            });
    }

    function bindAddWorkPlanModal() {
        var modal = document.getElementById('scheduleAddWorkPlanModal');
        if (!modal) return;
        var closeBtn = document.getElementById('scheduleAddWorkPlanModalClose');
        var cancelBtn = document.getElementById('scheduleAddWorkPlanCancel');
        var submitBtn = document.getElementById('scheduleAddWorkPlanSubmit');
        function close() { closeAddWorkPlanModal(); }
        modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
        if (closeBtn) closeBtn.addEventListener('click', close);
        if (cancelBtn) cancelBtn.addEventListener('click', close);
        if (submitBtn) submitBtn.addEventListener('click', submitAddWorkPlan);
        var kindSel = document.getElementById('scheduleAddWorkPlanKind');
        if (kindSel) {
            kindSel.addEventListener('change', function () {
                var kind = kindSel.value;
                var entryPanel = document.getElementById('scheduleAddWorkPlanEntryPanel');
                var facilityPanel = document.getElementById('scheduleAddWorkPlanFacilityPanel');
                var noEntryHint = document.getElementById('scheduleAddWorkPlanNoEntryItems');
                var noFacilityHint = document.getElementById('scheduleAddWorkPlanNoFacilityItems');
                var dateRangeRow = document.getElementById('scheduleAddWorkPlanDateRangeRow');
                var entryDateRow = document.getElementById('scheduleAddWorkPlanEntryDateRow');
                var submitBtn = document.getElementById('scheduleAddWorkPlanSubmit');
                var startEl = document.getElementById('scheduleAddWorkPlanStart');
                var plannedDateEl = document.getElementById('scheduleAddWorkPlanPlannedDate');
                var completedCheck = document.getElementById('scheduleAddWorkPlanCompletedCheck');
                if (kind === 'entry') {
                    if (entryPanel) entryPanel.style.display = 'block';
                    if (facilityPanel) facilityPanel.style.display = 'none';
                    if (noEntryHint) noEntryHint.style.display = addWorkPlanEntryItems.length === 0 ? 'block' : 'none';
                    if (noFacilityHint) noFacilityHint.style.display = 'none';
                    if (dateRangeRow) dateRangeRow.style.display = 'none';
                    if (entryDateRow) entryDateRow.style.display = 'block';
                    if (submitBtn) submitBtn.textContent = '저장';
                    if (plannedDateEl && startEl) plannedDateEl.value = startEl.value || '';
                    if (completedCheck) completedCheck.checked = false;
                    var plannedDateLabel = document.getElementById('scheduleAddWorkPlanPlannedDateLabel');
                    if (plannedDateLabel) plannedDateLabel.textContent = '전입예정일 *';
                    loadBreedsForEntrySelect();
                } else if (kind === 'facility') {
                    if (entryPanel) entryPanel.style.display = 'none';
                    if (facilityPanel) facilityPanel.style.display = 'block';
                    if (noEntryHint) noEntryHint.style.display = 'none';
                    if (noFacilityHint) noFacilityHint.style.display = addWorkPlanFacilityItems.length === 0 ? 'block' : 'none';
                    if (dateRangeRow) dateRangeRow.style.display = 'flex';
                    if (entryDateRow) entryDateRow.style.display = 'none';
                    if (submitBtn) submitBtn.textContent = '추가';
                } else {
                    if (entryPanel) entryPanel.style.display = 'none';
                    if (facilityPanel) facilityPanel.style.display = 'none';
                    if (noEntryHint) noEntryHint.style.display = 'none';
                    if (noFacilityHint) noFacilityHint.style.display = 'none';
                    if (dateRangeRow) dateRangeRow.style.display = 'flex';
                    if (entryDateRow) entryDateRow.style.display = 'none';
                    if (submitBtn) submitBtn.textContent = '추가';
                }
            });
        }
        var completedCheck = document.getElementById('scheduleAddWorkPlanCompletedCheck');
        var plannedDateLabel = document.getElementById('scheduleAddWorkPlanPlannedDateLabel');
        if (completedCheck && plannedDateLabel) {
            completedCheck.addEventListener('change', function () {
                plannedDateLabel.textContent = this.checked ? '전입일 *' : '전입예정일 *';
            });
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        currentFarmId = window.dashboardFarmId || new URLSearchParams(window.location.search).get('farmId');
        if (!currentFarmId) return;
        scheduleWeekStartDate = getScheduleWeekStart(new Date());
        loadDashboardFacilitiesTree();
        bindScheduleWeekArrows();
        bindSearchInput();
        bindAddWorkPlanModal();
    });
})();
