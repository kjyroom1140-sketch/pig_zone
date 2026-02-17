// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadDashboard();
    initNavigation();
    await loadDatabaseStructure();
});

function escapeHtml(str) {
    if (str == null) return '';
    const s = String(str);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 인증 확인
let currentUser = null; // 현재 로그인한 사용자 정보 저장

async function checkAuth() {
    try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
            window.location.href = '/login.html';
            return;
        }

        const data = await response.json();

        // system_admin이 아니면 접근 불가
        if (data.user.systemRole !== 'system_admin') {
            alert('최고 관리자(시스템 관리자)만 접근할 수 있습니다.');
            window.location.href = '/';
            return;
        }

        // 사용자 정보 저장 및 표시
        currentUser = data.user;
        document.getElementById('userInfo').textContent = `${data.user.fullName} (${data.user.username})`;

    } catch (error) {
        console.error('인증 확인 오류:', error);
        window.location.href = '/login.html';
    }
}

// 네비게이션 초기화
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            e.preventDefault();

            const section = item.dataset.section;

            // 이 섹션에 해당하는 서브메뉴 요소
            const subMenuId = { database: 'navTableList', users: 'navUsersList', settings: 'navSettingsList' }[section];
            const thisSubMenu = subMenuId ? document.getElementById(subMenuId) : null;

            // 같은 주메뉴를 다시 클릭한 경우: 이미 활성이고 서브메뉴가 열려 있으면 서브메뉴만 숨김
            if (item.classList.contains('active') && thisSubMenu && thisSubMenu.classList.contains('show')) {
                thisSubMenu.classList.remove('show');
                return;
            }

            // 모든 서브메뉴 닫기 (다른 메뉴 하위 목록 접기)
            document.querySelectorAll('.nav-sub-menu').forEach(sub => {
                sub.classList.remove('show');
            });

            // 네비게이션 활성화
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // 섹션 표시
            document.querySelectorAll('.content-section').forEach(sec => {
                sec.classList.remove('active');
            });
            document.getElementById(section).classList.add('active');

            // 섹션별 데이터 로드
            switch (section) {
                case 'dashboard':
                    await loadDashboard();
                    break;
                case 'database':
                    const subMenu = document.getElementById('navTableList');
                    if (subMenu) subMenu.classList.add('show');

                    const placeholder = document.getElementById('tablePlaceholder');
                    const detailInfo = document.getElementById('tableDetailInfo');

                    if (placeholder) placeholder.style.display = 'flex';
                    if (detailInfo) detailInfo.style.display = 'none';
                    break;
                case 'users':
                    await loadUsers();
                    const usersSubMenu = document.getElementById('navUsersList');
                    if (usersSubMenu) {
                        usersSubMenu.classList.add('show');

                        const firstTab = usersSubMenu.querySelector('.nav-sub-item');
                        if (firstTab) {
                            showUsersTab('info', firstTab);
                        }
                    }
                    break;
                case 'farms':
                    await loadFarms();
                    break;
                case 'settings':
                    await loadSettings();
                    const settingsSubMenu = document.getElementById('navSettingsList');
                    if (settingsSubMenu) settingsSubMenu.classList.add('show');
                    break;
            }
        });
    });

    // 검색 및 필터 이벤트 리스너
    const searchInput = document.getElementById('userSearchInput');
    const statusFilter = document.getElementById('userStatusFilter');

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            filterAndRenderUsers();
        });
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            filterAndRenderUsers();
        });
    }
}

// 대시보드 로드
async function loadDashboard() {
    try {
        // 통계 데이터 로드
        const statsResponse = await fetch('/api/admin/database/stats');
        const statsData = await statsResponse.json();

        // 전체 회원 수에서 -1 (시스템 관리자 제외)
        document.getElementById('statUsers').textContent = statsData.stats.users - 1 + ' 명';
        document.getElementById('statFarms').textContent = statsData.stats.farms;

    } catch (error) {
        console.error('대시보드 로드 오류:', error);
    }
}

// 데이터베이스 구조 로드
// 데이터베이스 구조 로드 (사이드바용)
let currentTable = {
    name: '',
    tableInfo: null,
    columns: [],
    rows: [],
    hiddenColumns: new Set()
};

async function loadDatabaseStructure() {
    try {
        const response = await fetch('/api/admin/database/tables');
        const data = await response.json();

        const navContainer = document.getElementById('navTableList');

        if (!navContainer || !data.tables) return;

        navContainer.innerHTML = '';

        // 테이블 목록 정렬 (이름순)
        data.tables.sort((a, b) => a.table_name.localeCompare(b.table_name));

        data.tables.forEach(table => {
            const item = document.createElement('div');
            item.className = 'nav-sub-item';
            item.innerHTML = `
                <span>${table.table_name}</span>
                <span class="sub-item-count">${table.column_count}</span>
            `;

            item.addEventListener('click', (e) => {
                e.stopPropagation(); // 상위 이벤트 전파 방지

                // 모든 네비게이션 active 제거
                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));

                // 현재 항목 활성화
                document.querySelectorAll('.nav-sub-item').forEach(sub => sub.classList.remove('active'));
                item.classList.add('active');

                // 데이터베이스 메뉴도 활성화
                const dbMenu = document.querySelector('.nav-item[data-section="database"]');
                if (dbMenu) dbMenu.classList.add('active');

                // 데이터베이스 섹션 표시
                const dbSection = document.getElementById('database');
                if (dbSection) dbSection.classList.add('active');

                // 상세 정보 로드
                loadTableDetails(table);
            });

            navContainer.appendChild(item);
        });

    } catch (error) {
        console.error('데이터베이스 구조 로드 오류:', error);
    }
}

// 테이블 상세 정보 로드
async function loadTableDetails(table) {
    const placeholder = document.getElementById('tablePlaceholder');
    const detailInfo = document.getElementById('tableDetailInfo');

    if (!placeholder || !detailInfo) return;

    // 테이블 변경 시 hidden columns 초기화
    if (currentTable.name !== table.table_name) {
        currentTable.hiddenColumns.clear();
        currentTable.tableInfo = null;
    } else {
        // 동일 테이블 리로딩 시 메타데이터 보존
        if (!table.table_comment && currentTable.tableInfo) {
            table.table_comment = currentTable.tableInfo.table_comment;
            table.column_count = table.column_count || currentTable.tableInfo.column_count;
        }
    }

    currentTable.name = table.table_name;
    currentTable.tableInfo = table;

    placeholder.style.display = 'none';
    detailInfo.style.display = 'block';
    detailInfo.innerHTML = '<div class="loading">테이블 정보를 불러오는 중...</div>';

    try {
        const [columnsRes, rowsRes] = await Promise.all([
            fetch(`/api/admin/database/tables/${table.table_name}/columns`),
            fetch(`/api/admin/database/tables/${table.table_name}/rows?limit=100`) // Limit increased
        ]);

        if (!columnsRes.ok) {
            throw new Error('컬럼 정보를 불러오는 데 실패했습니다.');
        }

        const columnsData = await columnsRes.json();
        let rows = [];

        if (rowsRes.ok) {
            const rowsData = await rowsRes.json();
            rows = rowsData.rows || [];
        }

        // 전역 상태 업데이트
        currentTable.columns = columnsData.columns;
        currentTable.rows = rows;

        renderTableDetail(table);
    } catch (error) {
        console.error('컬럼 정보 로드 오류:', error);
        detailInfo.innerHTML = '<div class="message error">테이블 정보를 불러오는 데 실패했습니다.</div>';
    }
}

// 테이블 상세 정보 렌더링
function renderTableDetail(table) {
    const columns = currentTable.columns;
    const rows = currentTable.rows;
    const detailInfo = document.getElementById('tableDetailInfo');
    if (!detailInfo) return;

    // 테이블 설명 (편집 가능)
    const tableCommentDisplay = (table.table_comment || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const commentHtml = `
        <span class="table-description-inline" id="tableCommentDisplay">${tableCommentDisplay || '(설명 없음)'}</span>
        <button type="button" class="btn btn-sm btn-edit-comment" style="margin-left:8px; padding:2px 8px; font-size:12px;" title="테이블 설명 수정">편집</button>
    `;

    let columnsHtml = '';
    columns.forEach(col => {
        let typeInfo = col.data_type;
        if (col.character_maximum_length) {
            typeInfo += `(${col.character_maximum_length})`;
        }

        const isNullable = col.is_nullable === 'YES';
        const nullableClass = isNullable ? 'yes' : 'no';
        const nullableText = isNullable ? 'NULL' : 'NOT NULL';
        const defaultValue = (col.column_default || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const colComment = (col.column_comment || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const colCommentRaw = col.column_comment || '';

        columnsHtml += `
            <tr>
                <td class="col-name">${col.column_name}</td>
                <td class="col-type">${typeInfo}</td>
                <td class="col-null"><span class="column-nullable ${nullableClass}">${nullableText}</span></td>
                <td class="col-default" title="${defaultValue}">${defaultValue.length > 20 ? defaultValue.substring(0, 20) + '...' : defaultValue}</td>
                <td class="col-comment editable-col-comment" data-column="${col.column_name}" data-comment="${colCommentRaw.replace(/"/g, '&quot;')}" title="클릭하여 설명 수정">${colComment}</td>
            </tr>
        `;
    });

    // 데이터 미리보기 HTML 생성
    const idColumn = columns.find(c => c.column_name === 'id');
    const hasId = !!idColumn;
    const columnNames = columns.map(c => c.column_name);

    let dataPreviewHtml = '';
    if (rows.length > 0 || true) { // 데이터가 없어도 헤더는 표시 (컬럼 선택 등을 위해)
        // Action Buttons
        const actionsHtml = hasId
            ? `
                <div class="table-data-preview-actions">
                    <button class="btn btn-sm btn-danger" id="tableDataDeleteSelectedBtn">선택 삭제</button>
                </div>
            `
            : `<div class="table-data-preview-actions"><span class="table-detail-subtext">※ 수정/삭제 불가 (ID 없음)</span></div>`;

        // Table Header
        const headerCells = columnNames.map((name, i) => {
            const displayStyle = currentTable.hiddenColumns.has(i) ? 'display: none;' : '';
            return `<th class="col-idx-${i}" style="${displayStyle}">${name}</th>`;
        }).join('');

        const headerHtml =
            (hasId ? '<th width="5%"><input type="checkbox" id="tableDataSelectAll"></th>' : '') +
            headerCells +
            (hasId ? '<th class="col-action">관리</th>' : '');

        // Table Body
        let bodyHtml = '';
        if (rows.length === 0) {
            const colSpan = columnNames.length + (hasId ? 2 : 0);
            bodyHtml = `<tr><td colspan="${colSpan}" class="text-center">데이터가 없습니다.</td></tr>`;
        } else {
            bodyHtml = rows.map((row, rowIndex) => {
                const idValue = hasId ? row[idColumn.column_name] : null;
                const checkboxTd = hasId
                    ? `<td><input type="checkbox" class="table-data-row-checkbox" data-row-id="${idValue}"></td>`
                    : '';

                // Inline Edit: dblclick event on cells
                // Action column: Only Delete button now
                const actionTd = hasId
                    ? `<td class="col-action">
                        <button class="btn btn-sm btn-danger" onclick="deleteRow('${idValue}')">삭제</button>
                       </td>`
                    : '';

                // Cells with double-click edit
                const editCells = columnNames.map((name, i) => {
                    const value = row[name];
                    const displayStyle = currentTable.hiddenColumns.has(i) ? 'display: none;' : '';
                    let displayValue = '-';
                    let fullValue = '';

                    if (value !== null && value !== undefined) {
                        const str = String(value);
                        fullValue = str;
                        displayValue = str.length > 50 ? str.substring(0, 50) + '…' : str;
                    }

                    // ID나 timestamp는 편집 제외할 수도 있지만, enableInlineEdit 내부에서 가드함.
                    // 여기서는 이벤트 핸들러 다 붙임.
                    return `<td class="col-idx-${i} clickable-cell" style="${displayStyle}; cursor: cell;" title="${fullValue.replace(/"/g, '&quot;')}" ondblclick="enableInlineEdit(this, '${idValue}', '${name}')">${displayValue}</td>`;
                }).join('');

                return `<tr>${checkboxTd}${editCells}${actionTd}</tr>`;
            }).join('');
        }

        dataPreviewHtml = `
            <div class="table-data-preview">
                <div class="table-data-preview-header">
                    <h4>📄 테이블 데이터 (최대 100건)</h4>
                    ${actionsHtml}
                </div>
                <div class="table-responsive">
                    <table class="detail-table">
                        <thead>
                            <tr>
                                ${headerHtml}
                            </tr>
                        </thead>
                        <tbody>
                            ${bodyHtml}
                        </tbody>
                    </table>
                    <div style="margin-top: 8px; font-size: 0.9em; color: #666;">
                        💡 팁: 셀을 더블 클릭하면 데이터를 바로 수정할 수 있습니다. (엔터: 저장, ESC: 취소)
                    </div>
                </div>
            </div>
        `;
    }

    detailInfo.innerHTML = `
        <div class="table-detail-header-wrapper">
            <div class="table-detail-header">
                <h3>
                    🗄️ ${table.table_name}
                    ${commentHtml}
                </h3>
                <span class="table-detail-badge">${table.column_count} 컬럼</span>
            </div>
        </div>
        <div class="table-responsive" style="max-height: 300px; overflow-y: auto; margin-bottom: 20px;">
            <table class="detail-table">
                <thead>
                    <tr>
                        <th width="20%">컬럼명</th>
                        <th width="20%">데이터 타입</th>
                        <th width="15%">NULL 허용</th>
                        <th width="20%">기본값</th>
                        <th width="25%">설명</th>
                    </tr>
                </thead>
                <tbody>
                    ${columnsHtml}
                </tbody>
            </table>
        </div>
        ${dataPreviewHtml}
    `;

    // 테이블 설명 편집 버튼
    const tableEditBtn = detailInfo.querySelector('.btn-edit-comment');
    if (tableEditBtn) {
        tableEditBtn.addEventListener('click', function () {
            const tableName = currentTable.name;
            const displayEl = document.getElementById('tableCommentDisplay');
            if (!displayEl) return;
            const currentText = currentTable.tableInfo && currentTable.tableInfo.table_comment ? currentTable.tableInfo.table_comment : '';
            const wrap = displayEl.parentElement;
            const ta = document.createElement('textarea');
            ta.value = currentText;
            ta.rows = 2;
            ta.style.width = '100%';
            ta.style.maxWidth = '400px';
            ta.style.display = 'block';
            ta.style.marginBottom = '6px';
            const btnSave = document.createElement('button');
            btnSave.type = 'button';
            btnSave.className = 'btn btn-sm btn-primary';
            btnSave.textContent = '저장';
            const btnCancel = document.createElement('button');
            btnCancel.type = 'button';
            btnCancel.className = 'btn btn-sm btn-secondary';
            btnCancel.textContent = '취소';
            btnCancel.style.marginLeft = '6px';
            displayEl.style.display = 'none';
            tableEditBtn.style.display = 'none';
            wrap.appendChild(ta);
            wrap.appendChild(btnSave);
            wrap.appendChild(btnCancel);
            const cleanup = () => {
                wrap.removeChild(ta);
                wrap.removeChild(btnSave);
                wrap.removeChild(btnCancel);
                displayEl.style.display = '';
                tableEditBtn.style.display = '';
            };
            btnCancel.addEventListener('click', () => { cleanup(); });
            btnSave.addEventListener('click', async () => {
                try {
                    const res = await fetch(`/api/admin/database/tables/${tableName}/comment`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ comment: ta.value })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || '저장 실패');
                    if (currentTable.tableInfo) currentTable.tableInfo.table_comment = ta.value;
                    displayEl.textContent = ta.value || '(설명 없음)';
                    cleanup();
                } catch (err) {
                    alert('설명 저장 실패: ' + err.message);
                }
            });
        });
    }

    // 컬럼 설명 클릭 편집
    detailInfo.querySelectorAll('.editable-col-comment').forEach(td => {
        td.style.cursor = 'pointer';
        td.addEventListener('click', function (e) {
            if (this.querySelector('input')) return;
            const tableName = currentTable.name;
            const columnName = this.getAttribute('data-column');
            const currentComment = this.getAttribute('data-comment') || '';
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentComment === '-' ? '' : currentComment;
            input.style.width = '100%';
            input.style.padding = '4px 6px';
            input.style.boxSizing = 'border-box';
            const origHtml = this.innerHTML;
            this.innerHTML = '';
            this.appendChild(input);
            input.focus();
            const save = async () => {
                const val = input.value.trim();
                try {
                    const res = await fetch(`/api/admin/database/tables/${tableName}/columns/${columnName}/comment`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ comment: val })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || '저장 실패');
                    const col = currentTable.columns.find(c => c.column_name === columnName);
                    if (col) col.column_comment = val;
                    this.innerHTML = (val || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    this.setAttribute('data-comment', val);
                } catch (err) {
                    alert('컬럼 설명 저장 실패: ' + err.message);
                }
            };
            input.addEventListener('blur', save);
            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') { ev.preventDefault(); save(); }
                if (ev.key === 'Escape') {
                    this.innerHTML = origHtml;
                    this.setAttribute('data-comment', currentComment);
                    detailInfo.querySelectorAll('.editable-col-comment').forEach(cell => { cell.style.cursor = 'pointer'; });
                }
            });
        });
    });

    // 데이터 선택/삭제 이벤트 바인딩
    if (hasId && rows.length > 0) {
        const selectAllEl = detailInfo.querySelector('#tableDataSelectAll');
        const deleteBtn = detailInfo.querySelector('#tableDataDeleteSelectedBtn');
        const rowCheckboxes = detailInfo.querySelectorAll('.table-data-row-checkbox');

        if (selectAllEl && rowCheckboxes.length > 0) {
            selectAllEl.addEventListener('change', (e) => {
                const checked = e.target.checked;
                rowCheckboxes.forEach(cb => {
                    cb.checked = checked;
                });
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                const selectedIds = Array.from(rowCheckboxes)
                    .filter(cb => cb.checked)
                    .map(cb => cb.getAttribute('data-row-id'))
                    .filter(id => id);

                if (selectedIds.length === 0) {
                    alert('삭제할 행을 선택하세요.');
                    return;
                }

                if (!confirm(`선택한 ${selectedIds.length}개의 행을 삭제하시겠습니까?`)) {
                    return;
                }

                try {
                    const response = await fetch(`/api/admin/database/tables/${table.table_name}/rows`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ ids: selectedIds })
                    });

                    const result = await response.json();
                    if (!response.ok) {
                        alert(result.error || '행 삭제 중 오류가 발생했습니다.');
                        return;
                    }

                    alert(result.message || '선택한 행이 삭제되었습니다.');
                    // 삭제 후 테이블 정보 다시 로드
                    await loadTableDetails(table);
                } catch (error) {
                    console.error('행 삭제 오류:', error);
                    alert('행 삭제 중 오류가 발생했습니다.');
                }
            });
        }
    }
}

