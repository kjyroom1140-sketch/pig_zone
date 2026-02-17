(function () {
    'use strict';

    function escapeHtml(str) {
        if (str == null) return '';
        const s = String(str);
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    let farmScheduleItems = [];
    let farmProductionStructures = [];
    let scheduleTaskTypes = [];
    let scheduleBasisTypes = [];
    const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];

    function isPigTargetType(t) { return ['sow', 'boar', 'non_breeding', 'pig'].indexOf(t) >= 0; }
    function isFacilityTargetType(t) { return t === 'facility'; }
    function scheduleTargetTypeLabel(v) { return (v === 'sow' ? '모돈' : v === 'boar' ? '옹돈' : v === 'non_breeding' ? '비번식돈' : v === 'facility' ? '시설' : v === 'pig' ? '비번식돈' : (v || '-')); }

    function getFarmId() {
        return typeof currentFarmId !== 'undefined' ? currentFarmId : null;
    }

    async function loadFarmScheduleFilters() {
        const farmId = getFarmId();
        if (!farmId) return;
        try {
            const [structRes, taskRes, basisRes] = await Promise.all([
                fetch(`/api/farm-structure/${farmId}/production`),
                fetch(`/api/farms/${farmId}/schedule-task-types`),
                fetch(`/api/farms/${farmId}/schedule-basis-types`)
            ]);
            if (structRes.ok) farmProductionStructures = await structRes.json();
            if (taskRes.ok) scheduleTaskTypes = await taskRes.json();
            if (basisRes.ok) scheduleBasisTypes = await basisRes.json();

            const selStructure = document.getElementById('farmScheduleFilterStructure');
            const selBasis = document.getElementById('farmScheduleFilterBasisType');
            const selTask = document.getElementById('farmScheduleFilterTaskType');
            if (selStructure) {
                selStructure.innerHTML = '<option value="">전체</option>' + (farmProductionStructures || []).map(s => `<option value="${s.templateId}">${escapeHtml(s.name)}</option>`).join('');
            }
            if (selBasis) {
                selBasis.innerHTML = '<option value="">전체</option>' + (scheduleBasisTypes || []).map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
            }
            if (selTask) {
                selTask.innerHTML = '<option value="">전체</option>' + (scheduleTaskTypes || []).map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
            }
        } catch (e) {
            console.error('필터 로드 오류:', e);
        }
    }

    window.loadFarmScheduleItems = async function () {
        const farmId = getFarmId();
        const tbody = document.getElementById('farmScheduleItemsBody');
        if (!tbody || !farmId) return;

        await loadFarmScheduleFilters();
        tbody.innerHTML = '<tr><td colspan="12" class="loading">데이터를 불러오는 중...</td></tr>';

        const targetType = document.getElementById('farmScheduleFilterTargetType')?.value || '';
        const structureTemplateId = document.getElementById('farmScheduleFilterStructure')?.value || '';
        const basisTypeId = document.getElementById('farmScheduleFilterBasisType')?.value || '';
        const taskTypeId = document.getElementById('farmScheduleFilterTaskType')?.value || '';
        const params = new URLSearchParams();
        if (targetType) params.set('targetType', targetType);
        if (structureTemplateId) params.set('structureTemplateId', structureTemplateId);
        if (basisTypeId) params.set('basisTypeId', basisTypeId);
        if (taskTypeId) params.set('taskTypeId', taskTypeId);

        try {
            const url = `/api/farms/${farmId}/schedule-items` + (params.toString() ? '?' + params.toString() : '');
            const res = await fetch(url);
            if (!res.ok) throw new Error('농장 일정 목록 조회 실패');
            farmScheduleItems = await res.json();

            const targetLabel = scheduleTargetTypeLabel;
            const formatRecurrenceTypeLabel = (s) => {
                if (!isFacilityTargetType(s.targetType)) return '-';
                const t = (s.recurrenceType || '').toLowerCase();
                if (!t || t === 'none') return '반복 없음';
                if (t === 'daily') return '매일';
                if (t === 'weekly') return '매주';
                if (t === 'monthly') return '매월';
                if (t === 'yearly') return '매년';
                return '반복';
            };
            const formatRecurrenceIntervalLabel = (s) => {
                if (!isFacilityTargetType(s.targetType) || !(s.recurrenceType || '').trim()) return '-';
                const t = (s.recurrenceType || '').toLowerCase();
                if (!t || t === 'none') return '-';
                if (t === 'weekly') {
                    const wd = (s.recurrenceWeekdays || '').split(',').map(x => parseInt(x.trim(), 10)).filter(n => !isNaN(n) && n >= 0 && n <= 6);
                    if (wd.length === 0) return '-';
                    return wd.sort((a, b) => a - b).map(n => weekdayNames[n]).join('·');
                }
                if (t === 'monthly') return s.recurrenceMonthDay != null ? s.recurrenceMonthDay + '일' : '-';
                return String(s.recurrenceInterval != null ? s.recurrenceInterval : 1);
            };
            const basisDisplay = (s) => {
                const isFacility = isFacilityTargetType(s.targetType);
                if (!isFacility) return (s.basisTypeRef && s.basisTypeRef.name) || '-';
                return s.basisTypeRef?.name || formatRecurrenceTypeLabel(s) || '-';
            };

            if (farmScheduleItems.length === 0) {
                tbody.innerHTML = '<tr><td colspan="12" class="text-muted">조건에 맞는 일정이 없습니다.</td></tr>' +
                    '<tr class="schedule-insert-row" data-insert-index="0"><td class="schedule-insert-cell"><button type="button" class="schedule-insert-btn" title="이 위치에 일정 추가">+</button></td><td colspan="11" class="schedule-insert-spacer"></td></tr>';
            } else {
                const sorted = [...farmScheduleItems].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                const rows = [];
                for (let i = 0; i < sorted.length; i++) {
                    const structureId = sorted[i].structureTemplateId != null ? String(sorted[i].structureTemplateId) : '';
                    rows.push(`<tr class="schedule-insert-row" data-insert-index="${i}" data-insert-structure-id="${structureId}"><td class="schedule-insert-cell"><button type="button" class="schedule-insert-btn" title="이 위치에 일정 추가">+</button></td><td colspan="11" class="schedule-insert-spacer"></td></tr>`);
                    const s = sorted[i];
                    const place = s.structureTemplate ? s.structureTemplate.name : '-';
                    const isFacility = isFacilityTargetType(s.targetType);
                    const basis = basisDisplay(s);
                    const dayMinStr = isFacility ? '-' : (s.dayMin != null ? s.dayMin : '-');
                    const dayMaxStr = isFacility ? '-' : (s.dayMax != null ? s.dayMax : '-');
                    const recurrenceIntervalLabel = formatRecurrenceIntervalLabel(s);
                    const task = s.taskType ? s.taskType.name : '-';
                    const isMove = s.taskType && s.taskType.name === '이동';
                    const rowClass = 'clickable-row' + (isMove ? ' schedule-row-move' : '') + (isFacility ? ' schedule-row-facility' : '');
                    rows.push(`
                    <tr class="${rowClass}" data-farm-schedule-item-id="${s.id}" style="cursor: pointer;">
                        <td onclick="event.stopPropagation()"><input type="checkbox" class="farm-schedule-item-cb" value="${s.id}"></td>
                        <td>${s.sortOrder != null ? s.sortOrder : 0}</td>
                        <td onclick="event.stopPropagation()"><span class="schedule-drag-handle" draggable="true" title="드래그하여 순서 변경">≡</span></td>
                        <td>${targetLabel(s.targetType)}</td>
                        <td>${escapeHtml(place)}</td>
                        <td>${escapeHtml(basis)}</td>
                        <td>${escapeHtml(isFacility ? '' : (s.ageLabel || ''))}</td>
                        <td>${escapeHtml(String(dayMinStr))}</td>
                        <td>${escapeHtml(String(dayMaxStr))}</td>
                        <td>${escapeHtml(recurrenceIntervalLabel)}</td>
                        <td>${escapeHtml(task)}</td>
                        <td>${escapeHtml((s.description || '').slice(0, 40))}${(s.description || '').length > 40 ? '…' : ''}</td>
                    </tr>
                    `);
                }
                const lastStructureId = sorted.length > 0 && sorted[sorted.length - 1].structureTemplateId != null ? String(sorted[sorted.length - 1].structureTemplateId) : '';
                rows.push(`<tr class="schedule-insert-row" data-insert-index="${sorted.length}" data-insert-structure-id="${lastStructureId}"><td class="schedule-insert-cell"><button type="button" class="schedule-insert-btn" title="이 위치에 일정 추가">+</button></td><td colspan="11" class="schedule-insert-spacer"></td></tr>`);
                tbody.innerHTML = rows.join('');
            }

            tbody.querySelectorAll('.schedule-insert-btn').forEach(btn => {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const row = this.closest('tr.schedule-insert-row');
                    const idx = row ? parseInt(row.getAttribute('data-insert-index'), 10) : null;
                    const structureId = row ? row.getAttribute('data-insert-structure-id') : null;
                    openFarmScheduleItemModal(null, idx, structureId || null);
                });
            });

            tbody.querySelectorAll('tr[data-farm-schedule-item-id]').forEach(tr => {
                tr.addEventListener('click', function (e) {
                    if (e.target.type === 'checkbox') return;
                    if (e.target.closest('.schedule-drag-handle')) return;
                    if (window._farmScheduleSortJustEnded) {
                        window._farmScheduleSortJustEnded = false;
                        return;
                    }
                    const id = parseInt(this.getAttribute('data-farm-schedule-item-id'), 10);
                    openFarmScheduleItemModal(id);
                });
                const handle = tr.querySelector('.schedule-drag-handle');
                if (handle) {
                    handle.addEventListener('mousedown', function (e) { e.stopPropagation(); });
                    handle.addEventListener('dragstart', function (e) {
                        e.dataTransfer.setData('text/plain', String(tr.getAttribute('data-farm-schedule-item-id')));
                        e.dataTransfer.effectAllowed = 'move';
                        tr.classList.add('dragging');
                    });
                    handle.addEventListener('dragend', function () {
                        tr.classList.remove('dragging');
                        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-before', 'drag-over-after'));
                        window._farmScheduleSortJustEnded = true;
                        setTimeout(function () { window._farmScheduleSortJustEnded = false; }, 200);
                    });
                }
                tr.addEventListener('dragover', function (e) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    const id = tr.getAttribute('data-farm-schedule-item-id');
                    const draggedId = e.dataTransfer.getData('text/plain');
                    if (id === draggedId) return;
                    const rect = tr.getBoundingClientRect();
                    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-before', 'drag-over-after'));
                    tr.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drag-over-before' : 'drag-over-after');
                });
                tr.addEventListener('dragleave', function () { tr.classList.remove('drag-over-before', 'drag-over-after'); });
                tr.addEventListener('drop', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-before', 'drag-over-after'));
                    const draggedId = parseInt(e.dataTransfer.getData('text/plain'), 10);
                    const dropId = parseInt(tr.getAttribute('data-farm-schedule-item-id'), 10);
                    if (draggedId === dropId) return;
                    const insertBefore = e.clientY < tr.getBoundingClientRect().top + tr.getBoundingClientRect().height / 2;
                    reorderFarmScheduleItems(draggedId, dropId, insertBefore);
                });
            });

            const checkAll = document.getElementById('farmScheduleItemCheckAll');
            if (checkAll) checkAll.checked = false;
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="12" class="error">' + escapeHtml(e.message) + '</td></tr>';
        }
    };

    async function reorderFarmScheduleItems(draggedId, dropTargetId, insertBefore) {
        const farmId = getFarmId();
        if (!farmId) return;
        const sorted = [...farmScheduleItems].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const fromIndex = sorted.findIndex(s => s.id === draggedId);
        const toIndex = sorted.findIndex(s => s.id === dropTargetId);
        if (fromIndex === -1 || toIndex === -1) return;
        const item = sorted.splice(fromIndex, 1)[0];
        let insertAt = insertBefore ? toIndex : toIndex + 1;
        if (fromIndex < insertAt) insertAt--;
        sorted.splice(insertAt, 0, item);
        try {
            for (let i = 0; i < sorted.length; i++) {
                const s = sorted[i];
                const res = await fetch(`/api/farms/${farmId}/schedule-items/${s.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        targetType: s.targetType,
                        structureTemplateId: s.structureTemplateId,
                        basisTypeId: s.basisTypeId,
                        ageLabel: s.ageLabel ?? null,
                        dayMin: s.dayMin,
                        dayMax: s.dayMax,
                        taskTypeId: s.taskTypeId,
                        description: s.description,
                        sortOrder: i,
                        isActive: s.isActive !== false
                    })
                });
                if (!res.ok) throw new Error('순서 저장 실패');
            }
            loadFarmScheduleItems();
        } catch (err) {
            alert(err.message);
        }
    }

    window.farmScheduleToggleCheckAll = function (checkbox) {
        document.querySelectorAll('.farm-schedule-item-cb').forEach(cb => { cb.checked = checkbox.checked; });
    };

    window.farmScheduleDeleteSelected = async function () {
        const farmId = getFarmId();
        if (!farmId) return;
        const ids = Array.from(document.querySelectorAll('.farm-schedule-item-cb:checked')).map(cb => parseInt(cb.value, 10));
        if (ids.length === 0) {
            alert('삭제할 항목을 선택하세요.');
            return;
        }
        if (!confirm(`선택한 ${ids.length}건을 삭제하시겠습니까?`)) return;
        try {
            for (const id of ids) {
                const res = await fetch(`/api/farms/${farmId}/schedule-items/${id}`, { method: 'DELETE' });
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || '삭제 실패');
                }
            }
            alert('삭제되었습니다.');
            loadFarmScheduleItems();
        } catch (e) {
            alert(e.message);
        }
    };

    function fillFarmScheduleItemStructureOptions() {
        const sel = document.getElementById('farmScheduleItemStructureTemplateId');
        if (!sel) return;
        sel.innerHTML = '<option value="">선택 안 함</option>' + (farmProductionStructures || []).map(s => `<option value="${s.templateId}">${escapeHtml(s.name)}</option>`).join('');
    }

    function fillFarmScheduleItemBasisOptions(targetType) {
        const sel = document.getElementById('farmScheduleItemBasisTypeId');
        if (!sel || !scheduleBasisTypes) return;
        const filtered = scheduleBasisTypes.filter(b =>
            b.targetType === targetType || !b.targetType || (b.targetType === 'pig' && isPigTargetType(targetType))
        );
        sel.innerHTML = '<option value="">선택 안 함</option>' + filtered.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
    }

    function fillFarmScheduleItemTaskTypeOptions() {
        fillFarmScheduleItemTaskTypeOptionsFromFilter(document.getElementById('farmScheduleItemStructureTemplateId')?.value || '');
    }

    function syncFarmScheduleItemModalToTargetType() {
        const targetType = document.getElementById('farmScheduleItemTargetType')?.value || 'non_breeding';
        const isFacility = isFacilityTargetType(targetType);
        const basisGroup = document.getElementById('farmScheduleItemBasisGroup');
        const ageGroup = document.getElementById('farmScheduleItemAgeLabelGroup');
        const dayGroup = document.getElementById('farmScheduleItemDayRangeGroup');
        const recurGroup = document.getElementById('farmScheduleItemRecurrenceGroup');
        if (basisGroup) basisGroup.style.display = isFacility ? 'none' : 'block';
        if (ageGroup) ageGroup.style.display = isFacility ? 'none' : 'block';
        if (dayGroup) dayGroup.style.display = isFacility ? 'none' : 'block';
        if (recurGroup) recurGroup.style.display = isFacility ? 'block' : 'none';
        fillFarmScheduleItemBasisOptions(targetType);
    }

    window.openFarmScheduleItemModal = async function (id, insertIndex, structureId) {
        const farmId = getFarmId();
        if (!farmId) {
            alert('농장을 선택해 주세요.');
            return;
        }
        const modal = document.getElementById('farmScheduleItemModal');
        const title = document.getElementById('farmScheduleItemModalTitle');
        const form = document.getElementById('farmScheduleItemForm');
        const deleteBtn = document.getElementById('farmScheduleItemModalDeleteBtn');
        if (!modal || !form) return;

        form.reset();
        document.getElementById('farmScheduleItemId').value = id ? String(id) : '';
        fillFarmScheduleItemStructureOptions();
        syncFarmScheduleItemModalToTargetType();

        if (id) {
            const s = farmScheduleItems.find(x => x.id === id);
            if (!s) return;
            title.textContent = '일정 수정';
            document.getElementById('farmScheduleItemTargetType').value = (s.targetType === 'pig' ? 'non_breeding' : s.targetType) || 'non_breeding';
            document.getElementById('farmScheduleItemStructureTemplateId').value = s.structureTemplateId != null ? String(s.structureTemplateId) : '';
            document.getElementById('farmScheduleItemBasisTypeId').value = s.basisTypeId != null ? String(s.basisTypeId) : '';
            document.getElementById('farmScheduleItemAgeLabel').value = s.ageLabel || '';
            document.getElementById('farmScheduleItemDayMin').value = s.dayMin != null ? s.dayMin : '';
            document.getElementById('farmScheduleItemDayMax').value = s.dayMax != null ? s.dayMax : '';
            document.getElementById('farmScheduleItemDescription').value = s.description || '';
            document.getElementById('farmScheduleItemRecurrenceType').value = s.recurrenceType || '';
            if (deleteBtn) deleteBtn.style.display = 'inline-block';
            syncFarmScheduleItemModalToTargetType();
            if (s.recurrenceType === 'weekly' && s.recurrenceWeekdays) {
                document.querySelectorAll('.farm-schedule-recur-weekday').forEach(cb => {
                    cb.checked = s.recurrenceWeekdays.split(',').map(x => parseInt(x.trim(), 10)).includes(parseInt(cb.value, 10));
                });
            }
            if (s.recurrenceType === 'monthly') {
                const monthDay = document.getElementById('farmScheduleItemRecurrenceMonthDay');
                if (monthDay) monthDay.value = s.recurrenceMonthDay != null ? s.recurrenceMonthDay : '';
            }
            document.getElementById('farmScheduleItemRecurrenceType')?.dispatchEvent(new Event('change'));
        } else {
            title.textContent = '일정 추가';
            if (deleteBtn) deleteBtn.style.display = 'none';
            document.getElementById('farmScheduleItemTargetType').value = 'non_breeding';
            if (structureId) document.getElementById('farmScheduleItemStructureTemplateId').value = structureId;
            const sorted = [...farmScheduleItems].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
            window._farmScheduleInsertIndex = typeof insertIndex === 'number' ? insertIndex : sorted.length;
            if (!scheduleBasisTypes || scheduleBasisTypes.length === 0) await loadFarmScheduleBasisTypes();
            fillFarmScheduleItemBasisOptions('non_breeding');
        }
        await fillFarmScheduleItemTaskTypeOptionsFromFilter(document.getElementById('farmScheduleItemStructureTemplateId')?.value || '');
        if (id) {
            const s2 = farmScheduleItems.find(x => x.id === id);
            if (s2) document.getElementById('farmScheduleItemTaskTypeId').value = s2.taskTypeId != null ? String(s2.taskTypeId) : '';
        }
        if (modal.parentNode !== document.body) document.body.appendChild(modal);
        modal.classList.add('show');
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        modal.style.zIndex = '99999';
    };

    window.closeFarmScheduleItemModal = function () {
        const m = document.getElementById('farmScheduleItemModal');
        if (m) {
            m.classList.remove('show');
            m.style.display = '';
            m.style.visibility = '';
            m.style.zIndex = '';
        }
    };

    window.deleteFarmScheduleItemFromModal = async function () {
        const farmId = getFarmId();
        const id = document.getElementById('farmScheduleItemId')?.value;
        if (!farmId || !id) return;
        if (!confirm('이 일정을 삭제하시겠습니까?')) return;
        try {
            const res = await fetch(`/api/farms/${farmId}/schedule-items/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '삭제 실패');
            }
            alert('삭제되었습니다.');
            closeFarmScheduleItemModal();
            loadFarmScheduleItems();
        } catch (e) {
            alert(e.message);
        }
    };

    document.getElementById('farmScheduleItemStructureTemplateId')?.addEventListener('change', function () {
        fillFarmScheduleItemTaskTypeOptionsFromFilter(this.value || '');
    });

    document.getElementById('farmScheduleItemTargetType')?.addEventListener('change', syncFarmScheduleItemModalToTargetType);

    document.getElementById('farmScheduleItemRecurrenceType')?.addEventListener('change', function () {
        const t = (this.value || '').toLowerCase();
        const opts = document.getElementById('farmScheduleItemRecurrenceOptions');
        const weekly = document.getElementById('farmScheduleItemRecurrenceWeekly');
        const monthly = document.getElementById('farmScheduleItemRecurrenceMonthly');
        if (opts) opts.style.display = (t === 'weekly' || t === 'monthly') ? 'block' : 'none';
        if (weekly) weekly.style.display = t === 'weekly' ? 'block' : 'none';
        if (monthly) monthly.style.display = t === 'monthly' ? 'block' : 'none';
    });

    document.getElementById('farmScheduleItemForm')?.addEventListener('submit', async function (e) {
        e.preventDefault();
        const farmId = getFarmId();
        if (!farmId) return;
        const id = document.getElementById('farmScheduleItemId').value;
        const targetType = document.getElementById('farmScheduleItemTargetType').value;
        const structureTemplateId = document.getElementById('farmScheduleItemStructureTemplateId').value;
        const basisTypeId = document.getElementById('farmScheduleItemBasisTypeId').value;
        const ageLabel = document.getElementById('farmScheduleItemAgeLabel').value;
        const dayMin = document.getElementById('farmScheduleItemDayMin').value;
        const dayMax = document.getElementById('farmScheduleItemDayMax').value;
        const taskTypeId = document.getElementById('farmScheduleItemTaskTypeId').value;
        const description = document.getElementById('farmScheduleItemDescription').value;
        const recurrenceType = document.getElementById('farmScheduleItemRecurrenceType').value;

        if (!taskTypeId) {
            alert('작업유형을 선택하세요.');
            return;
        }

        const payload = {
            targetType: targetType || 'non_breeding',
            structureTemplateId: structureTemplateId ? parseInt(structureTemplateId, 10) : null,
            basisTypeId: basisTypeId ? parseInt(basisTypeId, 10) : null,
            ageLabel: isPigTargetType(targetType) && ageLabel && ageLabel.trim() ? ageLabel.trim() : null,
            dayMin: !isFacilityTargetType(targetType) && dayMin !== '' ? parseInt(dayMin, 10) : null,
            dayMax: !isFacilityTargetType(targetType) && dayMax !== '' ? parseInt(dayMax, 10) : null,
            taskTypeId: parseInt(taskTypeId, 10),
            description: description || null,
            isActive: true
        };

        if (recurrenceType) {
            payload.recurrenceType = recurrenceType;
            if (recurrenceType === 'weekly') {
                payload.recurrenceWeekdays = Array.from(document.querySelectorAll('.farm-schedule-recur-weekday:checked')).map(cb => cb.value).join(',');
            }
            if (recurrenceType === 'monthly') {
                const v = document.getElementById('farmScheduleItemRecurrenceMonthDay').value;
                payload.recurrenceMonthDay = v !== '' ? parseInt(v, 10) : null;
            }
        }

        if (id) {
            const sorted = [...farmScheduleItems].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
            const current = farmScheduleItems.find(x => x.id === parseInt(id, 10));
            payload.sortOrder = current != null ? current.sortOrder : 0;
        } else {
            payload.sortOrder = typeof window._farmScheduleInsertIndex === 'number' ? window._farmScheduleInsertIndex : farmScheduleItems.length;
        }

        try {
            if (id) {
                const res = await fetch(`/api/farms/${farmId}/schedule-items/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || '수정 실패');
                }
                alert('일정이 수정되었습니다.');
            } else {
                const res = await fetch(`/api/farms/${farmId}/schedule-items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || '추가 실패');
                }
                alert('일정이 추가되었습니다.');
            }
            closeFarmScheduleItemModal();
            loadFarmScheduleItems();
        } catch (err) {
            alert(err.message);
        }
    });

    // ----- 작업 유형 목록/추가·수정 (admin과 동일 기능) -----
    async function loadFarmScheduleTaskTypes(structureTemplateId) {
        const farmId = getFarmId();
        if (!farmId) { alert('농장을 선택해 주세요.'); return; }
        try {
            const url = structureTemplateId
                ? `/api/farms/${farmId}/schedule-task-types?structureTemplateId=${encodeURIComponent(structureTemplateId)}`
                : `/api/farms/${farmId}/schedule-task-types`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('작업 유형 목록 조회 실패');
            const list = await res.json();
            if (!structureTemplateId) {
                scheduleTaskTypes = list;
                const modal = document.getElementById('farmScheduleTaskTypesListModal');
                if (modal && modal.classList.contains('show')) renderFarmScheduleTaskTypesListModal();
                const selFilter = document.getElementById('farmScheduleFilterTaskType');
                if (selFilter) selFilter.innerHTML = '<option value="">전체</option>' + (scheduleTaskTypes || []).map(t => '<option value="' + t.id + '">' + escapeHtml(t.name) + '</option>').join('');
                const checkAll = document.getElementById('farmScheduleTaskTypeListModalCheckAll');
                if (checkAll) checkAll.checked = false;
            }
            const selModal = document.getElementById('farmScheduleItemTaskTypeId');
            if (selModal) {
                const currentVal = selModal.value;
                selModal.innerHTML = '<option value="">선택</option>' + list.map(t => '<option value="' + t.id + '">' + escapeHtml(t.name) + '</option>').join('');
                if (currentVal && list.some(t => t.id === parseInt(currentVal, 10))) selModal.value = currentVal;
                else selModal.value = '';
            }
        } catch (e) {
            const tbody = document.getElementById('farmScheduleTaskTypesListModalBody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="error">' + escapeHtml(e.message) + '</td></tr>';
        }
    }

    async function fillFarmScheduleItemTaskTypeOptionsFromFilter(structureTemplateId) {
        const sel = document.getElementById('farmScheduleItemTaskTypeId');
        if (!sel) return;
        if (!structureTemplateId) {
            await loadFarmScheduleTaskTypes();
            return;
        }
        await loadFarmScheduleTaskTypes(structureTemplateId);
    }

    function renderFarmScheduleTaskTypesListModal() {
        const tbody = document.getElementById('farmScheduleTaskTypesListModalBody');
        if (!tbody) return;
        if (!scheduleTaskTypes || scheduleTaskTypes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-muted">등록된 작업 유형이 없습니다.</td></tr>';
            return;
        }
        const scopeLabel = (t) => {
            if (t.appliesToAllStructures !== false) return '전체 시설';
            const scopes = t.structureScopes || [];
            if (!scopes.length) return '-';
            return scopes.map(s => s.structureTemplate && s.structureTemplate.name).filter(Boolean).join(', ') || '-';
        };
        const categoryLabel = (code) => {
            const map = { entry: '전입', move: '이동', vaccine: '백신·건강', feed: '사료·급여', facility_management: '시설·관리', facility_environment: '시설·환경', facility_disinfection: '시설·방역', other: '기타' };
            return (code && map[code]) ? map[code] : (code || '-');
        };
        const categoryOrder = ['entry', 'move', 'vaccine', 'feed', 'facility_management', 'facility_environment', 'facility_disinfection', 'other'];
        const sortKey = function (t) {
            var ci = categoryOrder.indexOf(t.category || '');
            return [(ci >= 0 ? ci : 99), t.sortOrder ?? 0, t.id];
        };
        const sorted = [...scheduleTaskTypes].sort(function (a, b) {
            var ak = sortKey(a), bk = sortKey(b);
            if (ak[0] !== bk[0]) return ak[0] - bk[0];
            if (ak[1] !== bk[1]) return ak[1] - bk[1];
            return ak[2] - bk[2];
        });
        var lastCat = null;
        var rows = [];
        sorted.forEach(function (t) {
            var cat = t.category || '';
            if (cat !== lastCat) {
                lastCat = cat;
                rows.push('<tr class="schedule-task-type-group-header"><td colspan="5" class="schedule-task-type-group-cell">' + escapeHtml(categoryLabel(cat)) + '</td></tr>');
            }
            rows.push(
                '<tr class="clickable-row" data-farm-task-type-id="' + t.id + '" style="cursor: pointer;">' +
                '<td><input type="checkbox" class="farm-schedule-task-type-list-cb" value="' + t.id + '"></td>' +
                '<td><span class="schedule-drag-handle" draggable="true" title="드래그하여 순서 변경">≡</span></td>' +
                '<td class="text-muted small">' + escapeHtml(scopeLabel(t)) + '</td>' +
                '<td class="text-muted small">' + escapeHtml(categoryLabel(t.category)) + '</td>' +
                '<td>' + escapeHtml(t.name) + '</td></tr>'
            );
        });
        tbody.innerHTML = rows.join('');
        tbody.querySelectorAll('tr[data-farm-task-type-id]').forEach(tr => {
            tr.addEventListener('click', function (e) {
                if (e.target.type === 'checkbox' || e.target.closest('.schedule-drag-handle')) return;
                if (window._farmScheduleTaskTypeSortJustEnded) { window._farmScheduleTaskTypeSortJustEnded = false; return; }
                const id = parseInt(tr.getAttribute('data-farm-task-type-id'), 10);
                if (id) openFarmScheduleTaskTypeModal(id);
            });
            const handle = tr.querySelector('.schedule-drag-handle');
            if (handle) {
                handle.addEventListener('mousedown', function (e) { e.stopPropagation(); });
                handle.addEventListener('dragstart', function (e) {
                    e.dataTransfer.setData('text/plain', tr.getAttribute('data-farm-task-type-id'));
                    e.dataTransfer.effectAllowed = 'move';
                    tr.classList.add('dragging');
                });
                handle.addEventListener('dragend', function () {
                    tr.classList.remove('dragging');
                    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-before', 'drag-over-after'));
                });
            }
            tr.addEventListener('dragover', function (e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const id = tr.getAttribute('data-farm-task-type-id');
                if (id === e.dataTransfer.getData('text/plain')) return;
                const rect = tr.getBoundingClientRect();
                tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-before', 'drag-over-after'));
                tr.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drag-over-before' : 'drag-over-after');
            });
            tr.addEventListener('dragleave', function () { tr.classList.remove('drag-over-before', 'drag-over-after'); });
            tr.addEventListener('drop', function (e) {
                e.preventDefault();
                e.stopPropagation();
                tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-before', 'drag-over-after'));
                const draggedId = parseInt(e.dataTransfer.getData('text/plain'), 10);
                const dropId = parseInt(tr.getAttribute('data-farm-task-type-id'), 10);
                if (draggedId === dropId) return;
                window._farmScheduleTaskTypeSortJustEnded = true;
                reorderFarmScheduleTaskTypes(draggedId, dropId, e.clientY < tr.getBoundingClientRect().top + tr.getBoundingClientRect().height / 2);
            });
        });
    }

    async function reorderFarmScheduleTaskTypes(draggedId, dropTargetId, insertBefore) {
        const farmId = getFarmId();
        if (!farmId) return;
        const sorted = [...scheduleTaskTypes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const fromIndex = sorted.findIndex(t => t.id === draggedId);
        const toIndex = sorted.findIndex(t => t.id === dropTargetId);
        if (fromIndex === -1 || toIndex === -1) return;
        const item = sorted.splice(fromIndex, 1)[0];
        let insertAt = insertBefore ? toIndex : toIndex + 1;
        if (fromIndex < insertAt) insertAt--;
        sorted.splice(insertAt, 0, item);
        try {
            for (let i = 0; i < sorted.length; i++) {
                const t = sorted[i];
                const structureTemplateIds = (t.structureScopes || []).map(s => (s.structureTemplate && s.structureTemplate.id) || s.structureTemplateId).filter(Boolean);
                const res = await fetch(`/api/farms/${farmId}/schedule-task-types/${t.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code: t.code,
                        name: t.name,
                        category: t.category,
                        sortOrder: i,
                        appliesToAllStructures: t.appliesToAllStructures !== false,
                        structureTemplateIds: structureTemplateIds
                    })
                });
                if (!res.ok) throw new Error('순서 저장 실패');
            }
            await loadFarmScheduleTaskTypes();
            if (typeof loadFarmScheduleItems === 'function') loadFarmScheduleItems();
        } catch (err) {
            alert(err.message);
        }
        window._farmScheduleTaskTypeSortJustEnded = false;
    }

    window.toggleFarmScheduleTaskTypeListModalCheckAll = function (checkbox) {
        const modal = document.getElementById('farmScheduleTaskTypesListModal');
        if (!modal) return;
        modal.querySelectorAll('.farm-schedule-task-type-list-cb').forEach(cb => { cb.checked = checkbox.checked; });
    };

    window.deleteSelectedFarmScheduleTaskTypesInModal = async function () {
        const modal = document.getElementById('farmScheduleTaskTypesListModal');
        if (!modal) return;
        const ids = Array.from(modal.querySelectorAll('.farm-schedule-task-type-list-cb:checked')).map(cb => parseInt(cb.value, 10));
        if (ids.length === 0) { alert('삭제할 항목을 선택하세요.'); return; }
        if (!confirm('선택한 ' + ids.length + '건을 삭제하시겠습니까?')) return;
        const farmId = getFarmId();
        if (!farmId) { alert('농장을 선택해 주세요.'); return; }
        try {
            for (const id of ids) {
                const res = await fetch(`/api/farms/${farmId}/schedule-task-types/${id}`, { method: 'DELETE' });
                if (!res.ok) { const data = await res.json(); throw new Error(data.error || '삭제 실패'); }
            }
            alert('삭제되었습니다.');
            await loadFarmScheduleTaskTypes();
            if (typeof loadFarmScheduleItems === 'function') loadFarmScheduleItems();
        } catch (e) { alert(e.message); }
    };

    window.openFarmScheduleTaskTypesListModal = async function () {
        const modal = document.getElementById('farmScheduleTaskTypesListModal');
        if (!modal) { console.error('farm_schedule: farmScheduleTaskTypesListModal 요소 없음'); return; }
        if (modal.parentNode !== document.body) document.body.appendChild(modal);
        modal.classList.add('show');
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        modal.style.zIndex = '99999';
        const tbody = document.getElementById('farmScheduleTaskTypesListModalBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-muted">불러오는 중...</td></tr>';
        requestAnimationFrame(function () {
            loadFarmScheduleTaskTypes()
                .then(function () { renderFarmScheduleTaskTypesListModal(); })
                .catch(function (e) {
                    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="error">' + escapeHtml(e.message) + '</td></tr>';
                });
        });
    };

    window.closeFarmScheduleTaskTypesListModal = function () {
        const m = document.getElementById('farmScheduleTaskTypesListModal');
        if (m) { m.classList.remove('show'); m.style.display = ''; m.style.visibility = ''; m.style.zIndex = ''; }
    };

    window.openFarmScheduleTaskTypeModal = function (id) {
        const modal = document.getElementById('farmScheduleTaskTypeModal');
        const title = document.getElementById('farmScheduleTaskTypeModalTitle');
        const form = document.getElementById('farmScheduleTaskTypeForm');
        const deleteBtn = document.getElementById('farmScheduleTaskTypeModalDeleteBtn');
        const scopeGroup = document.getElementById('farmScheduleTaskTypeStructureScopeGroup');
        const scopeAll = document.querySelector('input[name="farmScheduleTaskTypeScope"][value="all"]');
        const scopeSpecific = document.querySelector('input[name="farmScheduleTaskTypeScope"][value="specific"]');
        const checkboxesContainer = document.getElementById('farmScheduleTaskTypeStructureCheckboxes');
        if (!modal || !form) { console.error('farm_schedule: farmScheduleTaskTypeModal 요소 없음'); return; }
        form.reset();
        document.getElementById('farmScheduleTaskTypeId').value = id ? String(id) : '';
        if (checkboxesContainer && (farmProductionStructures || []).length > 0) {
            checkboxesContainer.innerHTML = farmProductionStructures.map(s =>
                '<label class="block-checkbox" style="display: inline-flex; align-items: center; white-space: nowrap; margin: 0;"><input type="checkbox" class="farm-schedule-task-type-structure-cb" value="' + s.templateId + '"> ' + escapeHtml(s.name) + '</label>'
            ).join('');
        }
        if (id) {
            const t = scheduleTaskTypes.find(x => Number(x.id) === Number(id));
            if (!t) return;
            title.textContent = '작업 유형 수정';
            document.getElementById('farmScheduleTaskTypeName').value = t.name || '';
            var categoryEl = document.getElementById('farmScheduleTaskTypeCategory');
            if (categoryEl) categoryEl.value = (t.category && String(t.category).trim()) || '';
            if (scopeAll) scopeAll.checked = t.appliesToAllStructures !== false;
            if (scopeSpecific) scopeSpecific.checked = t.appliesToAllStructures === false;
            if (scopeGroup) scopeGroup.style.display = t.appliesToAllStructures === false ? 'block' : 'none';
            if (t.appliesToAllStructures === false && checkboxesContainer) {
                const scopeIds = (t.structureScopes || []).map(s => (s.structureTemplate && s.structureTemplate.id) || s.structureTemplateId).filter(Boolean);
                checkboxesContainer.querySelectorAll('.farm-schedule-task-type-structure-cb').forEach(cb => {
                    cb.checked = scopeIds.indexOf(parseInt(cb.value, 10)) !== -1 || scopeIds.indexOf(cb.value) !== -1;
                });
            }
            if (deleteBtn) deleteBtn.style.display = 'inline-block';
        } else {
            title.textContent = '작업 유형 추가';
            var catSelect = document.getElementById('farmScheduleTaskTypeCategory');
            if (catSelect) catSelect.value = '';
            if (scopeAll) scopeAll.checked = true;
            if (scopeSpecific) scopeSpecific.checked = false;
            if (scopeGroup) scopeGroup.style.display = 'none';
            if (deleteBtn) deleteBtn.style.display = 'none';
        }
        modal.classList.add('show');
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
    };

    window.closeFarmScheduleTaskTypeModal = function () {
        const m = document.getElementById('farmScheduleTaskTypeModal');
        if (m) { m.classList.remove('show'); m.style.display = ''; m.style.visibility = ''; }
    };

    window.deleteFarmScheduleTaskTypeFromModal = async function () {
        const farmId = getFarmId();
        const id = document.getElementById('farmScheduleTaskTypeId')?.value;
        if (!farmId || !id) return;
        if (!confirm('이 작업 유형을 삭제하시겠습니까?')) return;
        try {
            const res = await fetch(`/api/farms/${farmId}/schedule-task-types/${id}`, { method: 'DELETE' });
            if (!res.ok) { const data = await res.json(); throw new Error(data.error || '삭제 실패'); }
            alert('삭제되었습니다.');
            closeFarmScheduleTaskTypeModal();
            await loadFarmScheduleTaskTypes();
            if (typeof loadFarmScheduleItems === 'function') loadFarmScheduleItems();
        } catch (e) { alert(e.message); }
    };

    document.querySelectorAll('input[name="farmScheduleTaskTypeScope"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
            const group = document.getElementById('farmScheduleTaskTypeStructureScopeGroup');
            if (group) group.style.display = this.value === 'specific' ? 'block' : 'none';
        });
    });

    document.getElementById('farmScheduleTaskTypeForm')?.addEventListener('submit', async function (e) {
        e.preventDefault();
        const farmId = getFarmId();
        if (!farmId) { alert('농장을 선택해 주세요.'); return; }
        const id = document.getElementById('farmScheduleTaskTypeId')?.value;
        const name = document.getElementById('farmScheduleTaskTypeName')?.value?.trim();
        if (!name) { alert('이름을 입력하세요.'); return; }
        const categoryEl = document.getElementById('farmScheduleTaskTypeCategory');
        const category = (categoryEl && categoryEl.value && categoryEl.value.trim()) ? categoryEl.value.trim() : null;
        const scopeAll = document.querySelector('input[name="farmScheduleTaskTypeScope"][value="all"]');
        const appliesToAllStructures = !scopeAll || scopeAll.checked;
        const structureTemplateIds = appliesToAllStructures ? [] : Array.from(document.querySelectorAll('.farm-schedule-task-type-structure-cb:checked')).map(function (cb) { return parseInt(cb.value, 10) || cb.value; });
        const sorted = [...scheduleTaskTypes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const sortOrder = id ? (scheduleTaskTypes.find(x => x.id === parseInt(id, 10))?.sortOrder ?? 0) : sorted.length;
        const payload = { code: null, name, category, sortOrder, appliesToAllStructures, structureTemplateIds };
        try {
            if (id) {
                const res = await fetch(`/api/farms/${farmId}/schedule-task-types/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!res.ok) { const err = await res.json(); throw new Error(err.error || '수정 실패'); }
                alert('작업 유형이 수정되었습니다.');
            } else {
                const res = await fetch(`/api/farms/${farmId}/schedule-task-types`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!res.ok) { const err = await res.json(); throw new Error(err.error || '추가 실패'); }
                alert('작업 유형이 추가되었습니다.');
            }
            closeFarmScheduleTaskTypeModal();
            await loadFarmScheduleTaskTypes();
            if (typeof loadFarmScheduleItems === 'function') loadFarmScheduleItems();
        } catch (err) { alert(err.message); }
    });

    // ----- 기준 유형 목록/추가·수정 (농장 전용) -----
    async function loadFarmScheduleBasisTypes() {
        const farmId = getFarmId();
        if (!farmId) { alert('농장을 선택해 주세요.'); return; }
        try {
            const res = await fetch(`/api/farms/${farmId}/schedule-basis-types`);
            if (!res.ok) throw new Error('기준 유형 목록 조회 실패');
            scheduleBasisTypes = await res.json();
            const modal = document.getElementById('farmScheduleBasisTypesListModal');
            if (modal && modal.classList.contains('show')) renderFarmScheduleBasisTypesListModal();
            fillFarmScheduleItemBasisOptions(document.getElementById('farmScheduleItemTargetType')?.value || 'non_breeding');
            const selFilter = document.getElementById('farmScheduleFilterBasisType');
            if (selFilter) selFilter.innerHTML = '<option value="">전체</option>' + (scheduleBasisTypes || []).map(b => '<option value="' + b.id + '">' + escapeHtml(b.name) + '</option>').join('');
            const checkAll = document.getElementById('farmScheduleBasisTypeListModalCheckAll');
            if (checkAll) checkAll.checked = false;
        } catch (e) {
            const tbody = document.getElementById('farmScheduleBasisTypesListModalBody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="error">' + escapeHtml(e.message) + '</td></tr>';
        }
    }

    function renderFarmScheduleBasisTypesListModal() {
        const tbody = document.getElementById('farmScheduleBasisTypesListModalBody');
        if (!tbody) return;
        const targetLabel = (v) => (v === 'sow' ? '모돈' : v === 'boar' ? '옹돈' : v === 'non_breeding' ? '비번식돈' : v === 'facility' ? '시설' : v === 'pig' ? '비번식돈' : (v ? String(v) : '-'));
        if (!scheduleBasisTypes || scheduleBasisTypes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-muted">등록된 기준 유형이 없습니다.</td></tr>';
            return;
        }
        const sorted = [...scheduleBasisTypes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        tbody.innerHTML = sorted.map(b => `
            <tr class="clickable-row" data-farm-basis-type-id="${b.id}" style="cursor: pointer;">
                <td><input type="checkbox" class="farm-schedule-basis-type-list-cb" value="${b.id}"></td>
                <td><span class="schedule-drag-handle" draggable="true" title="드래그하여 순서 변경">≡</span></td>
                <td>${escapeHtml(targetLabel(b.targetType))}</td>
                <td>${escapeHtml(b.name)}</td>
            </tr>
        `).join('');
        tbody.querySelectorAll('tr[data-farm-basis-type-id]').forEach(tr => {
            tr.addEventListener('click', function (e) {
                if (e.target.type === 'checkbox' || e.target.closest('.schedule-drag-handle')) return;
                if (window._farmScheduleBasisTypeSortJustEnded) { window._farmScheduleBasisTypeSortJustEnded = false; return; }
                const id = parseInt(tr.getAttribute('data-farm-basis-type-id'), 10);
                if (id) openFarmScheduleBasisTypeModal(id);
            });
            const handle = tr.querySelector('.schedule-drag-handle');
            if (handle) {
                handle.addEventListener('mousedown', function (e) { e.stopPropagation(); });
                handle.addEventListener('dragstart', function (e) {
                    e.dataTransfer.setData('text/plain', tr.getAttribute('data-farm-basis-type-id'));
                    e.dataTransfer.effectAllowed = 'move';
                    tr.classList.add('dragging');
                });
                handle.addEventListener('dragend', function () {
                    tr.classList.remove('dragging');
                    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-before', 'drag-over-after'));
                });
            }
            tr.addEventListener('dragover', function (e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const id = tr.getAttribute('data-farm-basis-type-id');
                if (id === e.dataTransfer.getData('text/plain')) return;
                const rect = tr.getBoundingClientRect();
                tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-before', 'drag-over-after'));
                tr.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drag-over-before' : 'drag-over-after');
            });
            tr.addEventListener('dragleave', function () { tr.classList.remove('drag-over-before', 'drag-over-after'); });
            tr.addEventListener('drop', function (e) {
                e.preventDefault();
                e.stopPropagation();
                tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-before', 'drag-over-after'));
                const draggedId = parseInt(e.dataTransfer.getData('text/plain'), 10);
                const dropId = parseInt(tr.getAttribute('data-farm-basis-type-id'), 10);
                if (draggedId === dropId) return;
                window._farmScheduleBasisTypeSortJustEnded = true;
                reorderFarmScheduleBasisTypes(draggedId, dropId, e.clientY < tr.getBoundingClientRect().top + tr.getBoundingClientRect().height / 2);
            });
        });
    }

    async function reorderFarmScheduleBasisTypes(draggedId, dropTargetId, insertBefore) {
        const sorted = [...scheduleBasisTypes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const fromIndex = sorted.findIndex(b => b.id === draggedId);
        const toIndex = sorted.findIndex(b => b.id === dropTargetId);
        if (fromIndex === -1 || toIndex === -1) return;
        const item = sorted.splice(fromIndex, 1)[0];
        let insertAt = insertBefore ? toIndex : toIndex + 1;
        if (fromIndex < insertAt) insertAt--;
        sorted.splice(insertAt, 0, item);
        const farmId = getFarmId();
        if (!farmId) return;
        try {
            for (let i = 0; i < sorted.length; i++) {
                const res = await fetch(`/api/farms/${farmId}/schedule-basis-types/${sorted[i].id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: sorted[i].code, name: sorted[i].name, targetType: sorted[i].targetType, description: sorted[i].description, sortOrder: i })
                });
                if (!res.ok) throw new Error('순서 저장 실패');
            }
            await loadFarmScheduleBasisTypes();
            if (typeof loadFarmScheduleItems === 'function') loadFarmScheduleItems();
        } catch (err) {
            alert(err.message);
        }
        window._farmScheduleBasisTypeSortJustEnded = false;
    }

    window.toggleFarmScheduleBasisTypeListModalCheckAll = function (checkbox) {
        const modal = document.getElementById('farmScheduleBasisTypesListModal');
        if (!modal) return;
        modal.querySelectorAll('.farm-schedule-basis-type-list-cb').forEach(cb => { cb.checked = checkbox.checked; });
    };

    window.deleteSelectedFarmScheduleBasisTypesInModal = async function () {
        const farmId = getFarmId();
        if (!farmId) { alert('농장을 선택해 주세요.'); return; }
        const modal = document.getElementById('farmScheduleBasisTypesListModal');
        if (!modal) return;
        const ids = Array.from(modal.querySelectorAll('.farm-schedule-basis-type-list-cb:checked')).map(cb => parseInt(cb.value, 10));
        if (ids.length === 0) { alert('삭제할 항목을 선택하세요.'); return; }
        if (!confirm('선택한 ' + ids.length + '건을 삭제하시겠습니까?')) return;
        try {
            for (const id of ids) {
                const res = await fetch(`/api/farms/${farmId}/schedule-basis-types/${id}`, { method: 'DELETE' });
                if (!res.ok) { const data = await res.json(); throw new Error(data.error || '삭제 실패'); }
            }
            alert('삭제되었습니다.');
            await loadFarmScheduleBasisTypes();
            if (typeof loadFarmScheduleItems === 'function') loadFarmScheduleItems();
        } catch (e) { alert(e.message); }
    };

    window.openFarmScheduleBasisTypesListModal = async function () {
        const modal = document.getElementById('farmScheduleBasisTypesListModal');
        if (!modal) { console.error('farm_schedule: farmScheduleBasisTypesListModal 요소 없음'); return; }
        // body 직계 자식으로 옮겨 부모 overflow/z-index에 가리지 않도록 함
        if (modal.parentNode !== document.body) document.body.appendChild(modal);
        modal.classList.add('show');
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        modal.style.zIndex = '99999';
        const tbody = document.getElementById('farmScheduleBasisTypesListModalBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-muted">불러오는 중...</td></tr>';
        requestAnimationFrame(function () {
            loadFarmScheduleBasisTypes()
                .then(function () { renderFarmScheduleBasisTypesListModal(); })
                .catch(function (e) {
                    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="error">' + escapeHtml(e.message) + '</td></tr>';
                });
        });
    };

    window.closeFarmScheduleBasisTypesListModal = function () {
        const m = document.getElementById('farmScheduleBasisTypesListModal');
        if (m) { m.classList.remove('show'); m.style.display = ''; m.style.visibility = ''; m.style.zIndex = ''; }
    };

    window.openFarmScheduleBasisTypeModal = function (id) {
        const modal = document.getElementById('farmScheduleBasisTypeModal');
        const title = document.getElementById('farmScheduleBasisTypeModalTitle');
        const form = document.getElementById('farmScheduleBasisTypeForm');
        const deleteBtn = document.getElementById('farmScheduleBasisTypeModalDeleteBtn');
        if (!modal || !form) { console.error('farm_schedule: farmScheduleBasisTypeModal 요소 없음'); return; }
        form.reset();
        document.getElementById('farmScheduleBasisTypeId').value = id ? String(id) : '';
        if (id) {
            const b = scheduleBasisTypes.find(x => x.id === parseInt(id, 10));
            if (!b) return;
            title.textContent = '기준 유형 수정';
            document.getElementById('farmScheduleBasisTypeName').value = b.name || '';
            document.getElementById('farmScheduleBasisTypeTargetType').value = (b.targetType === 'pig' ? 'non_breeding' : b.targetType) || '';
            if (deleteBtn) deleteBtn.style.display = 'inline-block';
        } else {
            title.textContent = '기준 유형 추가';
            if (deleteBtn) deleteBtn.style.display = 'none';
        }
        modal.classList.add('show');
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
    };

    window.closeFarmScheduleBasisTypeModal = function () {
        const m = document.getElementById('farmScheduleBasisTypeModal');
        if (m) { m.classList.remove('show'); m.style.display = ''; m.style.visibility = ''; }
    };

    window.deleteFarmScheduleBasisTypeFromModal = async function () {
        const farmId = getFarmId();
        const id = document.getElementById('farmScheduleBasisTypeId')?.value;
        if (!farmId || !id) return;
        if (!confirm('이 기준 유형을 삭제하시겠습니까?')) return;
        try {
            const res = await fetch(`/api/farms/${farmId}/schedule-basis-types/${id}`, { method: 'DELETE' });
            if (!res.ok) { const data = await res.json(); throw new Error(data.error || '삭제 실패'); }
            alert('삭제되었습니다.');
            closeFarmScheduleBasisTypeModal();
            await loadFarmScheduleBasisTypes();
            if (typeof loadFarmScheduleItems === 'function') loadFarmScheduleItems();
        } catch (e) { alert(e.message); }
    };

    document.getElementById('farmScheduleBasisTypeForm')?.addEventListener('submit', async function (e) {
        e.preventDefault();
        const id = document.getElementById('farmScheduleBasisTypeId')?.value;
        const name = document.getElementById('farmScheduleBasisTypeName')?.value?.trim();
        if (!name) { alert('이름을 입력하세요.'); return; }
        const targetType = document.getElementById('farmScheduleBasisTypeTargetType')?.value || null;
        const existing = id ? scheduleBasisTypes.find(x => x.id === parseInt(id, 10)) : null;
        const sortOrder = id ? (existing?.sortOrder ?? 0) : scheduleBasisTypes.length;
        const farmId = getFarmId();
        if (!farmId) { alert('농장을 선택해 주세요.'); return; }
        const payload = { code: existing ? existing.code : null, name, targetType, description: null, sortOrder };
        try {
            if (id) {
                const res = await fetch(`/api/farms/${farmId}/schedule-basis-types/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!res.ok) { const err = await res.json(); throw new Error(err.error || '수정 실패'); }
                alert('기준 유형이 수정되었습니다.');
            } else {
                const res = await fetch(`/api/farms/${farmId}/schedule-basis-types`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!res.ok) { const err = await res.json(); throw new Error(err.error || '추가 실패'); }
                alert('기준 유형이 추가되었습니다.');
            }
            closeFarmScheduleBasisTypeModal();
            await loadFarmScheduleBasisTypes();
            if (typeof loadFarmScheduleItems === 'function') loadFarmScheduleItems();
        } catch (err) { alert(err.message); }
    });

    // 이벤트 위임: 버튼 클릭 시 모달 열기 (전역 onclick과 동시 사용)
    function handleFarmScheduleModalButton(e, action, fn) {
        if (!fn) { console.error('farm_schedule: ' + action + ' 함수 없음'); alert('일정 설정 스크립트를 불러오지 못했습니다. 페이지를 새로고침 해 주세요.'); return; }
        e.preventDefault();
        e.stopPropagation();
        fn();
    }
    document.body.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('[data-action="open-farm-schedule-task-types-list"]');
        if (btn) { handleFarmScheduleModalButton(e, '작업유형 목록', window.openFarmScheduleTaskTypesListModal); return; }
        btn = e.target.closest && e.target.closest('[data-action="open-farm-schedule-basis-types-list"]');
        if (btn) { handleFarmScheduleModalButton(e, '기준유형 목록', window.openFarmScheduleBasisTypesListModal); return; }
        btn = e.target.closest && e.target.closest('[data-action="open-farm-schedule-task-type-modal"]');
        if (btn) { handleFarmScheduleModalButton(e, '작업유형 추가', window.openFarmScheduleTaskTypeModal); return; }
        btn = e.target.closest && e.target.closest('[data-action="open-farm-schedule-basis-type-modal"]');
        if (btn) { handleFarmScheduleModalButton(e, '기준유형 추가', window.openFarmScheduleBasisTypeModal); return; }
    });
})();
