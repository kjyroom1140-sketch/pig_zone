// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadDashboard();
    initNavigation();
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
            const subMenuId = { users: 'navUsersList', settings: 'navSettingsList' }[section];
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
    const statUsersEl = document.getElementById('statUsers');
    const statFarmsEl = document.getElementById('statFarms');
    try {
        const statsResponse = await fetch('/api/admin/stats');
        const statsData = await statsResponse.json();
        if (!statsResponse.ok || !statsData || !statsData.stats) {
            if (statUsersEl) statUsersEl.textContent = '-';
            if (statFarmsEl) statFarmsEl.textContent = '-';
            return;
        }
        const { users = 0, farms = 0 } = statsData.stats;
        if (statUsersEl) statUsersEl.textContent = (users - 1) + ' 명';
        if (statFarmsEl) statFarmsEl.textContent = farms;
    } catch (error) {
        console.error('대시보드 로드 오류:', error);
        if (statUsersEl) statUsersEl.textContent = '-';
        if (statFarmsEl) statFarmsEl.textContent = '-';
    }
}

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
    } else if (tabName === 'scheduleMasters') {
        loadScheduleMastersPage();
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

    productionBody.innerHTML = '<tr><td colspan="6" class="loading">데이터를 불러오는 중...</td></tr>';
    generalBody.innerHTML = '<tr><td colspan="3" class="loading">데이터를 불러오는 중...</td></tr>';

    try {
        const response = await fetch('/api/structureTemplates');
        if (!response.ok) throw new Error('데이터 로드 실패');

        structureTemplates = await response.json();
        renderStructureTemplatesTable();
    } catch (error) {
        console.error('템플릿 로드 오류:', error);
        productionBody.innerHTML = '<tr><td colspan="6" class="error">데이터를 불러오는데 실패했습니다.</td></tr>';
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
        productionBody.innerHTML = '<tr><td colspan="6" class="no-data">등록된 사육 시설 기준이 없습니다.</td></tr>';
    } else {
        productionBody.innerHTML = productionTemplates.map((t, idx) => {
            const ageLabel = t.ageLabel || '-';
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
                    <td>${ageLabel}</td>
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
    const ageLabelGroup = document.getElementById(`${prefix}AgeLabelGroup`);

    if (category === 'production') {
        if (densityGroup) densityGroup.style.display = 'block';
        if (weightGroup) weightGroup.style.display = 'block';
        if (ageLabelGroup) ageLabelGroup.style.display = 'block';
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
        if (ageLabelGroup) {
            ageLabelGroup.style.display = 'none';
            const ageLabelInput = document.getElementById(`${prefix}StructAgeLabel`);
            if (ageLabelInput) ageLabelInput.value = '';
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
    const ageLabelInput = document.getElementById(`${prefix}StructAgeLabel`);
    if (ageLabelInput) {
        ageLabelInput.value = t.ageLabel || '';
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
                ageLabel: document.getElementById('newStructAgeLabel') ? document.getElementById('newStructAgeLabel').value.trim() || null : null,
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
                ageLabel: document.getElementById('editStructAgeLabel') ? document.getElementById('editStructAgeLabel').value.trim() || null : null,
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

// ========== 일정 관리 설정 (문서: schedule_structure_design.md) ==========
let scheduleDivisions = [];
let scheduleBases = [];
let scheduleWorkTypes = [];
let scheduleWorkDetailTypes = [];
let scheduleStructureTemplates = [];
let scheduleItems = [];
let scheduleViewMode = 'all'; // 'all' | 'move'
/** @deprecated 구 API 제거됨. 리스트 모달 대신 일정 추가 모달에서 기준/세부 추가 사용. */
let scheduleTaskTypes = [];
/** @deprecated 구 API 제거됨. 리스트 모달 대신 일정 추가 모달에서 기준 추가 사용. */
let scheduleBasisTypes = [];
/** + 버튼으로 특정 위치에 추가할 때 사용. null이면 맨 뒤에 추가 */
let scheduleInsertAtIndex = null;

/** 구분 코드가 시설인지 (반복·일수 표시용) */
function isDivisionFacility(division) { return division && division.code === 'facility'; }
/** 구분 표시명 */
function scheduleDivisionLabel(div) { return div ? div.name : '-'; }

/** schedule_* API 행에서 옵션 표시명 추출 (TEXT JSON 또는 문자열) */
function scheduleOptionLabel(row, textKey) {
    const raw = row && row[textKey];
    if (raw == null || raw === '') return '항목 ' + (row.id ?? '');
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed) && parsed.length) {
            const first = parsed[0];
            if (first && (first.name != null || first.label != null)) return first.name || first.label;
            return String(parsed[0]).slice(0, 40);
        }
        if (parsed && typeof parsed === 'object' && (parsed.name != null || parsed.label != null)) return parsed.name || parsed.label;
    } catch (_) {}
    return String(raw).slice(0, 50) || '항목 ' + (row.id ?? '');
}

async function loadScheduleSettings() {
    try {
        await Promise.all([
            loadScheduleDivisions(),
            loadScheduleBases(),
            loadScheduleWorkTypes(),
            loadScheduleWorkDetailTypes(),
            loadStructureTemplatesForSchedule()
        ]);
        updateScheduleViewModeLabel();
    } catch (e) {
        console.warn('일정 설정 로드 중 일부 실패:', e);
    }
    try {
        await loadScheduleItems();
    } catch (e) {
        console.warn('일정 항목 로드 실패:', e);
        const tbody = document.getElementById('scheduleItemsBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="11" class="text-muted">일정 목록을 불러올 수 없습니다.</td></tr>';
    }
}

async function loadScheduleDivisions() {
    scheduleDivisions = [];
    const sel = document.getElementById('scheduleFilterDivisionId');
    if (sel) sel.innerHTML = '<option value="">전체</option>';
    try {
        const res = await fetch('/api/schedule-sortations');
        const list = res.ok ? await res.json() : [];
        scheduleDivisions = list.map(r => ({ id: r.id, name: scheduleOptionLabel(r, 'sortations'), structure_template_id: r.structure_template_id }));
        if (sel) sel.innerHTML = '<option value="">전체</option>' + scheduleDivisions.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
    } catch (e) {
        console.warn('schedule-sortations 로드 실패:', e);
    }
}

async function loadScheduleBases() {
    scheduleBases = [];
    const sel = document.getElementById('scheduleFilterBasisId');
    if (sel) sel.innerHTML = '<option value="">전체</option>';
    try {
        const res = await fetch('/api/schedule-criterias');
        const list = res.ok ? await res.json() : [];
        scheduleBases = list.map(r => ({ id: r.id, name: scheduleOptionLabel(r, 'criterias') }));
        if (sel) sel.innerHTML = '<option value="">전체</option>' + scheduleBases.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
    } catch (e) {
        console.warn('schedule-criterias 로드 실패:', e);
    }
}

async function loadScheduleWorkTypes() {
    scheduleWorkTypes = [];
    try {
        const res = await fetch('/api/schedule-jobtypes');
        const list = res.ok ? await res.json() : [];
        scheduleWorkTypes = list.map(r => ({ id: r.id, name: scheduleOptionLabel(r, 'jobtypes') }));
    } catch (e) {
        console.warn('schedule-jobtypes 로드 실패:', e);
    }
}

async function loadScheduleWorkDetailTypes() {
    scheduleWorkDetailTypes = [];
    const sel = document.getElementById('scheduleFilterWorkDetailTypeId');
    if (sel) sel.innerHTML = '<option value="">전체</option>';
    try {
        const res = await fetch('/api/schedule-jobtypes');
        const list = res.ok ? await res.json() : [];
        const details = [];
        list.forEach(r => {
            try {
                const raw = r.jobtypes;
                const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (Array.isArray(arr)) {
                    arr.forEach(item => {
                        if (item && (item.id != null || item.name)) details.push({ id: item.id ?? item.name, name: item.name || item.label || String(item.id) });
                        if (item && Array.isArray(item.details)) item.details.forEach(d => { if (d && (d.id != null || d.name)) details.push({ id: d.id ?? d.name, name: d.name || d.label || String(d.id) }); });
                    });
                }
            } catch (_) {}
        });
        scheduleWorkDetailTypes = details.length ? details : scheduleWorkTypes.slice();
        if (sel) sel.innerHTML = '<option value="">전체</option>' + scheduleWorkDetailTypes.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
    } catch (e) {
        console.warn('schedule-work-detail-types( jobtypes ) 로드 실패:', e);
    }
}

async function loadStructureTemplatesForSchedule() {
    try {
        const res = await fetch('/api/structureTemplates');
        const list = res.ok ? await res.json() : [];
        scheduleStructureTemplates = list.filter(t => t.category === 'production');
        const selFilter = document.getElementById('scheduleFilterStructure');
        const selModal = document.getElementById('scheduleItemStructureTemplateId');
        if (selFilter) {
            selFilter.innerHTML = '<option value="">전체</option>' + scheduleStructureTemplates.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
        }
        if (selModal) {
            selModal.innerHTML = '<option value="">선택</option><option value="__all__">전체 시설</option>' + scheduleStructureTemplates.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
        }
    } catch (e) {
        console.error(e);
    }
}

/** 선택한 장소에 따라 구분 셀렉트 채움. 옵션 소스: schedule_sortations. 셀렉트 하단에 항상 "+ 구분 추가" 표시. */
function fillScheduleItemDivisionOptions(structureTemplateId) {
    const sel = document.getElementById('scheduleItemDivisionId');
    if (!sel) return;
    if (!structureTemplateId) {
        sel.innerHTML = '<option value="">장소를 먼저 선택하세요</option>';
        document.getElementById('scheduleItemWorkTypeId').innerHTML = '<option value="">구분을 먼저 선택하세요</option>';
        document.getElementById('scheduleItemWorkDetailTypeId').innerHTML = '<option value="">대분류를 먼저 선택하세요</option>';
        return;
    }
    const currentVal = sel.value;
    let optionsHtml = '<option value="">선택</option>';
    optionsHtml += scheduleDivisions.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
    optionsHtml += '<option value="__add__">➕ 구분 추가</option>';
    sel.innerHTML = optionsHtml;
    if (currentVal && currentVal !== '__add__' && scheduleDivisions.some(d => d.id === parseInt(currentVal, 10))) sel.value = currentVal;
    else sel.value = '';
    fillScheduleItemWorkTypeOptions(sel.value);
    fillScheduleItemBasisOptions(sel.value);
}

/** 기준 셀렉트 채움. 옵션 소스: schedule_criterias. 셀렉트 하단에 항상 "+ 기준 추가" 표시. */
function fillScheduleItemBasisOptions(divisionId) {
    const sel = document.getElementById('scheduleItemBasisId');
    if (!sel) return;
    if (!divisionId) {
        sel.innerHTML = '<option value="">구분을 먼저 선택하세요</option>';
        return;
    }
    const currentVal = sel.value;
    let optionsHtml = '<option value="">선택</option>' + scheduleBases.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
    optionsHtml += '<option value="__add__">➕ 기준 추가</option>';
    sel.innerHTML = optionsHtml;
    if (currentVal && currentVal !== '__add__' && scheduleBases.some(b => b.id === parseInt(currentVal, 10))) sel.value = currentVal;
    else sel.value = '';
}

/** 구분 선택 시 작업유형 대분류 셀렉트 채움. 옵션 소스: schedule_jobtypes. 셀렉트 하단에 항상 "+ 작업유형 추가" 표시. */
function fillScheduleItemWorkTypeOptions(divisionId) {
    const selWorkType = document.getElementById('scheduleItemWorkTypeId');
    const selDetail = document.getElementById('scheduleItemWorkDetailTypeId');
    if (!selWorkType) return;
    selDetail.innerHTML = '<option value="">대분류를 먼저 선택하세요</option>';
    if (!divisionId || divisionId === '__add__') {
        selWorkType.innerHTML = '<option value="">구분을 먼저 선택하세요</option>';
        return;
    }
    const currentVal = selWorkType.value;
    let optionsHtml = '<option value="">선택</option>' + scheduleWorkTypes.map(w => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
    optionsHtml += '<option value="__add__">➕ 작업유형 추가</option>';
    selWorkType.innerHTML = optionsHtml;
    if (currentVal && currentVal !== '__add__' && scheduleWorkTypes.some(w => w.id === parseInt(currentVal, 10))) selWorkType.value = currentVal;
    else selWorkType.value = '';
    fillScheduleItemWorkDetailOptions(selWorkType.value);
}

/** 대분류 선택 시 작업 내용(세부) 셀렉트 채움. 옵션 소스: schedule_jobtypes(세부 목록). */
function fillScheduleItemWorkDetailOptions(workTypeId) {
    const sel = document.getElementById('scheduleItemWorkDetailTypeId');
    if (!sel) return;
    if (!workTypeId) {
        sel.innerHTML = '<option value="">대분류를 먼저 선택하세요</option>';
        return;
    }
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">선택</option>' + scheduleWorkDetailTypes.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
    if (currentVal && currentVal !== '__add__' && scheduleWorkDetailTypes.some(d => d.id == currentVal || String(d.id) === currentVal)) sel.value = currentVal;
    else sel.value = '';
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
    alert('작업유형(대분류·세부)은 일정 추가 모달에서 「작업유형 세부」 옆 + 추가 버튼으로 등록하세요.');
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

/** @deprecated 구 API 제거됨. 기준은 /api/schedule-bases 및 일정 추가 모달에서 관리. */
async function loadScheduleTaskTypes() {
    scheduleTaskTypes = [];
}

/** @deprecated 구 API 제거됨. 기준은 /api/schedule-bases 및 일정 추가 모달에서 관리. */
async function loadScheduleBasisTypes() {
    scheduleBasisTypes = [];
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
    alert('기준 유형은 일정 추가 모달에서 「기준」 옆 + 추가 버튼으로 등록하세요.');
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
    const selDiv = document.getElementById('scheduleFilterDivisionId');
    const selStructure = document.getElementById('scheduleFilterStructure');
    const selBasis = document.getElementById('scheduleFilterBasisId');
    const selWorkDetail = document.getElementById('scheduleFilterWorkDetailTypeId');
    if (kind === 'all') {
        scheduleViewMode = 'all';
        if (selDiv) selDiv.value = '';
        if (selStructure) selStructure.value = '';
        if (selBasis) selBasis.value = '';
        if (selWorkDetail) selWorkDetail.value = '';
    } else if (kind === 'move') {
        scheduleViewMode = 'move';
        if (selDiv) selDiv.value = '';
        if (selStructure) selStructure.value = '';
        if (selBasis) selBasis.value = '';
        const moveWorkType = scheduleWorkTypes.find(w => w.name === '이동');
        const moveDetail = moveWorkType ? scheduleWorkDetailTypes.find(d => d.workTypeId === moveWorkType.id && (d.name && d.name.indexOf('이동') >= 0)) : scheduleWorkDetailTypes.find(d => d.name && d.name.indexOf('이동') >= 0);
        if (selWorkDetail) selWorkDetail.value = moveDetail ? String(moveDetail.id) : '';
    } else if (kind === 'breeding' || kind === 'farrowing' || kind === 'weaning') {
        scheduleViewMode = 'all';
        if (selDiv) selDiv.value = '';
        if (selBasis) selBasis.value = '';
        if (selWorkDetail) selWorkDetail.value = '';
        if (scheduleStructureTemplates.length === 0) await loadStructureTemplatesForSchedule();
        const nameMap = { breeding: '교배사', farrowing: '분만사(모돈)', weaning: '자돈사' };
        const name = nameMap[kind];
        const found = scheduleStructureTemplates.find(t => t.name === name || (kind === 'farrowing' && t.name && t.name.indexOf('분만사') >= 0));
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

/** 일정 항목 표시 순서: 대상장소 → 구분 → 기준 → sortOrder */
function sortScheduleItemsByPlaceDivisionBasis(items) {
    return [...(items || [])].sort((a, b) => {
        const placeA = a.appliesToAllStructures ? '\uffff' : (a.structureTemplate?.name ?? '');
        const placeB = b.appliesToAllStructures ? '\uffff' : (b.structureTemplate?.name ?? '');
        if (placeA !== placeB) return placeA.localeCompare(placeB, 'ko');
        const divA = a.division?.name ?? '';
        const divB = b.division?.name ?? '';
        if (divA !== divB) return divA.localeCompare(divB, 'ko');
        const basisA = a.basis?.name ?? '';
        const basisB = b.basis?.name ?? '';
        if (basisA !== basisB) return basisA.localeCompare(basisB, 'ko');
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
}

async function loadScheduleItems() {
    const tbody = document.getElementById('scheduleItemsBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="11" class="loading">데이터를 불러오는 중...</td></tr>';
    try {
        const url = '/api/schedule-work-plans';
        const res = await fetch(url);
        if (!res.ok) {
            scheduleItems = [];
            throw new Error('일정 항목 목록 조회 실패');
        }
        scheduleItems = await res.json() || [];
        if (scheduleItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-muted">조건에 맞는 일정이 없습니다.</td></tr>' +
                '<tr class="schedule-insert-row" data-insert-index="0"><td class="schedule-insert-cell"><button type="button" class="schedule-insert-btn" title="이 위치에 일정 추가">+</button></td><td colspan="10" class="schedule-insert-spacer"></td></tr>';
            tbody.querySelectorAll('.schedule-insert-btn').forEach(btn => {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    openScheduleItemModal(null, 0);
                });
            });
        } else {
            const sorted = scheduleItems.slice().sort((a, b) => (a.id || 0) - (b.id || 0));
            const rows = [];
            for (let i = 0; i < sorted.length; i++) {
                const s = sorted[i];
                let structureData = null;
                let sortationData = null;
                let criteriaData = null;
                let jobtypeData = null;
                try {
                    if (s.structure_templates) structureData = JSON.parse(s.structure_templates);
                    if (s.schedule_sortations) sortationData = JSON.parse(s.schedule_sortations);
                    if (s.schedule_criterias) criteriaData = JSON.parse(s.schedule_criterias);
                    if (s.schedule_jobtypes) jobtypeData = JSON.parse(s.schedule_jobtypes);
                } catch (e) {
                    console.warn('JSON 파싱 실패:', e);
                }
                const place = structureData?.name || structureData?.id || s.structure_templates || '-';
                const divName = sortationData?.name || sortationData?.division || s.schedule_sortations || '-';
                const basisName = criteriaData?.name || criteriaData?.criteria || s.schedule_criterias || '-';
                const workTypeName = jobtypeData?.workType || jobtypeData?.type || s.schedule_jobtypes || '-';
                const workDetail = jobtypeData?.detail || jobtypeData?.name || s.details || '-';
                const dayMinStr = criteriaData?.dayMin != null ? criteriaData.dayMin : (sortationData?.dayMin != null ? sortationData.dayMin : '-');
                const dayMaxStr = criteriaData?.dayMax != null ? criteriaData.dayMax : (sortationData?.dayMax != null ? sortationData.dayMax : '-');
                rows.push(`<tr class="schedule-insert-row" data-insert-index="${i}"><td class="schedule-insert-cell"><button type="button" class="schedule-insert-btn" title="이 위치에 일정 추가">+</button></td><td colspan="10" class="schedule-insert-spacer"></td></tr>`);
                rows.push(`
                <tr class="clickable-row" data-schedule-item-id="${s.id}" style="cursor: pointer;">
                    <td onclick="event.stopPropagation()"><input type="checkbox" class="schedule-item-cb" value="${s.id}"></td>
                    <td>${i}</td>
                    <td onclick="event.stopPropagation()"><span class="schedule-drag-handle" draggable="true" title="드래그하여 순서 변경">≡</span></td>
                    <td>${escapeHtml(String(place))}</td>
                    <td>${escapeHtml(String(divName))}</td>
                    <td>${escapeHtml(String(basisName))}</td>
                    <td>${escapeHtml(String(dayMinStr))}</td>
                    <td>${escapeHtml(String(dayMaxStr))}</td>
                    <td>-</td>
                    <td>${escapeHtml(String(workTypeName))}</td>
                    <td>${escapeHtml(String(workDetail))}</td>
                </tr>
                `);
            }
            rows.push(`<tr class="schedule-insert-row" data-insert-index="${sorted.length}"><td class="schedule-insert-cell"><button type="button" class="schedule-insert-btn" title="이 위치에 일정 추가">+</button></td><td colspan="10" class="schedule-insert-spacer"></td></tr>`);
            tbody.innerHTML = rows.join('');

            tbody.querySelectorAll('.schedule-insert-btn').forEach(btn => {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const row = this.closest('tr.schedule-insert-row');
                    const idx = row ? parseInt(row.getAttribute('data-insert-index'), 10) : null;
                    openScheduleItemModal(null, idx);
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
        scheduleItems = [];
        tbody.innerHTML = '<tr><td colspan="11" class="text-muted">조건에 맞는 일정이 없습니다.</td></tr>' +
            '<tr class="schedule-insert-row" data-insert-index="0"><td class="schedule-insert-cell"><button type="button" class="schedule-insert-btn" title="이 위치에 일정 추가">+</button></td><td colspan="10" class="schedule-insert-spacer"></td></tr>';
        tbody.querySelectorAll('.schedule-insert-btn').forEach(btn => {
            btn.addEventListener('click', function (ev) { ev.stopPropagation(); openScheduleItemModal(null, 0); });
        });
    }
}

async function reorderScheduleItems(draggedId, dropTargetId, insertBefore) {
    const sorted = sortScheduleItemsByPlaceDivisionBasis(scheduleItems);
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
            const res = await fetch(`/api/schedule-work-plans/${s.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    structure_templates: s.structure_templates,
                    schedule_sortations: s.schedule_sortations,
                    schedule_criterias: s.schedule_criterias,
                    schedule_jobtypes: s.schedule_jobtypes,
                    details: s.details
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
            const res = await fetch(`/api/schedule-work-plans/${id}`, { method: 'DELETE' });
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

function fillScheduleItemBasisTypeOptions(targetType, preferredValue) {
    const sel = document.getElementById('scheduleItemBasisTypeId');
    if (!sel || !scheduleBasisTypes) return;
    const filtered = scheduleBasisTypes.filter(b =>
        b.targetType === targetType || !b.targetType || (b.targetType === 'pig' && isPigTargetType(targetType))
    );
    const currentVal = preferredValue !== undefined ? preferredValue : sel.value;
    sel.innerHTML = '<option value="">선택 안 함</option>' + filtered.map(b => `<option value="${b.id}">${b.name}</option>`).join('') + '<option value="__add__">➕ 기준항목 추가</option>';
    if (currentVal && currentVal !== '__add__' && filtered.some(b => b.id === parseInt(currentVal, 10))) sel.value = currentVal;
    else if (currentVal !== '__add__') sel.value = '';
}

function toggleScheduleItemRecurrenceGroupVisibility() {
    const isAllStructures = document.getElementById('scheduleItemStructureTemplateId')?.value === '__all__';
    const recurrenceGroup = document.getElementById('scheduleItemRecurrenceGroup');
    const dayRangeGroup = document.getElementById('scheduleItemDayRangeGroup');
    if (recurrenceGroup) recurrenceGroup.style.display = isAllStructures ? 'block' : 'none';
    if (dayRangeGroup) dayRangeGroup.style.display = isAllStructures ? 'none' : 'block';
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
    if (scheduleStructureTemplates.length === 0) await loadStructureTemplatesForSchedule();
    const selStructure = document.getElementById('scheduleItemStructureTemplateId');
    if (!id && preSelectStructureId && selStructure && Array.from(selStructure.options).some(opt => opt.value === preSelectStructureId)) {
        selStructure.value = preSelectStructureId;
    }
    await fillScheduleItemDivisionOptions(selStructure?.value || '');
    if (id) {
        const s = scheduleItems.find(x => x.id === id);
        if (!s) return;
        let structureData = null, divisionData = null, criteriaData = null, jobtypeData = null, detailsData = null;
        try {
            if (s.structure_templates) structureData = JSON.parse(s.structure_templates);
            if (s.schedule_sortations) divisionData = JSON.parse(s.schedule_sortations);
            if (s.schedule_criterias) criteriaData = JSON.parse(s.schedule_criterias);
            if (s.schedule_jobtypes) jobtypeData = JSON.parse(s.schedule_jobtypes);
            if (s.details) detailsData = JSON.parse(s.details);
        } catch (e) {
            console.warn('JSON 파싱 실패:', e);
        }
        const structureId = structureData?.id || null;
        const appliesAll = structureData?.appliesToAllStructures || false;
        if (selStructure) selStructure.value = appliesAll ? '__all__' : (structureId != null ? String(structureId) : '');
        await fillScheduleItemDivisionOptions(selStructure?.value || '');
        const divisionIdVal = divisionData?.id != null ? String(divisionData.id) : '';
        document.getElementById('scheduleItemDivisionId').value = divisionIdVal;
        fillScheduleItemWorkTypeOptions(divisionIdVal);
        fillScheduleItemBasisOptions(divisionIdVal);
        const workDetailTypeId = jobtypeData?.id != null ? String(jobtypeData.id) : '';
        if (workDetailTypeId) {
            const workDetailType = scheduleWorkDetailTypes?.find(wdt => wdt.id === parseInt(workDetailTypeId, 10));
            const workTypeId = workDetailType?.workTypeId != null ? String(workDetailType.workTypeId) : '';
            document.getElementById('scheduleItemWorkTypeId').value = workTypeId;
            await fillScheduleItemWorkDetailOptions(workTypeId);
        }
        document.getElementById('scheduleItemWorkDetailTypeId').value = workDetailTypeId;
        document.getElementById('scheduleItemBasisId').value = criteriaData?.id != null ? String(criteriaData.id) : '';
        document.getElementById('scheduleItemDayMin').value = criteriaData?.dayMin != null ? criteriaData.dayMin : '';
        document.getElementById('scheduleItemDayMax').value = criteriaData?.dayMax != null ? criteriaData.dayMax : '';
        if (detailsData) setScheduleItemRecurrenceFields(detailsData);
        if (deleteBtn) deleteBtn.style.display = 'inline-block';
    } else {
        if (deleteBtn) deleteBtn.style.display = 'none';
        document.getElementById('scheduleItemRecurrenceType').value = '';
        document.querySelectorAll('.schedule-recur-weekday').forEach(cb => { cb.checked = false; });
        document.getElementById('scheduleItemRecurrenceMonthDay').value = '';
    }
    toggleScheduleItemRecurrenceGroupVisibility();
    modal.classList.add('show');
}

function closeScheduleItemModal() {
    scheduleInsertAtIndex = null;
    document.getElementById('scheduleItemModal')?.classList.remove('show');
}

document.getElementById('scheduleItemStructureTemplateId')?.addEventListener('change', function () {
    fillScheduleItemDivisionOptions(this.value || '');
    toggleScheduleItemRecurrenceGroupVisibility();
    const workTypeId = document.getElementById('scheduleItemWorkTypeId')?.value || '';
    if (workTypeId) fillScheduleItemWorkDetailOptions(workTypeId);
});

document.getElementById('scheduleItemDivisionId')?.addEventListener('change', function () {
    if (this.value === '__add__') {
        openScheduleDivisionAddModalFromItem();
        this.value = '';
        return;
    }
    const divisionId = this.value || '';
    fillScheduleItemWorkTypeOptions(divisionId);
    fillScheduleItemBasisOptions(divisionId);
    const workTypeId = document.getElementById('scheduleItemWorkTypeId')?.value || '';
    if (workTypeId) fillScheduleItemWorkDetailOptions(workTypeId);
});

document.getElementById('scheduleItemWorkTypeId')?.addEventListener('change', function () {
    if (this.value === '__add__') {
        openScheduleJobtypeAddModalFromItem();
        this.value = '';
        return;
    }
    fillScheduleItemWorkDetailOptions(this.value || '');
});

document.getElementById('scheduleItemWorkDetailTypeId')?.addEventListener('change', function () {
    if (this.value === '__add__') {
        openScheduleWorkDetailAddModalFromItem();
        this.value = '';
    }
});

document.getElementById('scheduleItemBasisId')?.addEventListener('change', function () {
    if (this.value === '__add__') {
        openScheduleBasisAddModalFromItem();
        this.value = '';
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

function getScheduleItemRecurrencePayload() {
    const isAllStructures = document.getElementById('scheduleItemStructureTemplateId')?.value === '__all__';
    const type = isAllStructures ? (document.getElementById('scheduleItemRecurrenceType')?.value || '').trim() || null : null;
    if (!type) {
        return { recurrenceType: null, recurrenceInterval: null, recurrenceWeekdays: null, recurrenceMonthDay: null, recurrenceStartDate: null, recurrenceEndDate: null };
    }
    const weekdays = Array.from(document.querySelectorAll('.schedule-recur-weekday:checked')).map(cb => cb.value).sort().join(',') || null;
    const monthDay = document.getElementById('scheduleItemRecurrenceMonthDay')?.value;
    return {
        recurrenceType: type,
        recurrenceInterval: 1,
        recurrenceWeekdays: type === 'weekly' ? weekdays : null,
        recurrenceMonthDay: type === 'monthly' && monthDay !== '' ? parseInt(monthDay, 10) : null,
        recurrenceStartDate: null,
        recurrenceEndDate: null
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
    const divisionId = document.getElementById('scheduleItemDivisionId').value;
    const structureVal = document.getElementById('scheduleItemStructureTemplateId').value || '';
    const appliesAll = structureVal === '__all__';
    const structureTemplateId = appliesAll ? null : (structureVal ? parseInt(structureVal, 10) : null);
    const basisId = document.getElementById('scheduleItemBasisId').value;
    const workDetailTypeId = document.getElementById('scheduleItemWorkDetailTypeId').value;
    if (!divisionId || divisionId === '__add__') {
        alert('구분을 선택하세요.');
        return;
    }
    if (!structureVal) {
        alert('대상장소를 선택하세요.');
        return;
    }
    if (!basisId || basisId === '__add__') {
        alert('기준을 선택하세요.');
        return;
    }
    if (!workDetailTypeId || workDetailTypeId === '__add__') {
        alert('작업유형 세부를 선택하세요.');
        return;
    }
    const recurrencePayload = getScheduleItemRecurrencePayload();
    const dayMinVal = document.getElementById('scheduleItemDayMin').value === '' ? null : parseInt(document.getElementById('scheduleItemDayMin').value, 10);
    const dayMaxVal = document.getElementById('scheduleItemDayMax').value === '' ? null : parseInt(document.getElementById('scheduleItemDayMax').value, 10);
    if (dayMinVal != null && dayMaxVal != null && dayMinVal > dayMaxVal) {
        alert('시작 일수는 끝 일수보다 크지 않아야 합니다.');
        return;
    }
    const structureTemplateData = structureTemplateId ? { id: structureTemplateId, appliesToAllStructures: appliesAll } : null;
    const divisionData = divisionId ? { id: parseInt(divisionId, 10) } : null;
    const criteriaData = basisId ? { id: parseInt(basisId, 10), dayMin: dayMinVal, dayMax: dayMaxVal } : null;
    const jobtypeData = workDetailTypeId ? { id: parseInt(workDetailTypeId, 10) } : null;
    const detailsData = { ...recurrencePayload };
    
    const payload = {
        structure_templates: structureTemplateData ? JSON.stringify(structureTemplateData) : null,
        schedule_sortations: divisionData ? JSON.stringify(divisionData) : null,
        schedule_criterias: criteriaData ? JSON.stringify(criteriaData) : null,
        schedule_jobtypes: jobtypeData ? JSON.stringify(jobtypeData) : null,
        details: Object.keys(detailsData).length > 0 ? JSON.stringify(detailsData) : null
    };
    try {
        if (id) {
            const res = await fetch(`/api/schedule-work-plans/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '수정 실패');
            }
            alert('일정이 수정되었습니다.');
        } else {
            const res = await fetch('/api/schedule-work-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '추가 실패');
            }
            alert('일정이 추가되었습니다.');
            scheduleInsertAtIndex = null;
        }
        closeScheduleItemModal();
        await loadScheduleItems();
    } catch (err) {
        alert(err.message);
    }
});

function resetScheduleItemFilters() {
    const selDiv = document.getElementById('scheduleFilterDivisionId');
    const selStructure = document.getElementById('scheduleFilterStructure');
    const selBasis = document.getElementById('scheduleFilterBasisId');
    const selWorkDetail = document.getElementById('scheduleFilterWorkDetailTypeId');
    if (selDiv) selDiv.value = '';
    if (selStructure) selStructure.value = '';
    if (selBasis) selBasis.value = '';
    if (selWorkDetail) selWorkDetail.value = '';
}

function openScheduleBasisAddModalFromItem() {
    document.getElementById('scheduleBasisAddName').value = '';
    const descEl = document.getElementById('scheduleBasisAddDescription');
    if (descEl) descEl.value = '';
    document.getElementById('scheduleBasisAddModal').style.display = 'flex';
    document.getElementById('scheduleBasisAddModal').classList.add('show');
}

function closeScheduleBasisAddModal() {
    document.getElementById('scheduleBasisAddModal').style.display = 'none';
    document.getElementById('scheduleBasisAddModal').classList.remove('show');
}

async function saveScheduleBasisAddModal() {
    const name = document.getElementById('scheduleBasisAddName').value.trim();
    if (!name) {
        alert('기준 이름을 입력하세요.');
        return;
    }
    const divisionId = document.getElementById('scheduleItemDivisionId')?.value || '';
    const scheduleSortationsId = divisionId && divisionId !== '__add__' ? parseInt(divisionId, 10) : null;
    try {
        const criteriasData = JSON.stringify([{ name }]);
        const res = await fetch('/api/schedule-criterias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                schedule_sortations_id: scheduleSortationsId,
                criterias: criteriasData
            })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || '저장 실패');
        }
        const created = await res.json();
        await loadScheduleBases();
        const divisionId = document.getElementById('scheduleItemDivisionId')?.value || '';
        if (divisionId) {
            fillScheduleItemBasisOptions(divisionId);
            const sel = document.getElementById('scheduleItemBasisId');
            if (sel) sel.value = String(created.id);
        }
        closeScheduleBasisAddModal();
    } catch (err) {
        alert(err.message);
    }
}

function openScheduleJobtypeAddModalFromItem() {
    document.getElementById('scheduleJobtypeAddName').value = '';
    document.getElementById('scheduleJobtypeAddModal').style.display = 'flex';
    document.getElementById('scheduleJobtypeAddModal').classList.add('show');
}

function closeScheduleJobtypeAddModal() {
    document.getElementById('scheduleJobtypeAddModal').style.display = 'none';
    document.getElementById('scheduleJobtypeAddModal').classList.remove('show');
}

async function saveScheduleJobtypeAdd() {
    const name = document.getElementById('scheduleJobtypeAddName').value.trim();
    if (!name) {
        alert('작업유형 이름을 입력하세요.');
        return;
    }
    try {
        const jobtypesData = JSON.stringify([{ name }]);
        const res = await fetch('/api/schedule-jobtypes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, jobtypes: jobtypesData })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || '저장 실패');
        }
        const created = await res.json();
        await loadScheduleWorkTypes();
        await loadScheduleWorkDetailTypes();
        const divisionId = document.getElementById('scheduleItemDivisionId')?.value || '';
        if (divisionId) {
            fillScheduleItemWorkTypeOptions(divisionId);
            const sel = document.getElementById('scheduleItemWorkTypeId');
            if (sel) sel.value = String(created.id);
            fillScheduleItemWorkDetailOptions(sel.value);
        }
        closeScheduleJobtypeAddModal();
    } catch (err) {
        alert(err.message);
    }
}

function openScheduleWorkDetailAddModalFromItem() {
    const workTypeId = document.getElementById('scheduleItemWorkTypeId').value;
    const workType = scheduleWorkTypes.find(w => w.id === parseInt(workTypeId, 10));
    if (!workType) {
        alert('먼저 작업유형 대분류를 선택하세요.');
        return;
    }
    document.getElementById('scheduleWorkDetailAddWorkTypeId').value = workTypeId;
    document.getElementById('scheduleWorkDetailAddWorkTypeName').value = workType.name;
    document.getElementById('scheduleWorkDetailAddName').value = '';
    document.getElementById('scheduleWorkDetailAddModal').style.display = 'flex';
    document.getElementById('scheduleWorkDetailAddModal').classList.add('show');
}

function closeScheduleWorkDetailAddModal() {
    document.getElementById('scheduleWorkDetailAddModal').style.display = 'none';
    document.getElementById('scheduleWorkDetailAddModal').classList.remove('show');
}

async function saveScheduleWorkDetailAddModal() {
    const workTypeId = document.getElementById('scheduleWorkDetailAddWorkTypeId').value;
    const name = document.getElementById('scheduleWorkDetailAddName').value.trim();
    if (!name) {
        alert('세부 이름을 입력하세요.');
        return;
    }
    try {
        const res = await fetch('/api/schedule-work-detail-types', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workTypeId: parseInt(workTypeId, 10), name, sortOrder: 0 })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || '저장 실패');
        }
        const created = await res.json();
        scheduleWorkDetailTypes.push(created);
        await fillScheduleItemWorkDetailOptions(workTypeId);
        const sel = document.getElementById('scheduleItemWorkDetailTypeId');
        if (sel) sel.value = created.id;
        await loadScheduleWorkDetailTypes();
        closeScheduleWorkDetailAddModal();
    } catch (err) {
        alert(err.message);
    }
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

// ========== 일정 마스터 관리 페이지 (단계별 등록·수정·삭제) ==========
let scheduleMastersDivisionStructures = [];
let scheduleMastersStructures = []; // production only

function refillScheduleMastersDetailFilters() {
    const selWt = document.getElementById('scheduleMastersDetailWorkTypeFilter');
    const selStr = document.getElementById('scheduleMastersDetailStructureFilter');
    const selDiv = document.getElementById('scheduleMastersDetailDivisionFilter');
    if (selWt) selWt.dataset.prev = selWt.value || '';
    if (selStr) selStr.dataset.prev = selStr.value || '';
    if (selDiv) selDiv.dataset.prev = selDiv.value || '';
    if (selWt) {
        selWt.innerHTML = '<option value="">전체</option>' + scheduleWorkTypes.map(w => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
        if (selWt.dataset.prev) selWt.value = selWt.dataset.prev;
    }
    if (selStr) {
        selStr.innerHTML = '<option value="">전체</option>' + scheduleMastersStructures.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
        if (selStr.dataset.prev) selStr.value = selStr.dataset.prev;
    }
    if (selDiv) {
        selDiv.innerHTML = '<option value="">전체</option>' + scheduleDivisions.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
        if (selDiv.dataset.prev) selDiv.value = selDiv.dataset.prev;
    }
}

function toggleScheduleMasterUpper() {
    const body = document.getElementById('scheduleMasterUpperBody');
    const chevron = document.getElementById('scheduleMasterUpperChevron');
    if (!body || !chevron) return;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    chevron.textContent = isOpen ? '▶' : '▼';
}

async function loadScheduleMastersPage() {
    await Promise.all([
        loadScheduleDivisions(),
        loadScheduleBases(),
        loadScheduleWorkTypes(),
        loadScheduleWorkDetailTypes()
    ]);
    const res = await fetch('/api/structureTemplates');
    const allStructures = res.ok ? await res.json() : [];
    scheduleMastersStructures = allStructures.filter(t => t.category === 'production');
    const dsRes = await fetch('/api/schedule-division-structures');
    scheduleMastersDivisionStructures = dsRes.ok ? await dsRes.json() : [];
    refillScheduleMastersDetailFilters();
    const selWt = document.getElementById('scheduleMastersDetailWorkTypeFilter');
    const selStr = document.getElementById('scheduleMastersDetailStructureFilter');
    const selDiv = document.getElementById('scheduleMastersDetailDivisionFilter');
    const onFilterChange = () => {
        if (selWt) selWt.dataset.prev = selWt.value;
        if (selStr) selStr.dataset.prev = selStr.value;
        if (selDiv) selDiv.dataset.prev = selDiv.value;
        renderScheduleMastersWorkDetails();
    };
    if (selWt) selWt.onchange = onFilterChange;
    if (selStr) selStr.onchange = onFilterChange;
    if (selDiv) selDiv.onchange = onFilterChange;
    renderScheduleMastersDivisionStructures();
    renderScheduleMastersBasis();
    renderScheduleMastersWorkTypes();
    renderScheduleMastersWorkDetails();
}

function renderScheduleMastersDivisionStructures() {
    const tbody = document.getElementById('scheduleMastersDivisionStructureBody');
    if (!tbody) return;
    const list = scheduleMastersDivisionStructures.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-muted">매핑 없음</td></tr>';
        return;
    }
    tbody.innerHTML = list.map(m => {
        const place = m.structureTemplate ? m.structureTemplate.name : '-';
        const div = m.division ? m.division.name : '-';
        return `<tr>
            <td>${escapeHtml(place)}</td>
            <td>${escapeHtml(div)}</td>
            <td><button type="button" class="btn btn-outline-secondary btn-sm" onclick="openDivisionStructureEditModal(${m.id})">수정</button> <button type="button" class="btn btn-outline-danger btn-sm" onclick="deleteMasterDivisionStructure(${m.id})">삭제</button></td>
        </tr>`;
    }).join('');
}

function renderScheduleMastersBasis() {
    const tbody = document.getElementById('scheduleMastersBasisBody');
    if (!tbody) return;
    const list = scheduleBases.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted">기준 없음</td></tr>';
        return;
    }
    tbody.innerHTML = list.map(b => {
        const divName = b.divisionId != null ? (scheduleDivisions.find(d => d.id === b.divisionId)?.name || '-') : '전 구분';
        const desc = (b.description || '').trim();
        const descShort = desc.length > 30 ? desc.slice(0, 30) + '…' : desc || '-';
        return `<tr>
            <td>${escapeHtml(b.name)}</td>
            <td>${escapeHtml(divName)}</td>
            <td title="${escapeHtml(desc)}">${escapeHtml(descShort)}</td>
            <td><button type="button" class="btn btn-outline-secondary btn-sm" onclick="openMasterBasisEditModal(${b.id})">수정</button> <button type="button" class="btn btn-outline-danger btn-sm" onclick="deleteMasterBasis(${b.id})">삭제</button></td>
        </tr>`;
    }).join('');
}

function renderScheduleMastersWorkTypes() {
    const tbody = document.getElementById('scheduleMastersWorkTypeBody');
    if (!tbody) return;
    const list = scheduleWorkTypes.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-muted">대분류 없음</td></tr>';
        return;
    }
    const scopeLabel = (s) => ({ pig: '개체', facility: '시설', both: '둘 다' }[s] || s || '-');
    tbody.innerHTML = list.map(w => `
        <tr>
            <td>${escapeHtml(w.name)}</td>
            <td>${scopeLabel(w.appliesToScope)}</td>
            <td><button type="button" class="btn btn-outline-secondary btn-sm" onclick="openMasterWorkTypeEditModal(${w.id})">수정</button> <button type="button" class="btn btn-outline-danger btn-sm" onclick="deleteMasterWorkType(${w.id})">삭제</button></td>
        </tr>`).join('');
}

function renderScheduleMastersWorkDetails() {
    const tbody = document.getElementById('scheduleMastersWorkDetailBody');
    if (!tbody) return;
    const workTypeId = document.getElementById('scheduleMastersDetailWorkTypeFilter')?.value || '';
    const structureId = document.getElementById('scheduleMastersDetailStructureFilter')?.value || '';
    const divisionId = document.getElementById('scheduleMastersDetailDivisionFilter')?.value || '';
    let list = scheduleWorkDetailTypes.slice();
    if (workTypeId) list = list.filter(d => String(d.workTypeId) === String(workTypeId));
    if (structureId) list = list.filter(d => { const arr = d.structureTemplates || []; if (arr.length === 0) return true; return arr.some(t => String(t.id) === String(structureId)); });
    if (divisionId) list = list.filter(d => { const arr = d.divisions || []; if (arr.length === 0) return true; return arr.some(dv => String(dv.id) === String(divisionId)); });
    list.sort((a, b) => {
        const placeA = (a.structureTemplates && a.structureTemplates.length) ? a.structureTemplates.map(t => t.name).sort().join(',') : '';
        const placeB = (b.structureTemplates && b.structureTemplates.length) ? b.structureTemplates.map(t => t.name).sort().join(',') : '';
        if (placeA !== placeB) return placeA.localeCompare(placeB);
        const divA = (a.divisions && a.divisions.length) ? a.divisions.map(dv => dv.name).sort().join(',') : '';
        const divB = (b.divisions && b.divisions.length) ? b.divisions.map(dv => dv.name).sort().join(',') : '';
        if (divA !== divB) return divA.localeCompare(divB);
        const wtA = scheduleWorkTypes.find(w => w.id === a.workTypeId)?.name || '';
        const wtB = scheduleWorkTypes.find(w => w.id === b.workTypeId)?.name || '';
        if (wtA !== wtB) return wtA.localeCompare(wtB);
        return (a.name || '').localeCompare(b.name || '');
    });
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-muted">세부가 없습니다. 대분류를 선택한 뒤 + 세부 추가로 등록하세요.</td></tr>';
        return;
    }
    tbody.innerHTML = list.map(d => {
        const wt = scheduleWorkTypes.find(w => w.id === d.workTypeId);
        const wtName = wt ? wt.name : '-';
        const placeName = (d.structureTemplates && d.structureTemplates.length) ? d.structureTemplates.map(t => t.name).join(', ') : '전체';
        const divisionName = (d.divisions && d.divisions.length) ? d.divisions.map(dv => dv.name).join(', ') : '전체';
        return `<tr>
            <td>${escapeHtml(placeName)}</td>
            <td>${escapeHtml(divisionName)}</td>
            <td>${escapeHtml(wtName)}</td>
            <td>${escapeHtml(d.name)}</td>
            <td>${d.sortOrder != null ? d.sortOrder : 0}</td>
            <td style="white-space: nowrap;"><button type="button" class="btn btn-outline-secondary btn-sm" onclick="openMasterWorkDetailEditModal(${d.id})">수정</button> <button type="button" class="btn btn-outline-danger btn-sm" onclick="deleteMasterWorkDetail(${d.id})">삭제</button></td>
        </tr>`;
    }).join('');
}

function openDivisionStructureAddModal() {
    window._scheduleItemDivisionAddContext = null;
    document.getElementById('scheduleMasterDivisionStructureModalTitle').textContent = '매핑 추가';
    document.getElementById('scheduleMasterDivisionStructureId').value = '';
    document.getElementById('scheduleMasterDivisionStructureDeleteBtn').style.display = 'none';
    const selPlace = document.getElementById('scheduleMasterDivisionStructurePlace');
    const selDiv = document.getElementById('scheduleMasterDivisionStructureDivision');
    selPlace.innerHTML = '<option value="">선택</option>' + scheduleMastersStructures.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
    selPlace.disabled = false;
    selDiv.innerHTML = '<option value="">선택</option>' + scheduleDivisions.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
    document.getElementById('scheduleMasterDivisionStructureSortOrder').value = '0';
    document.getElementById('scheduleMasterDivisionStructureModal').style.display = 'flex';
    document.getElementById('scheduleMasterDivisionStructureModal').classList.add('show');
}

/** 일정 추가 모달에서 구분 "+ 추가" 클릭: 구분 추가 모달 열기 */
function openScheduleDivisionAddModalFromItem() {
    document.getElementById('scheduleSortationAddName').value = '';
    document.getElementById('scheduleSortationAddModal').style.display = 'flex';
    document.getElementById('scheduleSortationAddModal').classList.add('show');
}

function closeScheduleSortationAddModal() {
    document.getElementById('scheduleSortationAddModal').style.display = 'none';
    document.getElementById('scheduleSortationAddModal').classList.remove('show');
}

async function saveScheduleSortationAdd() {
    const name = document.getElementById('scheduleSortationAddName').value.trim();
    if (!name) {
        alert('구분 이름을 입력하세요.');
        return;
    }
    const structureTemplateIdEl = document.getElementById('scheduleItemStructureTemplateId');
    const structureTemplateId = structureTemplateIdEl && structureTemplateIdEl.value && structureTemplateIdEl.value !== '__all__' ? structureTemplateIdEl.value : null;
    try {
        const sortationsData = JSON.stringify([{ name }]);
        const res = await fetch('/api/schedule-sortations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                structure_template_id: structureTemplateId ? parseInt(structureTemplateId, 10) : null,
                sortations: sortationsData
            })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || '저장 실패');
        }
        const created = await res.json();
        await loadScheduleDivisions();
        const sel = document.getElementById('scheduleItemDivisionId');
        if (sel) {
            fillScheduleItemDivisionOptions(document.getElementById('scheduleItemStructureTemplateId')?.value || '');
            sel.value = String(created.id);
            fillScheduleItemWorkTypeOptions(sel.value);
            fillScheduleItemBasisOptions(sel.value);
        }
        closeScheduleSortationAddModal();
    } catch (err) {
        alert(err.message);
    }
}