// 인라인 편집 활성화
window.enableInlineEdit = function (cell, rowId, colName) {
    if (cell.classList.contains('editing')) return;

    // Readonly 컬럼 체크
    if (colName === 'id' || colName === 'createdAt' || colName === 'updatedAt') {
        // 읽기 전용 컬럼은 편집 불가
        return;
    }

    const currentValue = cell.innerText === '-' ? '' : cell.innerText;
    const originalContent = cell.innerHTML;

    cell.classList.add('editing');
    cell.dataset.originalValue = currentValue; // 백업값 저장 (취소용보다는 값 비교용)

    // 입력 필드 생성
    // 데이터 타입에 따라 input type 결정 (여기서는 간단히 text/textarea)
    // colName으로 타입 추정 가능하지만, 현재 currentTable.columns에서 찾아야 함
    const colInfo = currentTable.columns.find(c => c.column_name === colName);
    let inputHtml;

    // 텍스트가 길거나 textarea가 필요한 경우
    if (colInfo && (colInfo.data_type === 'text' || (colInfo.character_maximum_length && colInfo.character_maximum_length > 100))) {
        inputHtml = `<textarea class="inline-edit-input form-control" style="width:100%; height: 100%; min-height: 60px;">${currentValue}</textarea>`;
    } else {
        inputHtml = `<input type="text" class="inline-edit-input form-control" value="${currentValue.replace(/"/g, '&quot;')}" style="width:100%;">`;
    }

    cell.innerHTML = inputHtml;

    const input = cell.querySelector('.inline-edit-input');
    input.focus();

    // 이벤트 리스너: 포커스 잃으면 저장, 엔터키 저장, ESC 취소
    input.addEventListener('blur', async () => {
        await saveInlineEdit(cell, rowId, colName, input.value);
    });

    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { // Shift+Enter는 개행 허용 (textarea)
            e.preventDefault();
            input.blur(); // blur 이벤트 트리거 -> 저장
        } else if (e.key === 'Escape') {
            // 취소: 원래 값으로 복구 (하지만 innerHTML은 이미 날라감, 텍스트로 복구)
            // 원래 HTML 구조 복잡도가 없으므로 텍스트로 충분
            cancelInlineEdit(cell, currentValue);
        }
    });

    // 클릭 이벤트 전파 방지 (테이블 클릭 등 방지)
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('dblclick', (e) => e.stopPropagation());
};

async function saveInlineEdit(cell, rowId, colName, newValue) {
    const originalValue = cell.dataset.originalValue;

    // 변경사항 없으면 복구하고 종료
    if (newValue === originalValue) {
        cancelInlineEdit(cell, newValue);
        return;
    }

    // UI 낙관적 업데이트 (Optimistic update) 또는 로딩 표시
    // 로딩 중 표시 대신 그냥 텍스트로 일단 변경해두고 실패시 롤백하거나,
    // 저장 중임을 표시. 여기서는 UX상 바로 텍스트로 보여주고 백그라운드 저장 시도.

    // 값 유효성 검사 등 필요한 경우 추가

    try {
        const updateData = {};
        updateData[colName] = newValue; // 빈 문자열도 그대로 전송

        // currentTable.name 사용
        const response = await fetch(`/api/admin/database/tables/${currentTable.name}/rows/${rowId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || '수정 실패');
        }

        // 성공 시 상태 업데이트
        cell.classList.remove('editing');
        const displayValue = String(newValue);
        cell.innerHTML = displayValue.length > 50 ? displayValue.substring(0, 50) + '…' : displayValue;
        cell.title = displayValue;
        cell.style.color = 'blue'; // 수정됨 표시 (선택사항)

        // 메모리상 데이터(rows) 업데이트
        const row = currentTable.rows.find(r => String(r.id) === String(rowId));
        if (row) {
            row[colName] = newValue;
        }

        // 성공 알림 (선택사항: 너무 빈번하면 귀찮음, 에러만 알림)
        // showMessage('adminMessage', '저장됨'); // adminMessage 요소가 있다면

    } catch (error) {
        console.error('인라인 수정 오류:', error);
        alert(`저장 실패: ${error.message}`);
        cancelInlineEdit(cell, originalValue); // 실패 시 원복
    }
}

function cancelInlineEdit(cell, value) {
    cell.classList.remove('editing');
    const displayValue = String(value);
    cell.innerHTML = displayValue.length > 50 ? displayValue.substring(0, 50) + '…' : displayValue;
    cell.title = displayValue;
}

// 컬럼 선택 모달 열기
function openSelectColumnModal() {
    const modal = document.getElementById('selectColumnModal');
    const container = document.getElementById('columnListContainer');

    if (!modal || !container) return;

    container.innerHTML = '';

    currentTable.columns.forEach((col, index) => {
        const isChecked = !currentTable.hiddenColumns.has(index);
        const div = document.createElement('div');
        div.className = 'column-select-item';
        div.innerHTML = `
            <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" data-col-index="${index}" ${isChecked ? 'checked' : ''} style="margin-right: 8px;">
                <span>${col.column_name}</span>
            </label>
        `;
        container.appendChild(div);
    });

    modal.classList.add('show');
}

function closeSelectColumnModal() {
    document.getElementById('selectColumnModal').classList.remove('show');
}

function toggleAllColumns(check) {
    const checkboxes = document.querySelectorAll('#columnListContainer input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = check);
}

function applyColumnSelection() {
    const checkboxes = document.querySelectorAll('#columnListContainer input[type="checkbox"]');

    // hiddenColumns 업데이트
    currentTable.hiddenColumns.clear();
    checkboxes.forEach(cb => {
        if (!cb.checked) {
            currentTable.hiddenColumns.add(parseInt(cb.dataset.colIndex));
        }
    });

    // 테이블 다시 렌더링 (보이는 상태 업데이트)
    // 전체 리렌더링보다는 스타일 업데이트가 효율적이나, renderTableDetail이 빠르므로 재사용
    // 하지만 renderTableDetail은 테이블 정보 객체가 필요함. 
    // loadTableDetails에서 사용한 table 객체를 어딘가에 저장해두거나, 
    // currentTable 정보를 기반으로 재구성해서 호출해야 함.
    // 여기서는 DOM을 직접 조작.

    currentTable.columns.forEach((_, i) => {
        const display = currentTable.hiddenColumns.has(i) ? 'none' : '';
        const cells = document.querySelectorAll(`.col-idx-${i}`);
        cells.forEach(cell => cell.style.display = display);
    });

    closeSelectColumnModal();
}

// 데이터 수정 모달 열기
function openEditRowModal(rowIndex) {
    const row = currentTable.rows[rowIndex];
    const columns = currentTable.columns;
    if (!row || !columns) return;

    const id = row.id; // Assume id exists if we are here (button only shown if hasId)

    document.getElementById('editRowTableName').value = currentTable.name;
    document.getElementById('editRowId').value = id;

    const container = document.getElementById('editRowFields');
    container.innerHTML = '';

    columns.forEach(col => {
        const name = col.column_name;
        const value = row[name];
        const isReadOnly = name === 'id' || name === 'createdAt' || name === 'updatedAt';

        let initialValue = value === null || value === undefined ? '' : String(value);

        // 날짜 포맷 처리 (input type=datetime-local 호환)
        if (col.data_type.includes('timestamp') || col.data_type.includes('date')) {
            // 값이 있으면 ISO 형태의 앞부분만 잘라서 넣거나 처리 필요
            // 단순 텍스트로 보여주고 수정하게 하는 것이 안전할 수 있음 (포맷 이슈 방지)
            // 여기서는 text input으로 처리하되 readonly가 아니면 주의 문구 추가
        }

        let inputHtml = '';
        if (col.data_type === 'text' || (col.character_maximum_length && col.character_maximum_length > 200)) {
            inputHtml = `<textarea id="edit_field_${name}" name="${name}" class="form-control" rows="3" ${isReadOnly ? 'disabled' : ''}>${initialValue}</textarea>`;
        } else {
            inputHtml = `<input type="text" id="edit_field_${name}" name="${name}" class="form-control" value="${initialValue.replace(/"/g, '&quot;')}" ${isReadOnly ? 'disabled' : ''}>`;
        }

        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
            <label for="edit_field_${name}">${name} <span class="text-muted" style="font-size:0.8em">(${col.data_type})</span></label>
            ${inputHtml}
        `;
        container.appendChild(div);
    });

    document.getElementById('editRowModal').classList.add('show');
}

function closeEditRowModal() {
    document.getElementById('editRowModal').classList.remove('show');
}

// 데이터 수정 저장
document.addEventListener('DOMContentLoaded', () => {
    const editRowForm = document.getElementById('editRowForm');
    if (editRowForm) {
        editRowForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const tableName = document.getElementById('editRowTableName').value;
            const id = document.getElementById('editRowId').value;

            // 폼 데이터 수집
            const updateData = {};
            currentTable.columns.forEach(col => {
                const name = col.column_name;
                // Readonly 컬럼 제외
                if (name === 'id' || name === 'createdAt' || name === 'updatedAt') return;

                const input = document.getElementById(`edit_field_${name}`);
                if (input) {
                    // 빈 문자열은 null로 보낼지 문자열로 보낼지 결정 필요. 
                    // 일단 문자열로 보냄. 필요시 값 변환 로직 추가.
                    updateData[name] = input.value;
                }
            });

            try {
                const response = await fetch(`/api/admin/database/tables/${tableName}/rows/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });

                const result = await response.json();

                if (!response.ok) {
                    alert(result.error || '수정 중 오류가 발생했습니다.');
                    return;
                }

                alert('데이터가 수정되었습니다.');
                closeEditRowModal();
                // 테이블 리로드 (현재 테이블 이름 유지)
                loadTableDetails({ table_name: tableName, table_comment: '' });
                // Note: table_comment is lost here but loadTableDetails only uses table_name for fetching.
                // However, renderTableDetail needs table_comment if we fully reload.
                // We should store table metadata in currentTable to reuse.
                // But loadTableDetails re-fetches everything anyway. 
                // Actually loadDatabaseStructure passes the table object.
                // We can't easily recall loadTableDetails with full object unless we stored it.
                // Let's rely on loadTableDetails just using table_name for the fetch part, 
                // but the header rendering uses table object.
                // A better way: fetch table list again or just incomplete object.
                // Let's improve loadTableDetails to fetch table metadata if missing? 
                // Or just ignore comment update.
            } catch (error) {
                console.error('데이터 수정 오류:', error);
                alert('서버 오류가 발생했습니다.');
            }
        });
    }
});

// 회원 목록 로드
let allUsers = []; // 전체 사용자 데이터 저장

async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users');
        const data = await response.json();

        // system_admin(최고 관리자)는 목록에서 제외
        allUsers = data.users.filter(user => user.systemRole !== 'system_admin');

        // 필터링 및 렌더링
        filterAndRenderUsers();

    } catch (error) {
        console.error('회원 목록 로드 오류:', error);
    }
}

// 검색 및 필터 적용하여 사용자 렌더링
function filterAndRenderUsers() {
    const searchTerm = document.getElementById('userSearchInput')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('userStatusFilter')?.value || 'all';

    // 필터링
    let filteredUsers = allUsers.filter(user => {
        // 검색어 필터
        const matchesSearch =
            user.username.toLowerCase().includes(searchTerm) ||
            user.fullName.toLowerCase().includes(searchTerm) ||
            (user.phone && user.phone.includes(searchTerm));

        // 상태 필터
        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'active' && user.isActive) ||
            (statusFilter === 'inactive' && !user.isActive);

        return matchesSearch && matchesStatus;
    });

    // 테이블 렌더링
    const tbody = document.querySelector('#usersTable tbody');
    tbody.innerHTML = '';

    if (filteredUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading">검색 결과가 없습니다.</td></tr>';
        return;
    }

    filteredUsers.forEach(user => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.dataset.userId = user.id;

        const farmCount = user.userFarms ? user.userFarms.length : 0;
        const statusClass = user.isActive ? 'status-active' : 'status-inactive';
        const statusText = user.isActive ? '활성' : '비활성';

        row.innerHTML = `
            <td>${user.username}</td>
            <td>${user.fullName}</td>
            <td>${user.email}</td>
            <td>${user.phone || '-'}</td>
            <td><span class="badge">${getRoleText(user.systemRole)}</span></td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td><span class="user-farm-count-link" data-user-id="${user.id}" title="클릭하면 소속 농장 목록 보기">${farmCount}개</span></td>
            <td>${formatDate(user.createdAt)}</td>
            <td class="action-buttons">
                <button class="btn btn-sm btn-info" onclick="event.stopPropagation(); goToUserDashboard('${user.id}')">페이지 이동</button>
            </td>
        `;

        // 소속 농장 갯수 클릭 → 농장 목록 모달
        row.querySelector('.user-farm-count-link')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openUserFarmsModal(user);
        });

        // 행 클릭 이벤트 - 수정 모달 열기
        row.addEventListener('click', (e) => {
            if (!e.target.closest('.action-buttons') && !e.target.closest('.user-farm-count-link')) {
                showEditUserModal(user);
            }
        });

        tbody.appendChild(row);
    });
}

// 소속 농장 목록 모달 (회원정보 목록에서 소속농장 갯수 클릭 시)
let currentUserFarmsModalUserId = null;

function openUserFarmsModal(user) {
    const modal = document.getElementById('userFarmsModal');
    const titleEl = document.getElementById('userFarmsModalTitle');
    const bodyEl = document.getElementById('userFarmsModalBody');
    const emptyEl = document.getElementById('userFarmsModalEmpty');
    if (!modal || !titleEl || !bodyEl) return;
    currentUserFarmsModalUserId = user.id;
    titleEl.textContent = '소속 농장 목록 - ' + (user.fullName || user.username || '');
    bodyEl.innerHTML = '<tr><td colspan="4" class="loading">불러오는 중...</td></tr>';
    if (emptyEl) emptyEl.style.display = 'none';
    modal.classList.add('show');
    modal.style.display = 'flex';
    loadUserFarmsAndRender(user.id);
}

function closeUserFarmsModal() {
    const modal = document.getElementById('userFarmsModal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
    currentUserFarmsModalUserId = null;
}

async function loadUserFarmsAndRender(userId) {
    const bodyEl = document.getElementById('userFarmsModalBody');
    const emptyEl = document.getElementById('userFarmsModalEmpty');
    if (!bodyEl) return;
    try {
        const res = await fetch(`/api/admin/users/${userId}`);
        if (!res.ok) throw new Error('회원 정보 조회 실패');
        const data = await res.json();
        const user = data.user;
        const farms = (user.userFarms || []).map(uf => uf.farm).filter(Boolean);
        if (farms.length === 0) {
            bodyEl.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }
        if (emptyEl) emptyEl.style.display = 'none';
        bodyEl.innerHTML = farms.map(farm => {
            const status = farm.status || (farm.isActive ? 'ACTIVE' : 'INACTIVE');
            const isActive = status === 'ACTIVE';
            const statusText = isActive ? '운영중' : '중단';
            const statusClass = isActive ? 'status-active' : 'status-inactive';
            return `<tr>
                <td>${escapeHtml(farm.farmName || '-')}</td>
                <td>${escapeHtml(farm.farmCode || '-')}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    ${isActive
                ? `<button type="button" class="btn btn-sm btn-warning" onclick="setFarmStatusFromModal('${farm.id}', 'INACTIVE')">중단</button>`
                : `<button type="button" class="btn btn-sm btn-success" onclick="setFarmStatusFromModal('${farm.id}', 'ACTIVE')">활성화</button>`
            }
                </td>
            </tr>`;
        }).join('');
    } catch (e) {
        bodyEl.innerHTML = '<tr><td colspan="4" class="error">' + escapeHtml(e.message) + '</td></tr>';
        if (emptyEl) emptyEl.style.display = 'none';
    }
}

async function setFarmStatusFromModal(farmId, newStatus) {
    if (!currentUserFarmsModalUserId) return;
    const action = newStatus === 'ACTIVE' ? '활성화' : '중단';
    if (!confirm(`이 농장을 ${action}하시겠습니까?`)) return;
    try {
        const res = await fetch(`/api/farms/${farmId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || err.message || '상태 변경 실패');
        }
        alert(`농장이 ${action}되었습니다.`);
        loadUserFarmsAndRender(currentUserFarmsModalUserId);
    } catch (e) {
        alert(e.message || '상태 변경 중 오류가 발생했습니다.');
    }
}

// 농장 목록 로드
async function loadFarms() {
    try {
        const response = await fetch('/api/admin/farms');
        const data = await response.json();

        const tbody = document.querySelector('#farmsTable tbody');
        tbody.innerHTML = '';

        if (data.farms.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="loading">등록된 농장이 없습니다.</td></tr>';
            return;
        }

        data.farms.forEach(farm => {
            const row = document.createElement('tr');

            const staffCount = farm.farmUsers ? farm.farmUsers.length : 0;
            const statusClass = farm.isActive ? 'status-active' : 'status-inactive';
            const statusText = farm.isActive ? '운영중' : '중단';

            row.innerHTML = `
                <td>${farm.farmName}</td>
                <td>${farm.farmCode}</td>
                <td>${farm.owner ? farm.owner.fullName : '-'}</td>
                <td>${farm.address || '-'}</td>
                <td>${farm.phone || '-'}</td>
                <td>${staffCount}명</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>${formatDate(farm.createdAt)}</td>
            `;

            tbody.appendChild(row);
        });

    } catch (error) {
        console.error('농장 목록 로드 오류:', error);
    }
}

// 시스템 설정 로드
async function loadSettings() {
    try {
        const response = await fetch('/api/admin/settings');
        const data = await response.json();

        document.getElementById('settingSystemName').textContent = data.settings.systemName;
        document.getElementById('settingVersion').textContent = data.settings.version;
        document.getElementById('settingEnvironment').textContent = data.settings.environment;
        document.getElementById('settingDatabase').textContent = data.settings.database;

    } catch (error) {
        console.error('설정 로드 오류:', error);
    }
}

// 사용자 활성/비활성 토글
async function toggleUserActive(userId, isActive) {
    const action = isActive ? '비활성화' : '활성화';

    if (!confirm(`정말로 이 사용자를 ${action}하시겠습니까?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/users/${userId}/toggle-active`, {
            method: 'PATCH'
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            await loadUsers();
        } else {
            alert(data.error || '오류가 발생했습니다.');
        }
    } catch (error) {
        console.error('사용자 상태 변경 오류:', error);
        alert('서버 연결에 실패했습니다.');
    }
}

// 사용자 삭제
async function deleteUser(userId, username) {
    if (!confirm(`정말로 "${username}" 사용자를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            await loadUsers();
            await loadDashboard(); // 통계 업데이트
        } else {
            alert(data.error || '오류가 발생했습니다.');
        }
    } catch (error) {
        console.error('사용자 삭제 오류:', error);
        alert('서버 연결에 실패했습니다.');
    }
}

// 로그아웃
async function logout() {
    if (!confirm('로그아웃하시겠습니까?')) {
        return;
    }

    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login.html';
    } catch (error) {
        console.error('로그아웃 오류:', error);
        window.location.href = '/login.html';
    }
}

// 모달 열기
function openModal(title, content) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;
    document.getElementById('modal').classList.add('show');
}

// 모달 닫기
function closeModal() {
    document.getElementById('modal').classList.remove('show');
}

// 유틸리티 함수
function getRoleText(role) {
    const roles = {
        'super_admin': '최고 관리자',
        'user': '일반 사용자',
        'farm_admin': '농장 관리자',
        'owner': '농장주',
        'manager': '관리자',
        'veterinarian': '수의사',
        'breeder': '사육사',
        'staff': '직원',
        'consultant': '컨설턴트'
    };
    return roles[role] || role;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// 회원 추가 모달 열기
function showAddUserModal() {
    document.getElementById('addUserModal').classList.add('show');
    document.getElementById('addUserForm').reset();
    hideMessage('addUserMessage');
}

// 회원 추가 모달 닫기
function closeAddUserModal() {
    document.getElementById('addUserModal').classList.remove('show');
    document.getElementById('addUserForm').reset();
    hideMessage('addUserMessage');
}

// 회원 추가 폼 제출 + 권한(직책) 추가 폼 제출
document.addEventListener('DOMContentLoaded', () => {
    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) {
        addUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('newUsername').value.trim();
            const email = document.getElementById('newEmail').value.trim();
            const password = document.getElementById('newPassword').value;
            const fullName = document.getElementById('newFullName').value.trim();
            const phone = document.getElementById('newPhone').value.trim();

            // 유효성 검사
            if (password.length < 8) {
                showMessage('addUserMessage', '비밀번호는 최소 8자 이상이어야 합니다.', 'error');
                return;
            }

            try {
                // 관리자 페이지에서 회원 추가 시 전용 API 호출 (농장 운영 관리자 등록)
                const response = await fetch('/api/admin/users', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username,
                        email,
                        password,
                        fullName,
                        phone
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    showMessage('addUserMessage', '회원이 성공적으로 등록되었습니다!', 'success');

                    // 2초 후 모달 닫고 목록 새로고침
                    setTimeout(async () => {
                        closeAddUserModal();
                        await loadUsers();
                        await loadDashboard(); // 통계 업데이트
                    }, 2000);
                } else {
                    showMessage('addUserMessage', data.error || '회원 등록에 실패했습니다.', 'error');
                }
            } catch (error) {
                console.error('회원 등록 오류:', error);
                showMessage('addUserMessage', '서버 연결에 실패했습니다.', 'error');
            }
        });
    }

    // 권한(직책) 추가 폼 제출
    const addRoleForm = document.getElementById('addRoleForm');
    if (addRoleForm) {
        addRoleForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const code = document.getElementById('newRoleCode').value.trim();
            const name = document.getElementById('newRoleName').value.trim();
            const description = document.getElementById('newRoleDescription').value.trim();
            const levelRaw = document.getElementById('newRoleLevel').value;
            const isDefault = document.getElementById('newRoleIsDefault').checked;
            const isActive = document.getElementById('newRoleIsActive').checked;

            if (!code || !name) {
                showMessage('addRoleMessage', '코드와 직책명은 필수입니다.', 'error');
                return;
            }

            const level = levelRaw ? Number(levelRaw) : 10;

            try {
                const response = await fetch('/api/roles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code,
                        name,
                        description,
                        level,
                        isDefault,
                        isActive
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    showMessage('addRoleMessage', data.error || '권한(직책) 추가 중 오류가 발생했습니다.', 'error');
                    return;
                }

                showMessage('addRoleMessage', '권한(직책)이 성공적으로 추가되었습니다.', 'success');
                loadRoles(); // 목록 갱신
                setTimeout(() => {
                    closeAddRoleModal();
                }, 800);
            } catch (error) {
                console.error('권한 추가 오류:', error);
                showMessage('addRoleMessage', '서버 연결에 실패했습니다.', 'error');
            }
        });
    }
});

// 메시지 표시 함수
function showMessage(elementId, message, type) {
    const messageEl = document.getElementById(elementId);
    if (messageEl) {
        messageEl.textContent = message;
        messageEl.className = `message show ${type}`;
    }
}

// 메시지 숨김 함수
function hideMessage(elementId) {
    const messageEl = document.getElementById(elementId);
    if (messageEl) {
        messageEl.className = 'message';
    }
}

// 회원 수정 모달 열기
function showEditUserModal(user) {
    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUsername').value = user.username;
    document.getElementById('editEmail').value = user.email;
    document.getElementById('editFullName').value = user.fullName;
    document.getElementById('editPhone').value = user.phone || '';
    document.getElementById('editPassword').value = '';

    // 계정 관리 버튼 설정
    const btnToggle = document.getElementById('btnToggleActive');
    const btnDelete = document.getElementById('btnDeleteUser');

    if (btnToggle && btnDelete) {
        btnToggle.textContent = user.isActive ? '계정 비활성화' : '계정 활성화';
        btnToggle.className = user.isActive ? 'btn btn-warning full-width' : 'btn btn-success full-width';

        // 이벤트 핸들러 설정 (onclick 프로퍼티 사용으로 중복 방지)
        btnToggle.onclick = async () => {
            await toggleUserActive(user.id, user.isActive);
            closeEditUserModal();
        };

        btnDelete.onclick = async () => {
            await deleteUser(user.id, user.username);
            closeEditUserModal();
        };
    }

    document.getElementById('editUserModal').classList.add('show');
    hideMessage('editUserMessage');
}

// 회원 수정 모달 닫기
function closeEditUserModal() {
    document.getElementById('editUserModal').classList.remove('show');
    document.getElementById('editUserForm').reset();
    hideMessage('editUserMessage');
}

// 내 프로필 수정 모달 열기
function showMyProfileModal() {
    if (currentUser) {
        showEditUserModal(currentUser);
    }
}