function openDivisionStructureEditModal(id) {
    const m = scheduleMastersDivisionStructures.find(x => x.id === id);
    if (!m) return;
    document.getElementById('scheduleMasterDivisionStructureModalTitle').textContent = '매핑 수정';
    document.getElementById('scheduleMasterDivisionStructureId').value = id;
    document.getElementById('scheduleMasterDivisionStructureDeleteBtn').style.display = 'inline-block';
    const selPlace = document.getElementById('scheduleMasterDivisionStructurePlace');
    const selDiv = document.getElementById('scheduleMasterDivisionStructureDivision');
    selPlace.innerHTML = '<option value="">선택</option>' + scheduleMastersStructures.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
    selDiv.innerHTML = '<option value="">선택</option>' + scheduleDivisions.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
    selPlace.value = m.structureTemplateId != null ? m.structureTemplateId : '';
    selDiv.value = m.divisionId != null ? m.divisionId : '';
    document.getElementById('scheduleMasterDivisionStructureSortOrder').value = m.sortOrder != null ? m.sortOrder : 0;
    document.getElementById('scheduleMasterDivisionStructureModal').style.display = 'flex';
    document.getElementById('scheduleMasterDivisionStructureModal').classList.add('show');
}

function closeDivisionStructureModal() {
    window._scheduleItemDivisionAddContext = null;
    document.getElementById('scheduleMasterDivisionStructureModal').style.display = 'none';
    document.getElementById('scheduleMasterDivisionStructureModal').classList.remove('show');
}