// 회원 수정 폼 제출
document.addEventListener('DOMContentLoaded', () => {
    const editUserForm = document.getElementById('editUserForm');
    if (editUserForm) {
        editUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const userId = document.getElementById('editUserId').value;
            const email = document.getElementById('editEmail').value.trim();
            const password = document.getElementById('editPassword').value;
            const fullName = document.getElementById('editFullName').value.trim();
            const phone = document.getElementById('editPhone').value.trim();

            // 비밀번호 유효성 검사 (입력된 경우에만)
            if (password && password.length < 8) {
                showMessage('editUserMessage', '비밀번호는 최소 8자 이상이어야 합니다.', 'error');
                return;
            }

            try {
                const response = await fetch(`/api/admin/users/${userId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email,
                        password: password || undefined,
                        fullName,
                        phone
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    showMessage('editUserMessage', '회원 정보가 성공적으로 수정되었습니다!', 'success');

                    // 내 프로필 수정인 경우 currentUser 업데이트
                    if (currentUser && currentUser.id === userId) {
                        currentUser = data.user;
                        document.getElementById('userInfo').textContent = `${data.user.fullName} (${data.user.username})`;
                    }

                    // 2초 후 모달 닫고 목록 새로고침
                    setTimeout(async () => {
                        closeEditUserModal();
                        await loadUsers();
                    }, 2000);
                } else {
                    showMessage('editUserMessage', data.error || '회원 정보 수정에 실패했습니다.', 'error');
                }
            } catch (error) {
                console.error('회원 정보 수정 오류:', error);
                showMessage('editUserMessage', '서버 연결에 실패했습니다.', 'error');
            }
        });
    }
});


// 사용자 대시보드로 이동 (농장 선택 화면)
function goToUserDashboard(userId) {
    window.location.href = `/select-farm.html?userId=${userId}`;
}

// 사용자 관리자 페이지로 이동 (농장 관리 화면)
function goToUserAdmin(userId) {
    window.location.href = `/farm_admin.html?userId=${userId}`;
}

// 시스템 설정 탭 전환
function showSettingsTab(tabName, element) {
    // 모든 설정 컨텐츠 숨기기
    document.querySelectorAll('.settings-content').forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
    });

    // 선택된 탭 컨텐츠 보이기
    const selectedContent = document.getElementById(`settings-${tabName}-content`);
    if (selectedContent) {
        selectedContent.style.display = 'block';
        selectedContent.classList.add('active'); // active 클래스 추가 (필요시 CSS 활용)
    }

    // 서브 메뉴 활성화 상태 업데이트
    if (element) {
        document.querySelectorAll('#navSettingsList .nav-sub-item').forEach(item => {
            item.classList.remove('active');
        });
        element.classList.add('active');
    }

    // 탭별 데이터 로드
    if (tabName === 'breed') {
        loadBreeds();
    } else if (tabName === 'feed') {
        loadFeedTypes();
    } else if (tabName === 'vaccine') {
        loadVaccineTypes();
    } else if (tabName === 'disease') {
        loadDiseaseCodes();
    } else if (tabName === 'structure') {
        loadStructureTemplates();
    } else if (tabName === 'schedule') {
        loadScheduleSettings();
    }
}

// 회원 관리 탭 전환 (회원 정보 / 권한(직책) 현황)
function showUsersTab(tabName, element) {
    const infoContent = document.getElementById('users-info-content');
    const rolesContent = document.getElementById('users-roles-content');

    if (infoContent && rolesContent) {
        if (tabName === 'roles') {
            infoContent.style.display = 'none';
            rolesContent.style.display = 'block';
            // 권한(직책) 데이터 로드
            loadRoles();
        } else {
            infoContent.style.display = 'block';
            rolesContent.style.display = 'none';
        }
    }

    // 서브 메뉴 활성화 표시
    if (element) {
        document.querySelectorAll('#navUsersList .nav-sub-item').forEach(item => {
            item.classList.remove('active');
        });
        element.classList.add('active');
    }
}

// 권한(직책) 목록 로드
async function loadRoles() {
    const tbody = document.querySelector('#rolesTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="loading">데이터를 불러오는 중...</td></tr>';

    try {
        const res = await fetch('/api/roles');
        if (!res.ok) throw new Error('권한 목록을 불러오지 못했습니다.');
        const data = await res.json();
        const roles = data.roles || [];

        if (!roles.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading">등록된 권한(직책)이 없습니다.</td></tr>';
            return;
        }

        tbody.innerHTML = roles.map(role => `
            <tr>
                <td><span class="badge badge-secondary">${role.code}</span></td>
                <td>${role.name}</td>
                <td style="max-width:280px;" class="text-small">${role.description || '-'}</td>
                <td>${role.level}</td>
                <td>${role.isDefault ? '예' : '아니오'}</td>
                <td>${role.isActive ? '사용' : '중지'}</td>
                <td>
                    <!-- 추후 수정/삭제 기능 추가 예정 -->
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('권한 목록 로드 오류:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="loading">권한 목록을 불러오는 중 오류가 발생했습니다.</td></tr>';
    }
}

// 권한 추가 모달 열기
function openAddRoleModal() {
    const form = document.getElementById('addRoleForm');
    if (form) form.reset();
    // 기본값 다시 세팅
    const levelInput = document.getElementById('newRoleLevel');
    const isActiveInput = document.getElementById('newRoleIsActive');
    if (levelInput && !levelInput.value) levelInput.value = 10;
    if (isActiveInput) isActiveInput.checked = true;
    hideMessage('addRoleMessage');
    document.getElementById('addRoleModal').classList.add('show');
}

// 권한 추가 모달 닫기
function closeAddRoleModal() {
    document.getElementById('addRoleModal').classList.remove('show');
}

// ==========================================
// 품종 관리 로직
// ==========================================

let breeds = [];

// 품종 목록 불러오기
async function loadBreeds() {
    const tableBody = document.getElementById('breedsTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="7" class="loading">데이터를 불러오는 중...</td></tr>';

    try {
        const response = await fetch('/api/breeds');
        if (!response.ok) throw new Error('데이터 로드 실패');

        breeds = await response.json();
        renderBreedsTable();
    } catch (error) {
        console.error('품종 로드 오류:', error);
        tableBody.innerHTML = '<tr><td colspan="7" class="error">데이터를 불러오는데 실패했습니다.</td></tr>';
    }
}

// 품종 테이블 렌더링
function renderBreedsTable() {
    const tableBody = document.getElementById('breedsTableBody');
    if (!tableBody) return;

    if (breeds.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="no-data">등록된 품종이 없습니다.</td></tr>';
        return;
    }

    tableBody.innerHTML = breeds.map(breed => `
        <tr>
            <td><span class="badge badge-primary">${breed.code}</span></td>
            <td class="font-medium">${breed.nameKo}</td>
            <td class="text-gray">${breed.nameEn || '-'}</td>
            <td class="text-small" style="max-width: 200px;">${breed.description || '-'}</td>
            <td class="text-small" style="max-width: 200px;">${breed.characteristics || '-'}</td>
            <td>${breed.usage || '-'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-secondary" onclick="openEditBreedModal(${breed.id})">수정</button>
                    ${breed.id > 7 ? `<button class="btn btn-sm btn-danger" onclick="deleteBreed(${breed.id})">삭제</button>` : ''} 
                </div>
            </td>
        </tr>
    `).join('');
}

// 품종 추가 모달 열기
function openAddBreedModal() {
    document.getElementById('addBreedForm').reset();
    document.getElementById('addBreedModal').classList.add('show');
}

// 품종 추가 모달 닫기
function closeAddBreedModal() {
    document.getElementById('addBreedModal').classList.remove('show');
}

// 품종 수정 모달 열기
function openEditBreedModal(id) {
    const breed = breeds.find(b => b.id === id);
    if (!breed) return;

    document.getElementById('editBreedId').value = breed.id;
    document.getElementById('editBreedCode').value = breed.code;
    document.getElementById('editBreedNameKo').value = breed.nameKo;
    document.getElementById('editBreedNameEn').value = breed.nameEn || '';
    document.getElementById('editBreedDescription').value = breed.description || '';
    document.getElementById('editBreedCharacteristics').value = breed.characteristics || '';
    document.getElementById('editBreedUsage').value = breed.usage || '';

    // 코드 수정 불가 (선택사항, 보통 PK나 유니크 키는 수정 제한)
    // document.getElementById('editBreedCode').readOnly = true;

    document.getElementById('editBreedModal').classList.add('show');
}

// 품종 수정 모달 닫기
function closeEditBreedModal() {
    document.getElementById('editBreedModal').classList.remove('show');
}

// 이벤트 리스너: 품종 추가
document.addEventListener('DOMContentLoaded', () => {
    const addBreedForm = document.getElementById('addBreedForm');
    if (addBreedForm) {
        addBreedForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = {
                code: document.getElementById('newBreedCode').value,
                nameKo: document.getElementById('newBreedNameKo').value,
                nameEn: document.getElementById('newBreedNameEn').value,
                description: document.getElementById('newBreedDescription').value,
                characteristics: document.getElementById('newBreedCharacteristics').value,
                usage: document.getElementById('newBreedUsage').value
            };

            try {
                const response = await fetch('/api/breeds', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '추가 실패');
                }

                alert('품종이 추가되었습니다.');
                closeAddBreedModal();
                loadBreeds();
            } catch (error) {
                alert(error.message);
            }
        });
    }

    // 이벤트 리스너: 품종 수정
    const editBreedForm = document.getElementById('editBreedForm');
    if (editBreedForm) {
        editBreedForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = document.getElementById('editBreedId').value;
            const formData = {
                code: document.getElementById('editBreedCode').value,
                nameKo: document.getElementById('editBreedNameKo').value,
                nameEn: document.getElementById('editBreedNameEn').value,
                description: document.getElementById('editBreedDescription').value,
                characteristics: document.getElementById('editBreedCharacteristics').value,
                usage: document.getElementById('editBreedUsage').value
            };

            try {
                const response = await fetch(`/api/breeds/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '수정 실패');
                }

                alert('품종 정보가 수정되었습니다.');
                closeEditBreedModal();
                loadBreeds();
            } catch (error) {
                alert(false);
            }
        });
    }
});


// 품종 삭제
async function deleteBreed(id) {
    if (!confirm('정말 이 품종을 삭제하시겠습니까?')) return;

    try {
        const response = await fetch(`/api/breeds/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '삭제 실패');
        }

        alert('품종이 삭제되었습니다.');
        loadBreeds();
    } catch (error) {
        alert(error.message);
    }
}

// ==========================================
// 사료 종류 관리 로직
// ==========================================

let feedTypes = [];

// 사료 목록 불러오기
async function loadFeedTypes() {
    const tableBody = document.getElementById('feedTypesTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="6" class="loading">데이터를 불러오는 중...</td></tr>';

    try {
        const response = await fetch('/api/feedTypes');
        if (!response.ok) throw new Error('데이터 로드 실패');

        feedTypes = await response.json();
        renderFeedTypesTable();
    } catch (error) {
        console.error('사료 로드 오류:', error);
        tableBody.innerHTML = '<tr><td colspan="6" class="error">데이터를 불러오는데 실패했습니다.</td></tr>';
    }
}

// 사료 테이블 렌더링
function renderFeedTypesTable() {
    const tableBody = document.getElementById('feedTypesTableBody');
    if (!tableBody) return;

    if (feedTypes.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="no-data">등록된 사료가 없습니다.</td></tr>';
        return;
    }

    tableBody.innerHTML = feedTypes.map(feed => `
        <tr>
            <td class="font-medium">${feed.name}</td>
            <td>${feed.manufacturer || '-'}</td>
            <td>${feed.targetStage || '-'}</td>
            <td class="text-small" style="max-width: 200px;">${feed.description || '-'}</td>
            <td class="text-small" style="max-width: 200px;">${feed.nutrients || '-'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-secondary" onclick="openEditFeedModal(${feed.id})">수정</button>
                    ${feed.id > 6 ? `<button class="btn btn-sm btn-danger" onclick="deleteFeedType(${feed.id})">삭제</button>` : ''} 
                </div>
            </td>
        </tr>
    `).join('');
}

// 사료 추가 모달 열기
function openAddFeedModal() {
    document.getElementById('addFeedForm').reset();
    document.getElementById('addFeedModal').classList.add('show');
}

// 사료 추가 모달 닫기
function closeAddFeedModal() {
    document.getElementById('addFeedModal').classList.remove('show');
}

// 사료 수정 모달 열기
function openEditFeedModal(id) {
    const feed = feedTypes.find(f => f.id === id);
    if (!feed) return;

    document.getElementById('editFeedId').value = feed.id;
    document.getElementById('editFeedName').value = feed.name;
    document.getElementById('editFeedManufacturer').value = feed.manufacturer || '';
    document.getElementById('editFeedTargetStage').value = feed.targetStage || '';
    document.getElementById('editFeedDescription').value = feed.description || '';
    document.getElementById('editFeedNutrients').value = feed.nutrients || '';

    document.getElementById('editFeedModal').classList.add('show');
}

// 사료 수정 모달 닫기
function closeEditFeedModal() {
    document.getElementById('editFeedModal').classList.remove('show');
}

// 사료 추가 및 수정 이벤트 리스너
document.addEventListener('DOMContentLoaded', () => {
    // 사료 추가
    const addFeedForm = document.getElementById('addFeedForm');
    if (addFeedForm) {
        addFeedForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = {
                name: document.getElementById('newFeedName').value,
                manufacturer: document.getElementById('newFeedManufacturer').value,
                targetStage: document.getElementById('newFeedTargetStage').value,
                description: document.getElementById('newFeedDescription').value,
                nutrients: document.getElementById('newFeedNutrients').value
            };

            try {
                const response = await fetch('/api/feedTypes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '추가 실패');
                }

                alert('사료가 추가되었습니다.');
                closeAddFeedModal();
                loadFeedTypes();
            } catch (error) {
                alert(error.message);
            }
        });
    }

    // 사료 수정
    const editFeedForm = document.getElementById('editFeedForm');
    if (editFeedForm) {
        editFeedForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = document.getElementById('editFeedId').value;
            const formData = {
                name: document.getElementById('editFeedName').value,
                manufacturer: document.getElementById('editFeedManufacturer').value,
                targetStage: document.getElementById('editFeedTargetStage').value,
                description: document.getElementById('editFeedDescription').value,
                nutrients: document.getElementById('editFeedNutrients').value
            };

            try {
                const response = await fetch(`/api/feedTypes/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '수정 실패');
                }

                alert('사료 정보가 수정되었습니다.');
                closeEditFeedModal();
                loadFeedTypes();
            } catch (error) {
                alert(error.message);
            }
        });
    }
});

// 사료 삭제
async function deleteFeedType(id) {
    if (!confirm('정말 이 사료를 삭제하시겠습니까?')) return;

    try {
        const response = await fetch(`/api/feedTypes/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '삭제 실패');
        }

        alert('사료가 삭제되었습니다.');
        loadFeedTypes();
    } catch (error) {
        alert(error.message);
    }
}

// ==========================================
// 백신 종류 관리 로직
// ==========================================

let vaccineTypes = [];

// 백신 목록 불러오기
async function loadVaccineTypes() {
    const tableBody = document.getElementById('vaccineTypesTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="7" class="loading">데이터를 불러오는 중...</td></tr>';

    try {
        const response = await fetch('/api/vaccineTypes');
        if (!response.ok) throw new Error('데이터 로드 실패');

        vaccineTypes = await response.json();
        renderVaccineTypesTable();
    } catch (error) {
        console.error('백신 로드 오류:', error);
        tableBody.innerHTML = '<tr><td colspan="7" class="error">데이터를 불러오는데 실패했습니다.</td></tr>';
    }
}

// 백신 테이블 렌더링
function renderVaccineTypesTable() {
    const tableBody = document.getElementById('vaccineTypesTableBody');
    if (!tableBody) return;

    if (vaccineTypes.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="no-data">등록된 백신이 없습니다.</td></tr>';
        return;
    }

    tableBody.innerHTML = vaccineTypes.map(v => `
        <tr>
            <td class="font-medium">${v.name}</td>
            <td>${v.targetDisease}</td>
            <td>${v.manufacturer || '-'}</td>
            <td>${v.method || '-'} / ${v.dosage || '-'}</td>
            <td>${v.timing || '-'}</td>
            <td class="text-small" style="max-width: 200px;">${v.description || '-'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-secondary" onclick="openEditVaccineModal(${v.id})">수정</button>
                    ${v.id > 8 ? `<button class="btn btn-sm btn-danger" onclick="deleteVaccineType(${v.id})">삭제</button>` : ''} 
                </div>
            </td>
        </tr>
    `).join('');
}

// 백신 추가 모달 열기
function openAddVaccineModal() {
    document.getElementById('addVaccineForm').reset();
    document.getElementById('addVaccineModal').classList.add('show');
}

// 백신 추가 모달 닫기
function closeAddVaccineModal() {
    document.getElementById('addVaccineModal').classList.remove('show');
}

// 백신 수정 모달 열기
function openEditVaccineModal(id) {
    const vaccine = vaccineTypes.find(v => v.id === id);
    if (!vaccine) return;

    document.getElementById('editVaccineId').value = vaccine.id;
    document.getElementById('editVaccineName').value = vaccine.name;
    document.getElementById('editVaccineTarget').value = vaccine.targetDisease;
    document.getElementById('editVaccineManufacturer').value = vaccine.manufacturer || '';
    document.getElementById('editVaccineMethod').value = vaccine.method || '';
    document.getElementById('editVaccineDosage').value = vaccine.dosage || '';
    document.getElementById('editVaccineTiming').value = vaccine.timing || '';
    document.getElementById('editVaccineDescription').value = vaccine.description || '';

    document.getElementById('editVaccineModal').classList.add('show');
}

// 백신 수정 모달 닫기
function closeEditVaccineModal() {
    document.getElementById('editVaccineModal').classList.remove('show');
}

// 백신 추가 및 수정 이벤트 리스너
document.addEventListener('DOMContentLoaded', () => {
    // 백신 추가
    const addVaccineForm = document.getElementById('addVaccineForm');
    if (addVaccineForm) {
        addVaccineForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = {
                name: document.getElementById('newVaccineName').value,
                targetDisease: document.getElementById('newVaccineTarget').value,
                manufacturer: document.getElementById('newVaccineManufacturer').value,
                method: document.getElementById('newVaccineMethod').value,
                dosage: document.getElementById('newVaccineDosage').value,
                timing: document.getElementById('newVaccineTiming').value,
                description: document.getElementById('newVaccineDescription').value
            };

            try {
                const response = await fetch('/api/vaccineTypes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '추가 실패');
                }

                alert('백신이 추가되었습니다.');
                closeAddVaccineModal();
                loadVaccineTypes();
            } catch (error) {
                alert(error.message);
            }
        });
    }

    // 백신 수정
    const editVaccineForm = document.getElementById('editVaccineForm');
    if (editVaccineForm) {
        editVaccineForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = document.getElementById('editVaccineId').value;
            const formData = {
                name: document.getElementById('editVaccineName').value,
                targetDisease: document.getElementById('editVaccineTarget').value,
                manufacturer: document.getElementById('editVaccineManufacturer').value,
                method: document.getElementById('editVaccineMethod').value,
                dosage: document.getElementById('editVaccineDosage').value,
                timing: document.getElementById('editVaccineTiming').value,
                description: document.getElementById('editVaccineDescription').value
            };

            try {
                const response = await fetch(`/api/vaccineTypes/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '수정 실패');
                }

                alert('백신 정보가 수정되었습니다.');
                closeEditVaccineModal();
                loadVaccineTypes();
            } catch (error) {
                alert(error.message);
            }
        });
    }
});

// 백신 삭제
async function deleteVaccineType(id) {
    if (!confirm('정말 이 백신을 삭제하시겠습니까?')) return;

    try {
        const response = await fetch(`/api/vaccineTypes/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '삭제 실패');
        }

        alert('백신이 삭제되었습니다.');
        loadVaccineTypes();
    } catch (error) {
        alert(error.message);
    }
}

// ==========================================
// 질병 코드 관리 로직
// ==========================================

let diseaseCodes = [];

// 질병 목록 불러오기
async function loadDiseaseCodes() {
    const tableBody = document.getElementById('diseaseCodesTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="6" class="loading">데이터를 불러오는 중...</td></tr>';

    try {
        const response = await fetch('/api/diseaseCodes');
        if (!response.ok) throw new Error('데이터 로드 실패');

        diseaseCodes = await response.json();
        renderDiseaseCodesTable();
    } catch (error) {
        console.error('질병 로드 오류:', error);
        tableBody.innerHTML = '<tr><td colspan="6" class="error">데이터를 불러오는데 실패했습니다.</td></tr>';
    }
}

// 질병 테이블 렌더링
function renderDiseaseCodesTable() {
    const tableBody = document.getElementById('diseaseCodesTableBody');
    if (!tableBody) return;

    if (diseaseCodes.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="no-data">등록된 질병이 없습니다.</td></tr>';
        return;
    }

    tableBody.innerHTML = diseaseCodes.map(d => `
        <tr>
            <td class="font-medium">${d.code}</td>
            <td class="font-medium">${d.name}</td>
            <td class="text-gray">${d.englishName || '-'}</td>
            <td class="text-small" style="max-width: 200px;">${d.symptoms || '-'}</td>
            <td class="text-small" style="max-width: 200px;">${d.prevention || '-'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-secondary" onclick="openEditDiseaseModal(${d.id})">수정</button>
                    ${d.id > 7 ? `<button class="btn btn-sm btn-danger" onclick="deleteDiseaseCode(${d.id})">삭제</button>` : ''} 
                </div>
            </td>
        </tr>
    `).join('');
}

// 질병 추가 모달 열기
function openAddDiseaseModal() {
    document.getElementById('addDiseaseForm').reset();
    document.getElementById('addDiseaseModal').classList.add('show');
}

// 질병 추가 모달 닫기
function closeAddDiseaseModal() {
    document.getElementById('addDiseaseModal').classList.remove('show');
}

// 질병 수정 모달 열기
function openEditDiseaseModal(id) {
    const disease = diseaseCodes.find(d => d.id === id);
    if (!disease) return;

    document.getElementById('editDiseaseId').value = disease.id;
    document.getElementById('editDiseaseCode').value = disease.code;
    document.getElementById('editDiseaseName').value = disease.name;
    document.getElementById('editDiseaseEnglishName').value = disease.englishName || '';
    document.getElementById('editDiseaseSymptoms').value = disease.symptoms || '';
    document.getElementById('editDiseasePrevention').value = disease.prevention || '';

    document.getElementById('editDiseaseModal').classList.add('show');
}

// 질병 수정 모달 닫기
function closeEditDiseaseModal() {
    document.getElementById('editDiseaseModal').classList.remove('show');
}

// 질병 추가 및 수정 이벤트 리스너
document.addEventListener('DOMContentLoaded', () => {
    // 질병 추가
    const addDiseaseForm = document.getElementById('addDiseaseForm');
    if (addDiseaseForm) {
        addDiseaseForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = {
                code: document.getElementById('newDiseaseCode').value,
                name: document.getElementById('newDiseaseName').value,
                englishName: document.getElementById('newDiseaseEnglishName').value,
                symptoms: document.getElementById('newDiseaseSymptoms').value,
                prevention: document.getElementById('newDiseasePrevention').value
            };

            try {
                const response = await fetch('/api/diseaseCodes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '추가 실패');
                }

                alert('질병이 추가되었습니다.');
                closeAddDiseaseModal();
                loadDiseaseCodes();
            } catch (error) {
                alert(error.message);
            }
        });
    }

    // 질병 수정
    const editDiseaseForm = document.getElementById('editDiseaseForm');
    if (editDiseaseForm) {
        editDiseaseForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = document.getElementById('editDiseaseId').value;
            const formData = {
                code: document.getElementById('editDiseaseCode').value,
                name: document.getElementById('editDiseaseName').value,
                englishName: document.getElementById('editDiseaseEnglishName').value,
                symptoms: document.getElementById('editDiseaseSymptoms').value,
                prevention: document.getElementById('editDiseasePrevention').value
            };

            try {
                const response = await fetch(`/api/diseaseCodes/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '수정 실패');
                }

                alert('질병 정보가 수정되었습니다.');
                closeEditDiseaseModal();
                loadDiseaseCodes();
            } catch (error) {
                alert(error.message);
            }
        });
    }
});

// 질병 삭제
async function deleteDiseaseCode(id) {
    if (!confirm('정말 이 질병을 삭제하시겠습니까?')) return;

    try {
        const response = await fetch(`/api/diseaseCodes/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '삭제 실패');
        }

        alert('질병이 삭제되었습니다.');
        loadDiseaseCodes();
    } catch (error) {
        alert(error.message);
    }
}

// ==========================================
// 농장 구조 템플릿 관리 로직
// ==========================================

let structureTemplates = [];

// 템플릿 목록 불러오기
async function loadStructureTemplates() {
    const productionBody = document.getElementById('structureTemplatesProductionBody');
    const generalBody = document.getElementById('structureTemplatesGeneralBody');

    if (!productionBody || !generalBody) return;

    productionBody.innerHTML = '<tr><td colspan="5" class="loading">데이터를 불러오는 중...</td></tr>';
    generalBody.innerHTML = '<tr><td colspan="3" class="loading">데이터를 불러오는 중...</td></tr>';

    try {
        const response = await fetch('/api/structureTemplates');
        if (!response.ok) throw new Error('데이터 로드 실패');

        structureTemplates = await response.json();
        renderStructureTemplatesTable();
    } catch (error) {
        console.error('템플릿 로드 오류:', error);
        productionBody.innerHTML = '<tr><td colspan="5" class="error">데이터를 불러오는데 실패했습니다.</td></tr>';
        generalBody.innerHTML = '<tr><td colspan="3" class="error">데이터를 불러오는데 실패했습니다.</td></tr>';
    }
}

// 템플릿 테이블 렌더링 (사육 / 일반 분리, sortOrder 순)
function renderStructureTemplatesTable() {
    const productionBody = document.getElementById('structureTemplatesProductionBody');
    const generalBody = document.getElementById('structureTemplatesGeneralBody');
    if (!productionBody || !generalBody) return;

    const productionTemplates = structureTemplates
        .filter(t => t.category === 'production')
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const generalTemplates = structureTemplates
        .filter(t => t.category === 'general')
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    // 사육 시설 테이블
    if (productionTemplates.length === 0) {
        productionBody.innerHTML = '<tr><td colspan="5" class="no-data">등록된 사육 시설 기준이 없습니다.</td></tr>';
    } else {
        productionBody.innerHTML = productionTemplates.map((t, idx) => {
            const weight = t.weight || '-';
            const density = t.optimalDensity ? `${t.optimalDensity} m²/두` : '-';
            const description = t.description || '-';
            const canUp = idx > 0;
            const canDown = idx < productionTemplates.length - 1;
            return `
                <tr data-struct-id="${t.id}" class="clickable-row">
                    <td class="text-center structure-order-cell">
                        <span class="structure-order-num" title="저장된 순서">${t.sortOrder != null ? t.sortOrder : idx}</span>
                        <button type="button" class="btn-order btn-order-up" ${!canUp ? 'disabled' : ''} title="위로" data-id="${t.id}" data-direction="up">▲</button>
                        <button type="button" class="btn-order btn-order-down" ${!canDown ? 'disabled' : ''} title="아래로" data-id="${t.id}" data-direction="down">▼</button>
                    </td>
                    <td class="font-medium">${t.name}</td>
                    <td>${weight}</td>
                    <td>${density}</td>
                    <td class="text-small">${description}</td>
                </tr>
            `;
        }).join('');

        bindStructureRowClickAndOrder(productionBody);
    }

    // 일반 시설 테이블
    if (generalTemplates.length === 0) {
        generalBody.innerHTML = '<tr><td colspan="3" class="no-data">등록된 일반 시설 기준이 없습니다.</td></tr>';
    } else {
        generalBody.innerHTML = generalTemplates.map((t, idx) => {
            const description = t.description || '-';
            const canUp = idx > 0;
            const canDown = idx < generalTemplates.length - 1;
            return `
                <tr data-struct-id="${t.id}" class="clickable-row">
                    <td class="text-center structure-order-cell">
                        <span class="structure-order-num" title="저장된 순서">${t.sortOrder != null ? t.sortOrder : idx}</span>
                        <button type="button" class="btn-order btn-order-up" ${!canUp ? 'disabled' : ''} title="위로" data-id="${t.id}" data-direction="up">▲</button>
                        <button type="button" class="btn-order btn-order-down" ${!canDown ? 'disabled' : ''} title="아래로" data-id="${t.id}" data-direction="down">▼</button>
                    </td>
                    <td class="font-medium">${t.name}</td>
                    <td class="text-small">${description}</td>
                </tr>
            `;
        }).join('');

        bindStructureRowClickAndOrder(generalBody);
    }
}

// 순서 버튼 클릭(위/아래) 시 API 호출 후 목록 갱신, 버튼 영역 클릭 시 행 클릭(수정) 방지
function bindStructureRowClickAndOrder(container) {
    if (!container) return;
    container.querySelectorAll('tr[data-struct-id]').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('.structure-order-cell')) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            const id = row.getAttribute('data-struct-id');
            if (id) openEditStructureModal(parseInt(id, 10));
        });
    });
    container.querySelectorAll('.btn-order').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (btn.disabled) return;
            const id = btn.getAttribute('data-id');
            const direction = btn.getAttribute('data-direction');
            if (!id || !direction) return;
            try {
                const res = await fetch('/api/structureTemplates/reorder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: parseInt(id, 10), direction })
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || '순서 변경 실패');
                }
                loadStructureTemplates();
            } catch (err) {
                alert(err.message);
            }
        });
    });
}

// 밀사율 필드 토글 (Updated)
function toggleDensityField(prefix) {
    const categoryEl = document.getElementById(`${prefix}StructCategory`);
    if (!categoryEl) return;

    const category = categoryEl.value;
    const densityGroup = document.getElementById(`${prefix}DensityGroup`);
    const weightGroup = document.getElementById(`${prefix}WeightGroup`);

    if (category === 'production') {
        if (densityGroup) densityGroup.style.display = 'block';
        if (weightGroup) weightGroup.style.display = 'block';
    } else {
        if (densityGroup) {
            densityGroup.style.display = 'none';
            const densityInput = document.getElementById(`${prefix}StructDensity`);
            if (densityInput) densityInput.value = '';
        }
        if (weightGroup) {
            weightGroup.style.display = 'none';
            const weightInput = document.getElementById(`${prefix}StructWeight`);
            if (weightInput) weightInput.value = '';
        }
    }
}

// 템플릿 추가 모달 열기
function openAddStructureModal(category = 'production') {
    const form = document.getElementById('addStructureForm');
    if (form) {
        form.reset();
    }

    const categorySelect = document.getElementById('newStructCategory');
    const categoryLabel = document.getElementById('newStructCategoryLabel');
    const titleEl = document.getElementById('addStructureModalTitle');

    if (categorySelect) {
        categorySelect.value = category;
    }

    if (categoryLabel) {
        categoryLabel.textContent =
            category === 'production'
                ? '사육 시설 (Production)'
                : '일반 시설 (General)';
    }

    // 제목 및 밀도 필드 표시 제어
    if (titleEl) {
        if (category === 'production') {
            titleEl.textContent = '🏗️ 사육 시설 기준 추가';
        } else {
            titleEl.textContent = '🏢 일반 시설 기준 추가';
        }
    }

    toggleDensityField('new');
    document.getElementById('addStructureModal').classList.add('show');
}

// 템플릿 추가 모달 닫기
function closeAddStructureModal() {
    document.getElementById('addStructureModal').classList.remove('show');
}

// 템플릿 수정 모달 열기
function openEditStructureModal(id) {
    const t = structureTemplates.find(tem => tem.id === id);
    if (!t) return;

    const prefix = 'edit';
    document.getElementById(`${prefix}StructId`).value = t.id;
    document.getElementById(`${prefix}StructName`).value = t.name;
    const categoryInput = document.getElementById(`${prefix}StructCategory`);
    const categoryLabel = document.getElementById(`${prefix}StructCategoryLabel`);
    if (categoryInput) {
        categoryInput.value = t.category;
    }
    if (categoryLabel) {
        categoryLabel.textContent =
            t.category === 'production'
                ? '사육 시설 (Production)'
                : '일반 시설 (General)';
    }
    const weightInput = document.getElementById(`${prefix}StructWeight`);
    if (weightInput) {
        weightInput.value = t.weight || '';
    }
    document.getElementById(`${prefix}StructDensity`).value = t.optimalDensity || '';
    document.getElementById(`${prefix}StructDescription`).value = t.description || '';

    toggleDensityField(prefix);
    document.getElementById('editStructureModal').classList.add('show');
}

// 템플릿 수정 모달 닫기
function closeEditStructureModal() {
    document.getElementById('editStructureModal').classList.remove('show');
}

// 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', () => {


    // 템플릿 추가
    const addStructureForm = document.getElementById('addStructureForm');
    if (addStructureForm) {
        addStructureForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = {
                name: document.getElementById('newStructName').value,
                category: document.getElementById('newStructCategory').value,
                weight: document.getElementById('newStructWeight') ? document.getElementById('newStructWeight').value : undefined,
                optimalDensity: document.getElementById('newStructDensity').value || null,
                description: document.getElementById('newStructDescription').value
            };

            try {
                const response = await fetch('/api/structureTemplates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '추가 실패');
                }

                alert('시설 기준이 추가되었습니다.');
                closeAddStructureModal();
                loadStructureTemplates();
            } catch (error) {
                alert(error.message);
            }
        });
    }

    // 템플릿 수정
    const editStructureForm = document.getElementById('editStructureForm');
    if (editStructureForm) {
        editStructureForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = document.getElementById('editStructId').value;
            const formData = {
                name: document.getElementById('editStructName').value,
                category: document.getElementById('editStructCategory').value,
                weight: document.getElementById('editStructWeight') ? document.getElementById('editStructWeight').value : undefined,
                optimalDensity: document.getElementById('editStructDensity').value || null,
                description: document.getElementById('editStructDescription').value
            };

            try {
                const response = await fetch(`/api/structureTemplates/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '수정 실패');
                }

                alert('시설 정보가 수정되었습니다.');
                closeEditStructureModal();
                loadStructureTemplates();
            } catch (error) {
                alert(error.message);
            }
        });
    }
});

// 현재 수정 중인 시설 삭제 (모달 내에서 사용)
async function deleteCurrentStructure() {
    const id = document.getElementById('editStructId').value;
    if (!id) return;
    await deleteStructureTemplate(id);
    closeEditStructureModal();
}

// 템플릿 삭제
async function deleteStructureTemplate(id) {
    if (!confirm('정말 이 시설 기준을 삭제하시겠습니까?')) return;

    try {
        const response = await fetch(`/api/structureTemplates/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '삭제 실패');
        }

        alert('시설 기준이 삭제되었습니다.');
        loadStructureTemplates();
    } catch (error) {
        alert(error.message);
    }
}

// ========== 일정 관리 설정 ==========
let scheduleTaskTypes = [];
let scheduleBasisTypes = [];
let scheduleStructureTemplates = [];
let scheduleItems = [];
let scheduleViewMode = 'all'; // 'all' | 'move'
/** + 버튼으로 특정 위치에 추가할 때 사용. null이면 맨 뒤에 추가 */
let scheduleInsertAtIndex = null;
/** 작업 유형 목록에서 + 버튼으로 삽입할 위치 (null이면 맨 뒤) */
let scheduleTaskTypeInsertAtIndex = null;
/** 기준 유형 목록에서 + 버튼으로 삽입할 위치 (null이면 맨 뒤) */
let scheduleBasisTypeInsertAtIndex = null;

/** 일정/기준 구분 값이 돼지류(기준·일수 사용)인지 */
function isPigTargetType(t) { return ['sow', 'boar', 'non_breeding', 'pig'].indexOf(t) >= 0; }
/** 일정/기준 구분 값이 시설(반복 사용)인지 */
function isFacilityTargetType(t) { return t === 'facility'; }
/** 구분 표시 라벨 (모돈/옹돈/비번식돈/시설) */
function scheduleTargetTypeLabel(v) { return (v === 'sow' ? '모돈' : v === 'boar' ? '옹돈' : v === 'non_breeding' ? '비번식돈' : v === 'facility' ? '시설' : v === 'pig' ? '비번식돈' : (v || '-')); }

async function loadScheduleSettings() {
    await Promise.all([
        loadScheduleTaskTypes(),
        loadScheduleBasisTypes(),
        loadStructureTemplatesForSchedule()
    ]);
    updateScheduleViewModeLabel();
    await loadScheduleItems();
}

async function loadStructureTemplatesForSchedule() {
    try {
        const res = await fetch('/api/structureTemplates');
        const list = res.ok ? await res.json() : [];
        scheduleStructureTemplates = list;
        const selFilter = document.getElementById('scheduleFilterStructure');
        const selModal = document.getElementById('scheduleItemStructureTemplateId');
        if (selFilter) {
            selFilter.innerHTML = '<option value="">전체</option>' + list.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        }
        if (selModal) {
            selModal.innerHTML = '<option value="">선택 안 함</option>' + list.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        }
    } catch (e) {
        console.error(e);
    }
}

async function loadScheduleTaskTypes(structureTemplateId) {
    try {
        const url = structureTemplateId ? '/api/scheduleTaskTypes?structureTemplateId=' + encodeURIComponent(structureTemplateId) : '/api/scheduleTaskTypes';
        const res = await fetch(url);
        if (!res.ok) throw new Error('작업 유형 목록 조회 실패');
        const list = await res.json();
        if (!structureTemplateId) {
            scheduleTaskTypes = list;
            const selFilter = document.getElementById('scheduleFilterTaskType');
            if (selFilter) {
                selFilter.innerHTML = '<option value="">전체</option>' + scheduleTaskTypes.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
            }
            const listModal = document.getElementById('scheduleTaskTypesListModal');
            if (listModal && listModal.classList.contains('show')) {
                renderScheduleTaskTypesListModal();
            }
            const checkAll = document.getElementById('scheduleTaskTypeListModalCheckAll');
            if (checkAll) checkAll.checked = false;
        }
        const selModal = document.getElementById('scheduleItemTaskTypeId');
        if (selModal) {
            const currentVal = selModal.value;
            selModal.innerHTML = '<option value="">선택</option>' + list.map(t => `<option value="${t.id}">${t.name}</option>`).join('') + '<option value="__add__">➕ 작업유형 추가</option>';
            if (currentVal && currentVal !== '__add__' && list.some(t => t.id === parseInt(currentVal, 10))) selModal.value = currentVal;
            else if (currentVal !== '__add__') selModal.value = '';
        }
    } catch (e) {
        const listBody = document.getElementById('scheduleTaskTypesListModalBody');
        if (listBody) listBody.innerHTML = '<tr><td colspan="4" class="error">' + escapeHtml(e.message) + '</td></tr>';
    }
}

/** 일정 항목 모달에서 대상장소에 맞는 작업 유형만 드롭다운에 채움 */
async function fillScheduleItemTaskTypeOptionsFromFilter(structureTemplateId) {
    const sel = document.getElementById('scheduleItemTaskTypeId');
    if (!sel) return;
    if (!structureTemplateId) {
        await loadScheduleTaskTypes();
        return;
    }
    await loadScheduleTaskTypes(structureTemplateId);
}