async function saveMasterDivisionStructure() {
    const id = document.getElementById('scheduleMasterDivisionStructureId').value;
    const structureTemplateId = document.getElementById('scheduleMasterDivisionStructurePlace').value;
    const divisionId = document.getElementById('scheduleMasterDivisionStructureDivision').value;
    const sortOrder = parseInt(document.getElementById('scheduleMasterDivisionStructureSortOrder').value, 10) || 0;
    if (!structureTemplateId || !divisionId) {
        alert('대상 장소와 구분을 선택하세요.');
        return;
    }
    const fromItemModal = window._scheduleItemDivisionAddContext != null;
    try {
        if (id) {
            const res = await fetch(`/api/schedule-division-structures/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ structureTemplateId: parseInt(structureTemplateId, 10), divisionId: parseInt(divisionId, 10), sortOrder })
            });
            if (!res.ok) throw new Error((await res.json()).error || '수정 실패');
        } else {
            const res = await fetch('/api/schedule-division-structures', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ structureTemplateId: parseInt(structureTemplateId, 10), divisionId: parseInt(divisionId, 10), sortOrder })
            });
            if (!res.ok) throw new Error((await res.json()).error || '추가 실패');
        }
        alert(id ? '수정되었습니다.' : '추가되었습니다.');
        closeDivisionStructureModal();
        const dsRes = await fetch('/api/schedule-division-structures');
        scheduleMastersDivisionStructures = dsRes.ok ? await dsRes.json() : [];
        renderScheduleMastersDivisionStructures();
        if (fromItemModal && window._scheduleItemDivisionAddContext) {
            const ctx = window._scheduleItemDivisionAddContext;
            window._scheduleItemDivisionAddContext = null;
            await fillScheduleItemDivisionOptions(ctx.structureTemplateId);
            const selDiv = document.getElementById('scheduleItemDivisionId');
            if (selDiv) selDiv.value = divisionId;
        }
    } catch (e) {
        alert(e.message);
    }
}

async function deleteMasterDivisionStructure(id) {
    if (!confirm('이 매핑을 삭제하시겠습니까?')) return;
    try {
        const res = await fetch(`/api/schedule-division-structures/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error || '삭제 실패');
        scheduleMastersDivisionStructures = scheduleMastersDivisionStructures.filter(x => x.id !== id);
        renderScheduleMastersDivisionStructures();
        alert('삭제되었습니다.');
    } catch (e) {
        alert(e.message);
    }
}

function deleteMasterDivisionStructureFromModal() {
    const id = document.getElementById('scheduleMasterDivisionStructureId').value;
    if (id) deleteMasterDivisionStructure(parseInt(id, 10));
    closeDivisionStructureModal();
}

function openMasterBasisAddModal() {
    document.getElementById('scheduleMasterBasisModalTitle').textContent = '기준 추가';
    document.getElementById('scheduleMasterBasisId').value = '';
    document.getElementById('scheduleMasterBasisName').value = '';
    document.getElementById('scheduleMasterBasisDescription').value = '';
    document.getElementById('scheduleMasterBasisDivisionId').innerHTML = '<option value="">전 구분 공통</option>' + scheduleDivisions.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
    document.getElementById('scheduleMasterBasisSortOrder').value = scheduleBases.length;
    document.getElementById('scheduleMasterBasisDeleteBtn').style.display = 'none';
    document.getElementById('scheduleMasterBasisModal').style.display = 'flex';
    document.getElementById('scheduleMasterBasisModal').classList.add('show');
}

function openMasterBasisEditModal(id) {
    const b = scheduleBases.find(x => x.id === id);
    if (!b) return;
    document.getElementById('scheduleMasterBasisModalTitle').textContent = '기준 수정';
    document.getElementById('scheduleMasterBasisId').value = id;
    document.getElementById('scheduleMasterBasisName').value = b.name || '';
    document.getElementById('scheduleMasterBasisDescription').value = b.description || '';
    document.getElementById('scheduleMasterBasisDivisionId').innerHTML = '<option value="">전 구분 공통</option>' + scheduleDivisions.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
    document.getElementById('scheduleMasterBasisDivisionId').value = b.divisionId != null ? b.divisionId : '';
    document.getElementById('scheduleMasterBasisSortOrder').value = b.sortOrder != null ? b.sortOrder : 0;
    document.getElementById('scheduleMasterBasisDeleteBtn').style.display = 'inline-block';
    document.getElementById('scheduleMasterBasisModal').style.display = 'flex';
    document.getElementById('scheduleMasterBasisModal').classList.add('show');
}

function closeMasterBasisModal() {
    document.getElementById('scheduleMasterBasisModal').style.display = 'none';
    document.getElementById('scheduleMasterBasisModal').classList.remove('show');
}

async function saveMasterBasis() {
    const id = document.getElementById('scheduleMasterBasisId').value;
    const name = document.getElementById('scheduleMasterBasisName').value.trim();
    const description = document.getElementById('scheduleMasterBasisDescription').value.trim();
    const divisionId = document.getElementById('scheduleMasterBasisDivisionId').value;
    const sortOrder = parseInt(document.getElementById('scheduleMasterBasisSortOrder').value, 10) || 0;
    if (!name) {
        alert('이름을 입력하세요.');
        return;
    }
    try {
        if (id) {
            const res = await fetch(`/api/schedule-bases/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description: description || null, divisionId: divisionId ? parseInt(divisionId, 10) : null, sortOrder })
            });
            if (!res.ok) throw new Error((await res.json()).error || '수정 실패');
        } else {
            const res = await fetch('/api/schedule-bases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description: description || null, divisionId: divisionId ? parseInt(divisionId, 10) : null, sortOrder })
            });
            if (!res.ok) throw new Error((await res.json()).error || '추가 실패');
        }
        alert(id ? '수정되었습니다.' : '추가되었습니다.');
        closeMasterBasisModal();
        await loadScheduleBases();
        refillScheduleMastersDetailFilters();
        renderScheduleMastersBasis();
        renderScheduleMastersWorkDetails();
    } catch (e) {
        alert(e.message);
    }
}

async function deleteMasterBasis(id) {
    if (!confirm('이 기준을 삭제하시겠습니까?')) return;
    try {
        const res = await fetch(`/api/schedule-bases/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error || '삭제 실패');
        await loadScheduleBases();
        refillScheduleMastersDetailFilters();
        renderScheduleMastersBasis();
        renderScheduleMastersWorkDetails();
        alert('삭제되었습니다.');
    } catch (e) {
        alert(e.message);
    }
}

function deleteMasterBasisFromModal() {
    const id = document.getElementById('scheduleMasterBasisId').value;
    if (id) deleteMasterBasis(parseInt(id, 10));
    closeMasterBasisModal();
}

function openMasterWorkTypeAddModal() {
    document.getElementById('scheduleMasterWorkTypeModalTitle').textContent = '대분류 추가';
    document.getElementById('scheduleMasterWorkTypeId').value = '';
    document.getElementById('scheduleMasterWorkTypeName').value = '';
    document.getElementById('scheduleMasterWorkTypeScope').value = 'pig';
    document.getElementById('scheduleMasterWorkTypeSortOrder').value = scheduleWorkTypes.length;
    document.getElementById('scheduleMasterWorkTypeDeleteBtn').style.display = 'none';
    document.getElementById('scheduleMasterWorkTypeModal').style.display = 'flex';
    document.getElementById('scheduleMasterWorkTypeModal').classList.add('show');
}

function openMasterWorkTypeEditModal(id) {
    const w = scheduleWorkTypes.find(x => x.id === id);
    if (!w) return;
    document.getElementById('scheduleMasterWorkTypeModalTitle').textContent = '대분류 수정';
    document.getElementById('scheduleMasterWorkTypeId').value = id;
    document.getElementById('scheduleMasterWorkTypeName').value = w.name || '';
    document.getElementById('scheduleMasterWorkTypeScope').value = w.appliesToScope || 'pig';
    document.getElementById('scheduleMasterWorkTypeSortOrder').value = w.sortOrder != null ? w.sortOrder : 0;
    document.getElementById('scheduleMasterWorkTypeDeleteBtn').style.display = 'inline-block';
    document.getElementById('scheduleMasterWorkTypeModal').style.display = 'flex';
    document.getElementById('scheduleMasterWorkTypeModal').classList.add('show');
}

function closeMasterWorkTypeModal() {
    document.getElementById('scheduleMasterWorkTypeModal').style.display = 'none';
    document.getElementById('scheduleMasterWorkTypeModal').classList.remove('show');
}

async function saveMasterWorkType() {
    const id = document.getElementById('scheduleMasterWorkTypeId').value;
    const name = document.getElementById('scheduleMasterWorkTypeName').value.trim();
    const appliesToScope = document.getElementById('scheduleMasterWorkTypeScope').value || 'pig';
    const sortOrder = parseInt(document.getElementById('scheduleMasterWorkTypeSortOrder').value, 10) || 0;
    if (!name) {
        alert('이름을 입력하세요.');
        return;
    }
    try {
        if (id) {
            const res = await fetch(`/api/schedule-work-types/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, appliesToScope, sortOrder })
            });
            if (!res.ok) throw new Error((await res.json()).error || '수정 실패');
        } else {
            const res = await fetch('/api/schedule-work-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, appliesToScope, sortOrder })
            });
            if (!res.ok) throw new Error((await res.json()).error || '추가 실패');
        }
        alert(id ? '수정되었습니다.' : '추가되었습니다.');
        closeMasterWorkTypeModal();
        await loadScheduleWorkTypes();
        refillScheduleMastersDetailFilters();
        renderScheduleMastersWorkTypes();
        renderScheduleMastersWorkDetails();
    } catch (e) {
        alert(e.message);
    }
}

async function deleteMasterWorkType(id) {
    if (!confirm('이 대분류를 삭제하시겠습니까? 소속 세부도 삭제될 수 있습니다.')) return;
    try {
        const res = await fetch(`/api/schedule-work-types/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error || '삭제 실패');
        await loadScheduleWorkTypes();
        await loadScheduleWorkDetailTypes();
        refillScheduleMastersDetailFilters();
        renderScheduleMastersWorkTypes();
        renderScheduleMastersWorkDetails();
        alert('삭제되었습니다.');
    } catch (e) {
        alert(e.message);
    }
}

function deleteMasterWorkTypeFromModal() {
    const id = document.getElementById('scheduleMasterWorkTypeId').value;
    if (id) deleteMasterWorkType(parseInt(id, 10));
    closeMasterWorkTypeModal();
}

function fillMasterWorkDetailMultiSelects(selectedStructureIds, selectedDivisionIds) {
    const containerPlace = document.getElementById('scheduleMasterWorkDetailStructureIds');
    const containerDiv = document.getElementById('scheduleMasterWorkDetailDivisionIds');
    if (!containerPlace || !containerDiv) return;
    const setPlace = new Set((selectedStructureIds || []).map(String));
    const setDiv = new Set((selectedDivisionIds || []).map(String));
    containerPlace.innerHTML = scheduleMastersStructures.map(t => `<label class="multi-select-item"><input type="checkbox" value="${t.id}" ${setPlace.has(String(t.id)) ? 'checked' : ''}> ${escapeHtml(t.name)}</label>`).join('');
    containerDiv.innerHTML = scheduleDivisions.map(d => `<label class="multi-select-item"><input type="checkbox" value="${d.id}" ${setDiv.has(String(d.id)) ? 'checked' : ''}> ${escapeHtml(d.name)}</label>`).join('');
}

function openMasterWorkDetailAddModal() {
    const workTypeId = document.getElementById('scheduleMastersDetailWorkTypeFilter')?.value;
    document.getElementById('scheduleMasterWorkDetailModalTitle').textContent = '세부 추가';
    document.getElementById('scheduleMasterWorkDetailId').value = '';
    const sel = document.getElementById('scheduleMasterWorkDetailWorkTypeId');
    sel.innerHTML = '<option value="">선택</option>' + scheduleWorkTypes.map(w => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
    sel.value = workTypeId || '';
    fillMasterWorkDetailMultiSelects([], []);
    document.getElementById('scheduleMasterWorkDetailName').value = '';
    document.getElementById('scheduleMasterWorkDetailSortOrder').value = '0';
    document.getElementById('scheduleMasterWorkDetailDeleteBtn').style.display = 'none';
    document.getElementById('scheduleMasterWorkDetailModal').style.display = 'flex';
    document.getElementById('scheduleMasterWorkDetailModal').classList.add('show');
}

function openMasterWorkDetailEditModal(id) {
    const d = scheduleWorkDetailTypes.find(x => x.id === id);
    if (!d) return;
    document.getElementById('scheduleMasterWorkDetailModalTitle').textContent = '세부 수정';
    document.getElementById('scheduleMasterWorkDetailId').value = id;
    const sel = document.getElementById('scheduleMasterWorkDetailWorkTypeId');
    sel.innerHTML = '<option value="">선택</option>' + scheduleWorkTypes.map(w => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
    sel.value = d.workTypeId != null ? d.workTypeId : '';
    const structureIds = (d.structureTemplates || []).map(t => t.id);
    const divisionIds = (d.divisions || []).map(dv => dv.id);
    fillMasterWorkDetailMultiSelects(structureIds, divisionIds);
    document.getElementById('scheduleMasterWorkDetailName').value = d.name || '';
    document.getElementById('scheduleMasterWorkDetailSortOrder').value = d.sortOrder != null ? d.sortOrder : 0;
    document.getElementById('scheduleMasterWorkDetailDeleteBtn').style.display = 'inline-block';
    document.getElementById('scheduleMasterWorkDetailModal').style.display = 'flex';
    document.getElementById('scheduleMasterWorkDetailModal').classList.add('show');
}

function closeMasterWorkDetailModal() {
    document.getElementById('scheduleMasterWorkDetailModal').style.display = 'none';
    document.getElementById('scheduleMasterWorkDetailModal').classList.remove('show');
}

function getMasterWorkDetailSelectedIds(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    return Array.from(container.querySelectorAll('input:checked')).map(el => parseInt(el.value, 10)).filter(n => !isNaN(n));
}

async function saveMasterWorkDetail() {
    const id = document.getElementById('scheduleMasterWorkDetailId').value;
    const workTypeId = document.getElementById('scheduleMasterWorkDetailWorkTypeId').value;
    const structureTemplateIds = getMasterWorkDetailSelectedIds('scheduleMasterWorkDetailStructureIds');
    const divisionIds = getMasterWorkDetailSelectedIds('scheduleMasterWorkDetailDivisionIds');
    const name = document.getElementById('scheduleMasterWorkDetailName').value.trim();
    const sortOrder = parseInt(document.getElementById('scheduleMasterWorkDetailSortOrder').value, 10) || 0;
    if (!workTypeId || !name) {
        alert('대분류와 세부 이름을 입력하세요.');
        return;
    }
    const payload = { workTypeId: parseInt(workTypeId, 10), name, sortOrder, structureTemplateIds, divisionIds };
    try {
        if (id) {
            const res = await fetch(`/api/schedule-work-detail-types/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error((await res.json()).error || '수정 실패');
        } else {
            const res = await fetch('/api/schedule-work-detail-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error((await res.json()).error || '추가 실패');
        }
        alert(id ? '수정되었습니다.' : '추가되었습니다.');
        closeMasterWorkDetailModal();
        await loadScheduleWorkDetailTypes();
        renderScheduleMastersWorkDetails();
    } catch (e) {
        alert(e.message);
    }
}

async function deleteMasterWorkDetail(id) {
    if (!confirm('이 세부를 삭제하시겠습니까?')) return;
    try {
        const res = await fetch(`/api/schedule-work-detail-types/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error || '삭제 실패');
        await loadScheduleWorkDetailTypes();
        renderScheduleMastersWorkDetails();
        alert('삭제되었습니다.');
    } catch (e) {
        alert(e.message);
    }
}

function deleteMasterWorkDetailFromModal() {
    const id = document.getElementById('scheduleMasterWorkDetailId').value;
    if (id) deleteMasterWorkDetail(parseInt(id, 10));
    closeMasterWorkDetailModal();
}