async function reorderScheduleTaskTypes(draggedId, dropTargetId, insertBefore) {
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
            const structureTemplateIds = (t.structureScopes || []).map(s => s.structureTemplateId || s.structureTemplate && s.structureTemplate.id).filter(Boolean);
            const res = await fetch(`/api/scheduleTaskTypes/${t.id}`, {
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
        await loadScheduleTaskTypes();
        window._scheduleTaskTypeSortJustEnded = false;
    } catch (err) {
        alert(err.message);
        window._scheduleTaskTypeSortJustEnded = false;
    }
}

function toggleScheduleTaskTypeCheckAll(checkbox) {
    document.querySelectorAll('.schedule-task-type-cb').forEach(cb => { cb.checked = checkbox.checked; });
}

async function deleteSelectedScheduleTaskTypes() {
    const ids = Array.from(document.querySelectorAll('.schedule-task-type-cb:checked')).map(cb => parseInt(cb.value, 10));
    if (ids.length === 0) {
        alert('삭제할 항목을 선택하세요.');
        return;
    }
    if (!confirm(`선택한 ${ids.length}건을 삭제하시겠습니까?`)) return;
    try {
        for (const id of ids) {
            const res = await fetch(`/api/scheduleTaskTypes/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '삭제 실패');
            }
        }
        alert('삭제되었습니다.');
        loadScheduleTaskTypes();
        loadScheduleItems();
    } catch (e) {
        alert(e.message);
    }
}

function openScheduleTaskTypesListModal() {
    const modal = document.getElementById('scheduleTaskTypesListModal');
    if (!modal) return;
    loadScheduleTaskTypes().then(() => {
        renderScheduleTaskTypesListModal();
        modal.classList.add('show');
    });
}

function closeScheduleTaskTypesListModal() {
    document.getElementById('scheduleTaskTypesListModal')?.classList.remove('show');
}

function renderScheduleTaskTypesListModal() {
    const tbody = document.getElementById('scheduleTaskTypesListModalBody');
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
    const sortKey = (t) => {
        const ci = categoryOrder.indexOf(t.category || '');
        return [(ci >= 0 ? ci : 99), t.sortOrder ?? 0, t.id];
    };
    const sorted = [...scheduleTaskTypes].sort((a, b) => {
        const [ac, as, ai] = sortKey(a);
        const [bc, bs, bi] = sortKey(b);
        if (ac !== bc) return ac - bc;
        if (as !== bs) return as - bs;
        return ai - bi;
    });
    let lastCat = null;
    const rows = [];
    sorted.forEach(t => {
        const cat = t.category || '';
        if (cat !== lastCat) {
            lastCat = cat;
            rows.push(`<tr class="schedule-task-type-group-header"><td colspan="5" class="schedule-task-type-group-cell">${escapeHtml(categoryLabel(cat))}</td></tr>`);
        }
        rows.push(`
        <tr class="clickable-row" data-schedule-task-type-id="${t.id}" style="cursor: pointer;">
            <td><input type="checkbox" class="schedule-task-type-list-cb" value="${t.id}"></td>
            <td><span class="schedule-drag-handle" draggable="true" title="드래그하여 순서 변경">≡</span></td>
            <td class="text-muted small">${escapeHtml(scopeLabel(t))}</td>
            <td class="text-muted small">${escapeHtml(categoryLabel(t.category))}</td>
            <td>${escapeHtml(t.name)}</td>
        </tr>
    `);
    });
    tbody.innerHTML = rows.join('');
    tbody.querySelectorAll('tr[data-schedule-task-type-id]').forEach(tr => {
        tr.addEventListener('click', function (e) {
            if (e.target.type === 'checkbox' || e.target.closest('.schedule-drag-handle')) return;
            if (window._scheduleTaskTypeSortJustEnded) {
                window._scheduleTaskTypeSortJustEnded = false;
                return;
            }
            const row = e.currentTarget;
            const id = parseInt(row.getAttribute('data-schedule-task-type-id'), 10);
            if (!id) return;
            openScheduleTaskTypeModal(id);
        });
        const handle = tr.querySelector('.schedule-drag-handle');
        if (handle) {
            handle.addEventListener('mousedown', function (e) { e.stopPropagation(); });
            handle.addEventListener('dragstart', function (e) {
                e.dataTransfer.setData('text/plain', String(tr.getAttribute('data-schedule-task-type-id')));
                e.dataTransfer.effectAllowed = 'move';
                tr.classList.add('dragging');
            });
            handle.addEventListener('dragend', function () {
                tr.classList.remove('dragging');
                tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-before', 'drag-over-after'));
                if (window._scheduleTaskTypeSortJustEnded) window._scheduleTaskTypeSortJustEnded = false;
            });
        }
        tr.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const id = tr.getAttribute('data-schedule-task-type-id');
            const draggedId = e.dataTransfer.getData('text/plain');
            if (id === draggedId) return;
            const rect = tr.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-before', 'drag-over-after'));
            tr.classList.add(e.clientY < mid ? 'drag-over-before' : 'drag-over-after');
        });
        tr.addEventListener('dragleave', function () { tr.classList.remove('drag-over-before', 'drag-over-after'); });
        tr.addEventListener('drop', function (e) {
            e.preventDefault();
            e.stopPropagation();
            tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-before', 'drag-over-after'));
            const draggedId = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const dropId = parseInt(tr.getAttribute('data-schedule-task-type-id'), 10);
            if (draggedId === dropId) return;
            const rect = tr.getBoundingClientRect();
            const insertBefore = e.clientY < rect.top + rect.height / 2;
            window._scheduleTaskTypeSortJustEnded = true;
            reorderScheduleTaskTypes(draggedId, dropId, insertBefore);
        });
    });
}

function toggleScheduleTaskTypeListModalCheckAll(checkbox) {
    const modal = document.getElementById('scheduleTaskTypesListModal');
    if (!modal) return;
    modal.querySelectorAll('.schedule-task-type-list-cb').forEach(cb => { cb.checked = checkbox.checked; });
}

async function deleteSelectedScheduleTaskTypesInModal() {
    const modal = document.getElementById('scheduleTaskTypesListModal');
    if (!modal) return;
    const ids = Array.from(modal.querySelectorAll('.schedule-task-type-list-cb:checked')).map(cb => parseInt(cb.value, 10));
    if (ids.length === 0) {
        alert('삭제할 항목을 선택하세요.');
        return;
    }
    if (!confirm(`선택한 ${ids.length}건을 삭제하시겠습니까?`)) return;
    try {
        for (const id of ids) {
            const res = await fetch(`/api/scheduleTaskTypes/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '삭제 실패');
            }
        }
        alert('삭제되었습니다.');
        loadScheduleTaskTypes();
        loadScheduleItems();
    } catch (e) {
        alert(e.message);
    }
}

async function loadScheduleBasisTypes() {
    try {
        const res = await fetch('/api/scheduleBasisTypes');
        if (!res.ok) throw new Error('기준 유형 목록 조회 실패');
        scheduleBasisTypes = await res.json();
        const selFilter = document.getElementById('scheduleFilterBasisType');
        const selModal = document.getElementById('scheduleItemBasisTypeId');
        if (selFilter) {
            selFilter.innerHTML = '<option value="">전체</option>' + scheduleBasisTypes.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
        }
        if (selModal) {
            fillScheduleItemBasisTypeOptions(document.getElementById('scheduleItemTargetType')?.value || 'pig');
        }
        const listModal = document.getElementById('scheduleBasisTypesListModal');
        if (listModal && listModal.classList.contains('show')) {
            renderScheduleBasisTypesListModal();
        }
        const checkAll = document.getElementById('scheduleBasisTypeListModalCheckAll');
        if (checkAll) checkAll.checked = false;
    } catch (e) {
        const listBody = document.getElementById('scheduleBasisTypesListModalBody');
        if (listBody) listBody.innerHTML = '<tr><td colspan="4" class="error">' + escapeHtml(e.message) + '</td></tr>';
    }
}

async function reorderScheduleBasisTypes(draggedId, dropTargetId, insertBefore) {
    const sorted = [...scheduleBasisTypes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const fromIndex = sorted.findIndex(b => b.id === draggedId);
    const toIndex = sorted.findIndex(b => b.id === dropTargetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const item = sorted.splice(fromIndex, 1)[0];
    let insertAt = insertBefore ? toIndex : toIndex + 1;
    if (fromIndex < insertAt) insertAt--;
    sorted.splice(insertAt, 0, item);
    try {
        for (let i = 0; i < sorted.length; i++) {
            const res = await fetch(`/api/scheduleBasisTypes/${sorted[i].id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: sorted[i].code,
                    name: sorted[i].name,
                    targetType: sorted[i].targetType,
                    description: sorted[i].description,
                    sortOrder: i
                })
            });
            if (!res.ok) throw new Error('순서 저장 실패');
        }
        await loadScheduleBasisTypes();
        loadScheduleItems();
        window._scheduleBasisTypeSortJustEnded = false;
    } catch (err) {
        alert(err.message);
        window._scheduleBasisTypeSortJustEnded = false;
    }
}

function toggleScheduleBasisTypeCheckAll(checkbox) {
    document.querySelectorAll('.schedule-basis-type-cb').forEach(cb => { cb.checked = checkbox.checked; });
}

async function deleteSelectedScheduleBasisTypes() {
    const ids = Array.from(document.querySelectorAll('.schedule-basis-type-cb:checked')).map(cb => parseInt(cb.value, 10));
    if (ids.length === 0) {
        alert('삭제할 항목을 선택하세요.');
        return;
    }
    if (!confirm(`선택한 ${ids.length}건을 삭제하시겠습니까?`)) return;
    try {
        for (const id of ids) {
            const res = await fetch(`/api/scheduleBasisTypes/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '삭제 실패');
            }
        }
        alert('삭제되었습니다.');
        loadScheduleBasisTypes();
        loadScheduleItems();
    } catch (e) {
        alert(e.message);
    }
}

function openScheduleBasisTypesListModal() {
    const modal = document.getElementById('scheduleBasisTypesListModal');
    if (!modal) return;
    loadScheduleBasisTypes().then(() => {
        renderScheduleBasisTypesListModal();
        modal.classList.add('show');
    });
}

function closeScheduleBasisTypesListModal() {
    document.getElementById('scheduleBasisTypesListModal')?.classList.remove('show');
}

function renderScheduleBasisTypesListModal() {
    const tbody = document.getElementById('scheduleBasisTypesListModalBody');
    if (!tbody) return;
    const targetTypeLabel = (v) => (v === 'sow' ? '모돈' : v === 'boar' ? '옹돈' : v === 'non_breeding' ? '비번식돈' : v === 'facility' ? '시설' : v === 'pig' ? '비번식돈' : (v || '-'));
    if (!scheduleBasisTypes || scheduleBasisTypes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted">등록된 기준 유형이 없습니다.</td></tr>';
        return;
    }
    const sorted = [...scheduleBasisTypes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    tbody.innerHTML = sorted.map(b => `
        <tr class="clickable-row" data-schedule-basis-type-id="${b.id}" style="cursor: pointer;">
            <td><input type="checkbox" class="schedule-basis-type-list-cb" value="${b.id}"></td>
            <td><span class="schedule-drag-handle" draggable="true" title="드래그하여 순서 변경">≡</span></td>
            <td>${targetTypeLabel(b.targetType)}</td>
            <td>${escapeHtml(b.name)}</td>
        </tr>
    `).join('');
    tbody.querySelectorAll('tr[data-schedule-basis-type-id]').forEach(tr => {
        tr.addEventListener('click', function (e) {
            if (e.target.type === 'checkbox' || e.target.closest('.schedule-drag-handle')) return;
            if (window._scheduleBasisTypeSortJustEnded) {
                window._scheduleBasisTypeSortJustEnded = false;
                return;
            }
            const row = e.currentTarget;
            const id = parseInt(row.getAttribute('data-schedule-basis-type-id'), 10);
            if (!id) return;
            openScheduleBasisTypeModal(id);
        });
        const handle = tr.querySelector('.schedule-drag-handle');
        if (handle) {
            handle.addEventListener('mousedown', function (e) { e.stopPropagation(); });
            handle.addEventListener('dragstart', function (e) {
                e.dataTransfer.setData('text/plain', String(tr.getAttribute('data-schedule-basis-type-id')));
                e.dataTransfer.effectAllowed = 'move';
                tr.classList.add('dragging');
            });
            handle.addEventListener('dragend', function () {
                tr.classList.remove('dragging');
                tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-before', 'drag-over-after'));
                if (window._scheduleBasisTypeSortJustEnded) window._scheduleBasisTypeSortJustEnded = false;
            });
        }
        tr.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const id = tr.getAttribute('data-schedule-basis-type-id');
            const draggedId = e.dataTransfer.getData('text/plain');
            if (id === draggedId) return;
            const rect = tr.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-before', 'drag-over-after'));
            tr.classList.add(e.clientY < mid ? 'drag-over-before' : 'drag-over-after');
        });
        tr.addEventListener('dragleave', function () { tr.classList.remove('drag-over-before', 'drag-over-after'); });
        tr.addEventListener('drop', function (e) {
            e.preventDefault();
            e.stopPropagation();
            tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-before', 'drag-over-after'));
            const draggedId = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const dropId = parseInt(tr.getAttribute('data-schedule-basis-type-id'), 10);
            if (draggedId === dropId) return;
            const rect = tr.getBoundingClientRect();
            const insertBefore = e.clientY < rect.top + rect.height / 2;
            window._scheduleBasisTypeSortJustEnded = true;
            reorderScheduleBasisTypes(draggedId, dropId, insertBefore);
        });
    });
}

function toggleScheduleBasisTypeListModalCheckAll(checkbox) {
    const modal = document.getElementById('scheduleBasisTypesListModal');
    if (!modal) return;
    modal.querySelectorAll('.schedule-basis-type-list-cb').forEach(cb => { cb.checked = checkbox.checked; });
}

async function deleteSelectedScheduleBasisTypesInModal() {
    const modal = document.getElementById('scheduleBasisTypesListModal');
    if (!modal) return;
    const ids = Array.from(modal.querySelectorAll('.schedule-basis-type-list-cb:checked')).map(cb => parseInt(cb.value, 10));
    if (ids.length === 0) {
        alert('삭제할 항목을 선택하세요.');
        return;
    }
    if (!confirm(`선택한 ${ids.length}건을 삭제하시겠습니까?`)) return;
    try {
        for (const id of ids) {
            const res = await fetch(`/api/scheduleBasisTypes/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '삭제 실패');
            }
        }
        alert('삭제되었습니다.');
        loadScheduleBasisTypes();
        loadScheduleItems();
    } catch (e) {
        alert(e.message);
    }
}

async function applyScheduleQuickFilter(kind) {
    const selTarget = document.getElementById('scheduleFilterTargetType');
    const selStructure = document.getElementById('scheduleFilterStructure');
    const selBasis = document.getElementById('scheduleFilterBasisType');
    const selTask = document.getElementById('scheduleFilterTaskType');
    if (kind === 'all') {
        scheduleViewMode = 'all';
        if (selTarget) selTarget.value = '';
        if (selStructure) selStructure.value = '';
        if (selBasis) selBasis.value = '';
        if (selTask) selTask.value = '';
    } else if (kind === 'move') {
        scheduleViewMode = 'move';
        if (selTarget) selTarget.value = '';
        if (selStructure) selStructure.value = '';
        if (selBasis) selBasis.value = '';
        if (scheduleTaskTypes.length === 0) await loadScheduleTaskTypes();
        const moveType = scheduleTaskTypes.find(t => t.name === '이동');
        if (selTask) selTask.value = moveType ? String(moveType.id) : '';
    } else if (kind === 'breeding' || kind === 'farrowing' || kind === 'weaning') {
        scheduleViewMode = 'all';
        if (selTarget) selTarget.value = 'pig';
        if (selBasis) selBasis.value = '';
        if (selTask) selTask.value = '';
        if (scheduleStructureTemplates.length === 0) await loadStructureTemplatesForSchedule();
        const nameMap = { breeding: '교배사', farrowing: '분만사', weaning: '자돈사' };
        const name = nameMap[kind];
        const found = scheduleStructureTemplates.find(t => t.name === name);
        if (selStructure) selStructure.value = found ? String(found.id) : '';
    }
    updateScheduleViewModeLabel();
    await loadScheduleItems();
}

function updateScheduleViewModeLabel() {
    const el = document.getElementById('scheduleViewModeLabel');
    if (!el) return;
    el.textContent = scheduleViewMode === 'move' ? '이동 일정만 표시 중' : '';
    el.style.display = scheduleViewMode === 'move' ? 'inline' : 'none';
}

async function loadScheduleItems() {
    const tbody = document.getElementById('scheduleItemsBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="12" class="loading">데이터를 불러오는 중...</td></tr>';
    const targetType = document.getElementById('scheduleFilterTargetType')?.value || '';
    const structureTemplateId = document.getElementById('scheduleFilterStructure')?.value || '';
    const basisTypeId = document.getElementById('scheduleFilterBasisType')?.value || '';
    const taskTypeId = document.getElementById('scheduleFilterTaskType')?.value || '';
    const params = new URLSearchParams();
    if (targetType) params.set('targetType', targetType);
    if (structureTemplateId) params.set('structureTemplateId', structureTemplateId);
    if (basisTypeId) params.set('basisTypeId', basisTypeId);
    if (taskTypeId) params.set('taskTypeId', taskTypeId);
    const qs = params.toString();
    try {
        const url = '/api/scheduleItems' + (qs ? '?' + qs : '');
        const res = await fetch(url);
        if (!res.ok) throw new Error('일정 항목 목록 조회 실패');
        scheduleItems = await res.json();
        if (scheduleItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="12" class="text-muted">조건에 맞는 일정이 없습니다.</td></tr>' +
                '<tr class="schedule-insert-row" data-insert-index="0"><td class="schedule-insert-cell"><button type="button" class="schedule-insert-btn" title="이 위치에 일정 추가">+</button></td><td colspan="11" class="schedule-insert-spacer"></td></tr>';
            tbody.querySelectorAll('.schedule-insert-btn').forEach(btn => {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    openScheduleItemModal(null, 0);
                });
            });
        } else {
            const targetLabel = scheduleTargetTypeLabel;
            const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
            /* 반복유형: 매일/매주/매월/매년만 표시 */
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
            /* 반복간격: 매주=요일(월·목), 매월=일(15일), 매일/매년=숫자(1,2...) */
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
                const n = s.recurrenceInterval != null ? s.recurrenceInterval : 1;
                return String(n);
            };
            /* 시설일 때 기준 열에 반복유형(매일/매주/매월) 표시 */
            const basisDisplay = (s) => {
                const isFacility = isFacilityTargetType(s.targetType);
                if (!isFacility) return (s.basisTypeRef && s.basisTypeRef.name) || '-';
                return s.basisTypeRef?.name || formatRecurrenceTypeLabel(s) || '-';
            };
            const sorted = [...scheduleItems].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
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
                <tr class="${rowClass}" data-schedule-item-id="${s.id}" style="cursor: pointer;">
                    <td onclick="event.stopPropagation()"><input type="checkbox" class="schedule-item-cb" value="${s.id}"></td>
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

            tbody.querySelectorAll('.schedule-insert-btn').forEach(btn => {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const row = this.closest('tr.schedule-insert-row');
                    const idx = row ? parseInt(row.getAttribute('data-insert-index'), 10) : null;
                    const structureId = row ? row.getAttribute('data-insert-structure-id') : null;
                    openScheduleItemModal(null, idx, structureId || null);
                });
            });
            tbody.querySelectorAll('tr[data-schedule-item-id]').forEach(tr => {
                tr.addEventListener('click', function (e) {
                    if (e.target.type === 'checkbox') return;
                    if (e.target.closest('.schedule-drag-handle')) return;
                    if (window._scheduleSortJustEnded) {
                        window._scheduleSortJustEnded = false;
                        return;
                    }
                    const id = parseInt(this.getAttribute('data-schedule-item-id'), 10);
                    openScheduleItemModal(id);
                });
                const handle = tr.querySelector('.schedule-drag-handle');
                if (handle) {
                    handle.addEventListener('mousedown', function (e) {
                        e.stopPropagation();
                    });
                    handle.addEventListener('dragstart', function (e) {
                        e.dataTransfer.setData('text/plain', String(tr.getAttribute('data-schedule-item-id')));
                        e.dataTransfer.effectAllowed = 'move';
                        tr.classList.add('dragging');
                    });
                    handle.addEventListener('dragend', function () {
                        tr.classList.remove('dragging');
                        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-before', 'drag-over-after'));
                        window._scheduleSortJustEnded = true;
                        setTimeout(function () { window._scheduleSortJustEnded = false; }, 200);
                    });
                }
                tr.addEventListener('dragover', function (e) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    const id = tr.getAttribute('data-schedule-item-id');
                    const draggedId = e.dataTransfer.getData('text/plain');
                    if (id === draggedId) return;
                    const rect = tr.getBoundingClientRect();
                    const mid = rect.top + rect.height / 2;
                    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-before', 'drag-over-after'));
                    tr.classList.add(e.clientY < mid ? 'drag-over-before' : 'drag-over-after');
                });
                tr.addEventListener('dragleave', function () {
                    tr.classList.remove('drag-over-before', 'drag-over-after');
                });
                tr.addEventListener('drop', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-before', 'drag-over-after'));
                    const draggedId = parseInt(e.dataTransfer.getData('text/plain'), 10);
                    const dropId = parseInt(tr.getAttribute('data-schedule-item-id'), 10);
                    if (draggedId === dropId) return;
                    const rect = tr.getBoundingClientRect();
                    const insertBefore = e.clientY < rect.top + rect.height / 2;
                    reorderScheduleItems(draggedId, dropId, insertBefore);
                });
            });
        }
        const checkAll = document.getElementById('scheduleItemCheckAll');
        if (checkAll) checkAll.checked = false;
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="12" class="error">' + escapeHtml(e.message) + '</td></tr>';
    }
}

async function reorderScheduleItems(draggedId, dropTargetId, insertBefore) {
    const sorted = [...scheduleItems].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
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
            const res = await fetch(`/api/scheduleItems/${s.id}`, {
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
        loadScheduleItems();
    } catch (err) {
        alert(err.message);
    }
}

function toggleScheduleItemCheckAll(checkbox) {
    document.querySelectorAll('.schedule-item-cb').forEach(cb => { cb.checked = checkbox.checked; });
}

async function deleteSelectedScheduleItems() {
    const ids = Array.from(document.querySelectorAll('.schedule-item-cb:checked')).map(cb => parseInt(cb.value, 10));
    if (ids.length === 0) {
        alert('삭제할 항목을 선택하세요.');
        return;
    }
    if (!confirm(`선택한 ${ids.length}건을 삭제하시겠습니까?`)) return;
    try {
        for (const id of ids) {
            const res = await fetch(`/api/scheduleItems/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '삭제 실패');
            }
        }
        alert('삭제되었습니다.');
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;
        await loadScheduleItems();
        window.scrollTo(scrollX, scrollY);
    } catch (e) {
        alert(e.message);
    }
}

function fillScheduleItemTaskTypeOptions() {
    fillScheduleItemTaskTypeOptionsFromFilter(document.getElementById('scheduleItemStructureTemplateId')?.value || '');
}

function openScheduleTaskTypeModal(id, insertAtIndex) {
    const modal = document.getElementById('scheduleTaskTypeModal');
    const title = document.getElementById('scheduleTaskTypeModalTitle');
    const form = document.getElementById('scheduleTaskTypeForm');
    const deleteBtn = document.getElementById('scheduleTaskTypeModalDeleteBtn');
    const scopeGroup = document.getElementById('scheduleTaskTypeStructureScopeGroup');
    const scopeAll = document.querySelector('input[name="scheduleTaskTypeScope"][value="all"]');
    const scopeSpecific = document.querySelector('input[name="scheduleTaskTypeScope"][value="specific"]');
    const checkboxesContainer = document.getElementById('scheduleTaskTypeStructureCheckboxes');
    if (!modal || !form) return;
    form.reset();
    scheduleTaskTypeInsertAtIndex = id == null && typeof insertAtIndex === 'number' ? insertAtIndex : null;
    document.getElementById('scheduleTaskTypeId').value = id ? id : '';
    if (checkboxesContainer && (scheduleStructureTemplates || []).length > 0) {
        checkboxesContainer.innerHTML = scheduleStructureTemplates.map(st =>
            `<label class="block-checkbox" style="display: inline-flex; align-items: center; white-space: nowrap; margin: 0;"><input type="checkbox" class="schedule-task-type-structure-cb" value="${st.id}"> ${escapeHtml(st.name)}</label>`
        ).join('');
    }
    if (id) {
        const t = scheduleTaskTypes.find(x => Number(x.id) === Number(id));
        if (!t) return;
        title.textContent = '작업 유형 수정';
        document.getElementById('scheduleTaskTypeName').value = t.name || '';
        const categoryEl = document.getElementById('scheduleTaskTypeCategory');
        if (categoryEl) categoryEl.value = (t.category && String(t.category).trim()) || '';
        if (scopeAll) scopeAll.checked = t.appliesToAllStructures !== false;
        if (scopeSpecific) scopeSpecific.checked = t.appliesToAllStructures === false;
        if (scopeGroup) scopeGroup.style.display = t.appliesToAllStructures === false ? 'block' : 'none';
        if (t.appliesToAllStructures === false && checkboxesContainer) {
            const scopeIds = (t.structureScopes || []).map(s => (s.structureTemplate && s.structureTemplate.id) || s.structureTemplateId).filter(Boolean);
            checkboxesContainer.querySelectorAll('.schedule-task-type-structure-cb').forEach(cb => {
                cb.checked = scopeIds.includes(parseInt(cb.value, 10)) || scopeIds.includes(cb.value);
            });
        }
        if (deleteBtn) deleteBtn.style.display = 'inline-block';
    } else {
        title.textContent = '작업 유형 추가';
        const categoryEl = document.getElementById('scheduleTaskTypeCategory');
        if (categoryEl) categoryEl.value = '';
        if (scopeAll) scopeAll.checked = true;
        if (scopeSpecific) scopeSpecific.checked = false;
        if (scopeGroup) scopeGroup.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'none';
    }
    modal.classList.add('show');
}

function closeScheduleTaskTypeModal() {
    scheduleTaskTypeInsertAtIndex = null;
    if (window._pendingNewTaskTypeForScheduleItem) {
        const sel = document.getElementById('scheduleItemTaskTypeId');
        if (sel) sel.value = '';
        window._pendingNewTaskTypeForScheduleItem = false;
    }
    document.getElementById('scheduleTaskTypeModal')?.classList.remove('show');
}

document.querySelectorAll('input[name="scheduleTaskTypeScope"]').forEach(radio => {
    radio.addEventListener('change', function () {
        const group = document.getElementById('scheduleTaskTypeStructureScopeGroup');
        if (group) group.style.display = this.value === 'specific' ? 'block' : 'none';
    });
});

document.getElementById('scheduleTaskTypeForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('scheduleTaskTypeId').value;
    const name = document.getElementById('scheduleTaskTypeName').value.trim();
    if (!name) {
        alert('이름을 입력하세요.');
        return;
    }
    const categoryEl = document.getElementById('scheduleTaskTypeCategory');
    const category = (categoryEl && categoryEl.value && categoryEl.value.trim()) ? categoryEl.value.trim() : null;
    const scopeAll = document.querySelector('input[name="scheduleTaskTypeScope"][value="all"]');
    const appliesToAllStructures = !scopeAll || scopeAll.checked;
    const structureTemplateIds = appliesToAllStructures ? [] : Array.from(document.querySelectorAll('.schedule-task-type-structure-cb:checked')).map(cb => parseInt(cb.value, 10) || cb.value);
    const sorted = [...scheduleTaskTypes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const sortOrder = id ? (scheduleTaskTypes.find(x => x.id === parseInt(id, 10))?.sortOrder ?? 0) : sorted.length;
    const payload = {
        code: null,
        name,
        category,
        sortOrder,
        appliesToAllStructures,
        structureTemplateIds
    };
    try {
        if (id) {
            const res = await fetch(`/api/scheduleTaskTypes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '수정 실패');
            }
            alert('작업 유형이 수정되었습니다.');
        } else {
            const res = await fetch('/api/scheduleTaskTypes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '추가 실패');
            }
            const created = await res.json();
            alert('작업 유형이 추가되었습니다.');
            scheduleTaskTypeInsertAtIndex = null;
            closeScheduleTaskTypeModal();
            await loadScheduleTaskTypes();
            if (window._pendingNewTaskTypeForScheduleItem) {
                await fillScheduleItemTaskTypeOptionsFromFilter(document.getElementById('scheduleItemStructureTemplateId')?.value || '');
                const sel = document.getElementById('scheduleItemTaskTypeId');
                if (sel) sel.value = String(created.id);
                window._pendingNewTaskTypeForScheduleItem = false;
            }
            loadScheduleItems();
            return;
        }
        closeScheduleTaskTypeModal();
        loadScheduleTaskTypes();
    } catch (err) {
        alert(err.message);
    }
});

async function deleteScheduleTaskType(id) {
    if (!confirm('이 작업 유형을 삭제하시겠습니까?')) return;
    try {
        const res = await fetch(`/api/scheduleTaskTypes/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || '삭제 실패');
        }
        alert('삭제되었습니다.');
        closeScheduleTaskTypeModal();
        loadScheduleTaskTypes();
        loadScheduleItems();
    } catch (e) {
        alert(e.message);
    }
}

function deleteScheduleTaskTypeFromModal() {
    const id = document.getElementById('scheduleTaskTypeId').value;
    if (!id) return;
    deleteScheduleTaskType(parseInt(id, 10));
}

function openScheduleBasisTypeModal(id, insertAtIndex) {
    const modal = document.getElementById('scheduleBasisTypeModal');
    const title = document.getElementById('scheduleBasisTypeModalTitle');
    const form = document.getElementById('scheduleBasisTypeForm');
    const deleteBtn = document.getElementById('scheduleBasisTypeModalDeleteBtn');
    if (!modal || !form) return;
    form.reset();
    scheduleBasisTypeInsertAtIndex = id == null && typeof insertAtIndex === 'number' ? insertAtIndex : null;
    document.getElementById('scheduleBasisTypeId').value = id ? String(id) : '';
    if (id) {
        const b = scheduleBasisTypes.find(x => x.id === parseInt(id, 10));
        if (!b) return;
        title.textContent = '기준 유형 수정';
        document.getElementById('scheduleBasisTypeName').value = b.name || '';
        document.getElementById('scheduleBasisTypeTargetType').value = (b.targetType === 'pig' ? 'non_breeding' : b.targetType) || '';
        if (deleteBtn) deleteBtn.style.display = 'inline-block';
    } else {
        title.textContent = '기준 유형 추가';
        if (deleteBtn) deleteBtn.style.display = 'none';
    }
    modal.classList.add('show');
}

function closeScheduleBasisTypeModal() {
    scheduleBasisTypeInsertAtIndex = null;
    if (window._pendingNewBasisTypeForScheduleItem) {
        const sel = document.getElementById('scheduleItemBasisTypeId');
        if (sel) sel.value = '';
        window._pendingNewBasisTypeForScheduleItem = false;
    }
    document.getElementById('scheduleBasisTypeModal')?.classList.remove('show');
}

document.getElementById('scheduleBasisTypeForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('scheduleBasisTypeId').value;
    const name = document.getElementById('scheduleBasisTypeName').value.trim();
    if (!name) {
        alert('이름을 입력하세요.');
        return;
    }
    const targetType = document.getElementById('scheduleBasisTypeTargetType').value || null;
    const sorted = [...scheduleBasisTypes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const existing = id ? scheduleBasisTypes.find(x => x.id === parseInt(id, 10)) : null;
    const sortOrder = id ? (existing?.sortOrder ?? 0) : sorted.length;
    const payload = {
        code: existing ? existing.code : null,
        name,
        targetType,
        description: null,
        sortOrder
    };
    try {
        if (id) {
            const res = await fetch(`/api/scheduleBasisTypes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '수정 실패');
            }
            alert('기준 유형이 수정되었습니다.');
        } else {
            const res = await fetch('/api/scheduleBasisTypes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '추가 실패');
            }
            const created = await res.json();
            alert('기준 유형이 추가되었습니다.');
            scheduleBasisTypeInsertAtIndex = null;
            closeScheduleBasisTypeModal();
            await loadScheduleBasisTypes();
            if (window._pendingNewBasisTypeForScheduleItem) {
                const targetType = window._pendingNewBasisTypeTargetType || document.getElementById('scheduleItemTargetType')?.value || 'non_breeding';
                fillScheduleItemBasisTypeOptions(targetType);
                const sel = document.getElementById('scheduleItemBasisTypeId');
                if (sel) sel.value = String(created.id);
                window._pendingNewBasisTypeForScheduleItem = false;
            }
            loadScheduleItems();
            return;
        }
        closeScheduleBasisTypeModal();
        loadScheduleBasisTypes();
        loadScheduleItems();
    } catch (err) {
        alert(err.message);
    }
});

async function deleteScheduleBasisType(id) {
    if (!confirm('이 기준 유형을 삭제하시겠습니까?')) return;
    try {
        const res = await fetch(`/api/scheduleBasisTypes/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || '삭제 실패');
        }
        alert('삭제되었습니다.');
        closeScheduleBasisTypeModal();
        loadScheduleBasisTypes();
        loadScheduleItems();
    } catch (e) {
        alert(e.message);
    }
}

function deleteScheduleBasisTypeFromModal() {
    const id = document.getElementById('scheduleBasisTypeId').value;
    if (!id) return;
    deleteScheduleBasisType(parseInt(id, 10));
}

function fillScheduleItemBasisTypeOptions(targetType) {
    const sel = document.getElementById('scheduleItemBasisTypeId');
    if (!sel || !scheduleBasisTypes) return;
    const filtered = scheduleBasisTypes.filter(b =>
        b.targetType === targetType || !b.targetType || (b.targetType === 'pig' && isPigTargetType(targetType))
    );
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">선택 안 함</option>' + filtered.map(b => `<option value="${b.id}">${b.name}</option>`).join('') + '<option value="__add__">➕ 기준항목 추가</option>';
    if (currentVal && currentVal !== '__add__' && filtered.some(b => b.id === parseInt(currentVal, 10))) sel.value = currentVal;
    else if (currentVal !== '__add__') sel.value = '';
}

async function openScheduleItemModal(id, insertAtIndex, preSelectStructureId) {
    const modal = document.getElementById('scheduleItemModal');
    const form = document.getElementById('scheduleItemForm');
    const deleteBtn = document.getElementById('scheduleItemModalDeleteBtn');
    if (!modal || !form) return;
    form.reset();
    scheduleInsertAtIndex = id == null && typeof insertAtIndex === 'number' ? insertAtIndex : null;
    document.getElementById('scheduleItemId').value = id ? id : '';
    document.getElementById('scheduleItemModalTitle').textContent = id ? '일정 수정' : '일정 추가';
    await loadStructureTemplatesForSchedule();
    const selStructure = document.getElementById('scheduleItemStructureTemplateId');
    if (!id && preSelectStructureId && selStructure && Array.from(selStructure.options).some(opt => opt.value === preSelectStructureId)) {
        selStructure.value = preSelectStructureId;
    }
    const selTask = document.getElementById('scheduleItemTaskTypeId');
    const rawType = id ? (scheduleItems.find(x => x.id === id)?.targetType || 'non_breeding') : 'non_breeding';
    const targetType = (rawType === 'pig' ? 'non_breeding' : rawType);
    document.getElementById('scheduleItemTargetType').value = targetType;
    fillScheduleItemBasisTypeOptions(targetType);
    const ageLabelGroup = document.getElementById('scheduleItemAgeLabelGroup');
    const ageLabelInput = document.getElementById('scheduleItemAgeLabel');
    const recurrenceGroup = document.getElementById('scheduleItemRecurrenceGroup');
    const basisGroup = document.getElementById('scheduleItemBasisGroup');
    const dayRangeGroup = document.getElementById('scheduleItemDayRangeGroup');
    const recurrenceTypeRow = document.getElementById('scheduleItemRecurrenceTypeRow');
    if (isPigTargetType(targetType)) {
        if (ageLabelGroup) ageLabelGroup.style.display = 'block';
        if (ageLabelInput && !id) ageLabelInput.value = '';
        if (recurrenceGroup) recurrenceGroup.style.display = 'none';
        if (basisGroup) basisGroup.style.display = 'block';
        if (dayRangeGroup) dayRangeGroup.style.display = 'flex';
        if (recurrenceTypeRow) recurrenceTypeRow.style.display = '';
    } else {
        if (ageLabelGroup) ageLabelGroup.style.display = 'none';
        if (ageLabelInput) ageLabelInput.value = '';
        if (recurrenceGroup) recurrenceGroup.style.display = 'block';
        if (basisGroup) basisGroup.style.display = 'block';
        if (dayRangeGroup) dayRangeGroup.style.display = 'none';
        if (recurrenceTypeRow) recurrenceTypeRow.style.display = 'none';
    }
    if (id) {
        const s = scheduleItems.find(x => x.id === id);
        if (!s) return;
        if (selStructure) selStructure.value = s.structureTemplateId != null ? String(s.structureTemplateId) : '';
        const basisId = s.basisTypeId != null ? String(s.basisTypeId) : (isFacilityTargetType(targetType) && s.recurrenceType ? (() => {
            const code = (s.recurrenceType || '').toUpperCase();
            const map = { DAILY: 'DAILY', WEEKLY: 'WEEKLY', MONTHLY: 'MONTHLY' };
            const b = scheduleBasisTypes.find(x => x.targetType === 'facility' && x.code === map[code]);
            return b ? String(b.id) : '';
        })() : '');
        document.getElementById('scheduleItemBasisTypeId').value = basisId || '';
        if (ageLabelInput && isPigTargetType(targetType)) ageLabelInput.value = s.ageLabel || '';
        document.getElementById('scheduleItemDayMin').value = s.dayMin != null ? s.dayMin : '';
        document.getElementById('scheduleItemDayMax').value = s.dayMax != null ? s.dayMax : '';
        document.getElementById('scheduleItemDescription').value = s.description || '';
        if (recurrenceGroup && recurrenceGroup.style.display !== 'none') setScheduleItemRecurrenceFields(s);
        if (isFacilityTargetType(targetType)) toggleScheduleItemRecurrenceOptionsFromBasis();
        if (deleteBtn) deleteBtn.style.display = 'inline-block';
    } else {
        if (deleteBtn) deleteBtn.style.display = 'none';
        if (preSelectStructureId && selStructure && Array.from(selStructure.options).some(opt => opt.value === preSelectStructureId)) {
            selStructure.value = preSelectStructureId;
        }
        if (recurrenceGroup && recurrenceGroup.style.display !== 'none') {
            document.getElementById('scheduleItemRecurrenceType').value = '';
            document.getElementById('scheduleItemRecurrenceStartDate').value = '';
            document.getElementById('scheduleItemRecurrenceEndDate').value = '';
            document.getElementById('scheduleItemRecurrenceMonthDay').value = '';
            document.querySelectorAll('.schedule-recur-weekday').forEach(cb => { cb.checked = false; });
            toggleScheduleItemRecurrenceOptions();
        }
    }
    await fillScheduleItemTaskTypeOptionsFromFilter(selStructure?.value || '');
    if (id) {
        const s2 = scheduleItems.find(x => x.id === id);
        if (s2) document.getElementById('scheduleItemTaskTypeId').value = s2.taskTypeId != null ? String(s2.taskTypeId) : '';
    }
    toggleScheduleItemRecurrenceOptions();
    if (isFacilityTargetType(targetType)) toggleScheduleItemRecurrenceOptionsFromBasis();
    modal.classList.add('show');
}

function closeScheduleItemModal() {
    scheduleInsertAtIndex = null;
    document.getElementById('scheduleItemModal')?.classList.remove('show');
}

document.getElementById('scheduleItemTargetType')?.addEventListener('change', function () {
    const v = this.value || 'non_breeding';
    fillScheduleItemBasisTypeOptions(v);
    const ageLabelGroup = document.getElementById('scheduleItemAgeLabelGroup');
    const ageLabelInput = document.getElementById('scheduleItemAgeLabel');
    const recurrenceGroup = document.getElementById('scheduleItemRecurrenceGroup');
    const basisGroup = document.getElementById('scheduleItemBasisGroup');
    const dayRangeGroup = document.getElementById('scheduleItemDayRangeGroup');
    const recurrenceTypeRow = document.getElementById('scheduleItemRecurrenceTypeRow');
    if (isPigTargetType(v)) {
        if (ageLabelGroup) ageLabelGroup.style.display = 'block';
        if (recurrenceGroup) recurrenceGroup.style.display = 'none';
        if (basisGroup) basisGroup.style.display = 'block';
        if (dayRangeGroup) dayRangeGroup.style.display = 'flex';
        if (recurrenceTypeRow) recurrenceTypeRow.style.display = '';
        if (ageLabelInput && !ageLabelInput.value) ageLabelInput.value = '';
    } else {
        if (ageLabelGroup) ageLabelGroup.style.display = 'none';
        if (ageLabelInput) ageLabelInput.value = '';
        if (recurrenceGroup) recurrenceGroup.style.display = 'block';
        if (basisGroup) basisGroup.style.display = 'block';
        if (dayRangeGroup) dayRangeGroup.style.display = 'none';
        if (recurrenceTypeRow) recurrenceTypeRow.style.display = 'none';
        if (document.getElementById('scheduleItemBasisTypeId')) document.getElementById('scheduleItemBasisTypeId').value = '';
    }
    toggleScheduleItemRecurrenceOptions();
    if (v === 'facility') toggleScheduleItemRecurrenceOptionsFromBasis();
});

document.getElementById('scheduleItemBasisTypeId')?.addEventListener('change', function () {
    if (this.value === '__add__') {
        window._pendingNewBasisTypeForScheduleItem = true;
        window._pendingNewBasisTypeTargetType = document.getElementById('scheduleItemTargetType')?.value || 'non_breeding';
        document.getElementById('scheduleBasisTypeTargetType').value = window._pendingNewBasisTypeTargetType;
        openScheduleBasisTypeModal();
        return;
    }
    const v = document.getElementById('scheduleItemTargetType')?.value || 'non_breeding';
    if (isFacilityTargetType(v)) toggleScheduleItemRecurrenceOptionsFromBasis();
});

document.getElementById('scheduleItemStructureTemplateId')?.addEventListener('change', function () {
    fillScheduleItemTaskTypeOptionsFromFilter(this.value || '');
});

document.getElementById('scheduleItemTaskTypeId')?.addEventListener('change', function () {
    if (this.value === '__add__') {
        window._pendingNewTaskTypeForScheduleItem = true;
        openScheduleTaskTypeModal();
    }
});

document.getElementById('scheduleItemRecurrenceType')?.addEventListener('change', function () {
    toggleScheduleItemRecurrenceOptions();
});

function toggleScheduleItemRecurrenceOptions() {
    const type = document.getElementById('scheduleItemRecurrenceType')?.value || '';
    const opts = document.getElementById('scheduleItemRecurrenceOptions');
    const weekly = document.getElementById('scheduleItemRecurrenceWeekly');
    const monthly = document.getElementById('scheduleItemRecurrenceMonthly');
    if (!opts) return;
    if (!type || type === 'none') {
        opts.style.display = 'none';
        return;
    }
    opts.style.display = 'block';
    if (weekly) weekly.style.display = type === 'weekly' ? 'block' : 'none';
    if (monthly) monthly.style.display = type === 'monthly' ? 'block' : 'none';
}

/** 시설일 때 기준(매일/매주/매월) 선택에 따라 반복 세부 옵션(요일, 매월 n일) 표시 */
function toggleScheduleItemRecurrenceOptionsFromBasis() {
    const targetType = document.getElementById('scheduleItemTargetType')?.value || 'non_breeding';
    const opts = document.getElementById('scheduleItemRecurrenceOptions');
    const weekly = document.getElementById('scheduleItemRecurrenceWeekly');
    const monthly = document.getElementById('scheduleItemRecurrenceMonthly');
    if (!isFacilityTargetType(targetType) || !opts) return;
    const basisId = document.getElementById('scheduleItemBasisTypeId')?.value;
    const basis = basisId && scheduleBasisTypes ? scheduleBasisTypes.find(b => b.id === parseInt(basisId, 10)) : null;
    const code = basis && basis.targetType === 'facility' ? (basis.code || '') : '';
    if (code === 'WEEKLY') {
        opts.style.display = 'block';
        if (weekly) weekly.style.display = 'block';
        if (monthly) monthly.style.display = 'none';
    } else if (code === 'MONTHLY') {
        opts.style.display = 'block';
        if (weekly) weekly.style.display = 'none';
        if (monthly) monthly.style.display = 'block';
    } else {
        opts.style.display = 'none';
    }
}

function getScheduleItemRecurrencePayload() {
    const targetTypeVal = document.getElementById('scheduleItemTargetType')?.value || 'non_breeding';
    let type = null;
    if (isFacilityTargetType(targetTypeVal)) {
        const basisId = document.getElementById('scheduleItemBasisTypeId')?.value;
        const basis = basisId && scheduleBasisTypes ? scheduleBasisTypes.find(b => b.id === parseInt(basisId, 10)) : null;
        if (basis && basis.targetType === 'facility' && basis.code) {
            const codeMap = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly' };
            type = codeMap[basis.code] || null;
        }
    } else {
        type = (document.getElementById('scheduleItemRecurrenceType')?.value || '').trim() || null;
    }
    if (!type) {
        return {
            recurrenceType: null,
            recurrenceInterval: null,
            recurrenceWeekdays: null,
            recurrenceMonthDay: null
        };
    }
    const weekdays = Array.from(document.querySelectorAll('.schedule-recur-weekday:checked')).map(cb => cb.value).sort().join(',') || null;
    const monthDay = document.getElementById('scheduleItemRecurrenceMonthDay')?.value;
    return {
        recurrenceType: type,
        recurrenceInterval: 1,
        recurrenceWeekdays: type === 'weekly' ? weekdays : null,
        recurrenceMonthDay: type === 'monthly' && monthDay !== '' ? parseInt(monthDay, 10) : null
    };
}

function setScheduleItemRecurrenceFields(item) {
    document.getElementById('scheduleItemRecurrenceType').value = item.recurrenceType || '';
    document.getElementById('scheduleItemRecurrenceMonthDay').value = item.recurrenceMonthDay != null ? item.recurrenceMonthDay : '';
    document.querySelectorAll('.schedule-recur-weekday').forEach(cb => { cb.checked = false; });
    if (item.recurrenceWeekdays) {
        item.recurrenceWeekdays.split(',').forEach(s => {
            const n = parseInt(s.trim(), 10);
            const el = document.querySelector(`.schedule-recur-weekday[value="${n}"]`);
            if (el) el.checked = true;
        });
    }
    toggleScheduleItemRecurrenceOptions();
}

document.getElementById('scheduleItemForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('scheduleItemId').value;
    const structureTemplateId = document.getElementById('scheduleItemStructureTemplateId').value;
    const basisTypeId = document.getElementById('scheduleItemBasisTypeId').value;
    const taskTypeId = document.getElementById('scheduleItemTaskTypeId').value;
    if (!taskTypeId || taskTypeId === '__add__') {
        alert('작업유형을 선택하세요.');
        return;
    }
    const targetTypeVal = document.getElementById('scheduleItemTargetType').value || 'non_breeding';
    const ageLabelEl = document.getElementById('scheduleItemAgeLabel');
    const recurrencePayload = getScheduleItemRecurrencePayload();
    const payload = {
        targetType: targetTypeVal,
        structureTemplateId: structureTemplateId ? parseInt(structureTemplateId, 10) : null,
        basisTypeId: (basisTypeId && basisTypeId !== '__add__' ? parseInt(basisTypeId, 10) : null),
        ageLabel: isPigTargetType(targetTypeVal) && ageLabelEl ? (ageLabelEl.value.trim() || null) : null,
        dayMin: !isFacilityTargetType(targetTypeVal) ? (document.getElementById('scheduleItemDayMin').value === '' ? null : parseInt(document.getElementById('scheduleItemDayMin').value, 10)) : null,
        dayMax: !isFacilityTargetType(targetTypeVal) ? (document.getElementById('scheduleItemDayMax').value === '' ? null : parseInt(document.getElementById('scheduleItemDayMax').value, 10)) : null,
        taskTypeId: (taskTypeId && taskTypeId !== '__add__' ? parseInt(taskTypeId, 10) : null),
        description: document.getElementById('scheduleItemDescription').value.trim() || null,
        ...recurrencePayload
    };
    try {
        if (id) {
            const res = await fetch(`/api/scheduleItems/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '수정 실패');
            }
            alert('일정이 수정되었습니다.');
        } else {
            const sorted = [...scheduleItems].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
            const insertAt = scheduleInsertAtIndex;
            if (typeof insertAt === 'number' && insertAt >= 0) {
                for (let i = insertAt; i < sorted.length; i++) {
                    const s = sorted[i];
                    const newOrder = i + 1;
                    await fetch(`/api/scheduleItems/${s.id}`, {
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
                            sortOrder: newOrder,
                            isActive: s.isActive !== false,
                            recurrenceType: s.recurrenceType ?? null,
                            recurrenceInterval: s.recurrenceInterval ?? null,
                            recurrenceWeekdays: s.recurrenceWeekdays ?? null,
                            recurrenceMonthDay: s.recurrenceMonthDay ?? null
                        })
                    });
                }
                payload.sortOrder = insertAt;
            } else {
                payload.sortOrder = sorted.length;
            }
            const res = await fetch('/api/scheduleItems', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '추가 실패');
            }
            alert('일정이 추가되었습니다.');
            scheduleInsertAtIndex = null;
        }
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;
        closeScheduleItemModal();
        resetScheduleItemFilters();
        await loadScheduleItems();
        window.scrollTo(scrollX, scrollY);
    } catch (err) {
        alert(err.message);
    }
});

function resetScheduleItemFilters() {
    const selTarget = document.getElementById('scheduleFilterTargetType');
    const selStructure = document.getElementById('scheduleFilterStructure');
    const selBasis = document.getElementById('scheduleFilterBasisType');
    const selTask = document.getElementById('scheduleFilterTaskType');
    if (selTarget) selTarget.value = '';
    if (selStructure) selStructure.value = '';
    if (selBasis) selBasis.value = '';
    if (selTask) selTask.value = '';
}

async function deleteScheduleItem(id) {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    try {
        const res = await fetch(`/api/scheduleItems/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || '삭제 실패');
        }
        alert('삭제되었습니다.');
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;
        closeScheduleItemModal();
        await loadScheduleItems();
        window.scrollTo(scrollX, scrollY);
    } catch (e) {
        alert(e.message);
    }
}

function deleteScheduleItemFromModal() {
    const id = document.getElementById('scheduleItemId').value;
    if (!id) return;
    deleteScheduleItem(parseInt(id, 10));
}
