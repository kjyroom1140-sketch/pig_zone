/**
 * 농장 시설 설정 페이지 JavaScript
 * 트리 구조 UI로 건물 → 돈사 → 방 → 칸 관리
 */

// IIFE로 감싸서 전역 스코프 오염 방지
(function () {
    'use strict';

    // 내부 변수들 (전역 충돌 방지)
    let facilitiesFarmId = null;
    let treeData = [];
    let expandedNodes = new Set(); // 확장된 노드 추적

    // ========================================
    // 초기화 (전역 함수로 노출)
    // ========================================
    window.initFacilities = async function (farmId) {
        facilitiesFarmId = farmId;
        const container = document.getElementById('facilitiesTreeContainer');
        if (container && !container._facilitiesDelegateBound) {
            container._facilitiesDelegateBound = true;
            container.addEventListener('click', handleTreeActionClick);
        }
        await loadTreeData();
    };

    function handleTreeActionClick(e) {
        const btn = e.target.closest('button[data-action]');
        if (btn) {
            e.preventDefault();
            const action = btn.getAttribute('data-action');
            const id = btn.getAttribute('data-id');
            const buildingId = btn.getAttribute('data-building-id');
            const floorNumber = btn.getAttribute('data-floor-number');
            switch (action) {
                case 'addBuilding': handleAddBuildingClick(); break;
                case 'showAddBuildingModal': showAddBuildingModal(); break;
                case 'addBarnFromBuilding': showAddBarnFromBuilding(id); break;
                case 'editBuilding': showEditBuildingModal(id); break;
                case 'deleteBuilding': deleteBuilding(id); break;
                case 'addBarnForFloor': showAddBarnModalForFloor(buildingId, parseInt(floorNumber, 10)); break;
                case 'addRoomsBulk': showAddRoomsBulkModal(id); break;
                case 'editBarn': showEditBarnModal(id); break;
                case 'deleteBarn': deleteBarn(id); break;
                case 'editRoom': showEditRoomModal(id); break;
                case 'deleteRoom': deleteRoom(id); break;
                case 'editSection': showEditSectionModal(id); break;
                default: break;
            }
            return;
        }
        const toggle = e.target.closest('.tree-toggle[data-node-id]');
        if (toggle) {
            e.preventDefault();
            toggleNode(toggle.getAttribute('data-node-id'));
        }
    }

    // ========================================
    // 트리 데이터 로드
    // ========================================
    async function loadTreeData() {
        try {
            const response = await fetch(`/api/farm-facilities/${facilitiesFarmId}/tree`);
            if (!response.ok) {
                throw new Error('트리 데이터 로드 실패');
            }

            treeData = await response.json();

            // 모든 건물과 돈사를 기본적으로 확장 (방까지 보이도록)
            treeData.forEach(building => {
                expandedNodes.add(`building-${building.id}`);
                if (building.barns) {
                    building.barns.forEach(barn => {
                        expandedNodes.add(`barn-${barn.id}`);
                    });
                }
            });

            renderTree();
        } catch (error) {
            console.error('트리 데이터 로드 오류:', error);
            alert('시설 데이터를 불러오는데 실패했습니다.');
        }
    }

    // ========================================
    // 트리 렌더링
    // ========================================
    function renderTree() {
        const container = document.getElementById('facilitiesTreeContainer');
        if (!container) return;

        if (treeData.length === 0) {
            container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #94a3b8;">
                <p style="font-size: 16px; margin-bottom: 16px;">등록된 건물이 없습니다.</p>
<button class="btn btn-primary" data-action="addBuilding">
                <span style="font-size: 18px;">+</span> 첫 건물 추가하기
                </button>
            </div>
        `;
            return;
        }

        let html = '<div class="tree-root">';

        treeData.forEach(building => {
            html += renderBuildingNode(building);
        });

        html += '</div>';
        html += `
        <div style="margin-top: 20px;">
            <button class="btn btn-primary" data-action="showAddBuildingModal">
                <span style="font-size: 18px;">+</span> 건물 추가
            </button>
        </div>
    `;

        container.innerHTML = html;
    }

    function renderBuildingNode(building) {
        const buildingId = `building-${building.id}`;
        const isExpanded = expandedNodes.has(buildingId);

        const floors = building.floors || [];
        const hasAnyBarns = floors.some(f => (f.barns || []).length > 0);
        const hasFloors = floors.length > 0;
        // 설계: 1동 = 1 row 이므로 삭제/수정 모두 building.id 사용
        let html = `
        <div class="tree-node building-node" data-id="${building.id}" data-type="building">
            <div class="tree-node-header">
                ${hasFloors || hasAnyBarns ? `
                    <span class="tree-toggle" data-node-id="${escapeHtml(buildingId)}" role="button" tabindex="0">
                        ${isExpanded ? '▼' : '▶'}
                    </span>
                ` : '<span class="tree-toggle-placeholder"></span>'}
                <span class="tree-icon">📦</span>
                <span class="tree-label">${escapeHtml(building.name)}</span>
                <span class="tree-stats">(${building.stats.totalBarns}돈사, ${building.stats.totalRooms}방, ${building.stats.totalSections}칸)</span>
                <div class="tree-actions">
                    <button class="btn-icon" data-action="editBuilding" data-id="${escapeHtml(building.id)}" title="수정">✏️</button>
                    ${!hasAnyBarns ? `<button class="btn-icon btn-danger" data-action="deleteBuilding" data-id="${escapeHtml(building.id)}" title="삭제">🗑️</button>` : ''}
                </div>
            </div>
            ${isExpanded && hasFloors ? `
                <div class="tree-children">
                    ${floors.map(floor => renderFloorNode(building, floor)).join('')}
                </div>
            ` : ''}
        </div>
    `;

        return html;
    }

    function renderFloorNode(building, floor) {
        const floorId = `floor-${building.id}-${floor.floorNumber}`;
        const isExpanded = expandedNodes.has(floorId);
        const barnsInFloor = floor.barns || [];
        const hasBarns = barnsInFloor.length > 0;

        const totalBarns = floor.stats?.totalBarns ?? barnsInFloor.length;
        const totalRooms = floor.stats?.totalRooms ?? barnsInFloor.reduce((sum, barn) => sum + (barn.stats?.totalRooms || 0), 0);
        const totalSections = floor.stats?.totalSections ?? barnsInFloor.reduce((sum, barn) => sum + (barn.stats?.totalSections || 0), 0);

        let html = `
        <div class="tree-node floor-node" data-id="${building.id}" data-type="floor" data-floor="${floor.floorNumber}">
            <div class="tree-node-header">
                ${hasBarns ? `
                    <span class="tree-toggle" data-node-id="${escapeHtml(floorId)}" role="button" tabindex="0">
                        ${isExpanded ? '▼' : '▶'}
                    </span>
                ` : '<span class="tree-toggle-placeholder"></span>'}
                <span class="tree-icon">🏢</span>
                <span class="tree-label">${floor.floorNumber}층</span>
                <span class="tree-stats">(${totalBarns}동, ${totalRooms}방, ${totalSections}칸)</span>
                <div class="tree-actions">
                    <button type="button" class="btn-icon" data-action="addBarnForFloor" data-building-id="${escapeHtml(floor.buildingId)}" data-floor-number="${floor.floorNumber}" title="돈사 추가">
                        <span style="font-size: 14px;">+🐷</span>
                    </button>
                </div>
            </div>
            ${hasBarns && isExpanded ? `
                <div class="tree-children">
                    ${barnsInFloor.map(barn => renderBarnNode(barn, building.id)).join('')}
                </div>
            ` : ''}
        </div>
    `;

        return html;
    }

    function renderBarnNode(barn, buildingId) {
        const barnId = `barn-${barn.id}`;
        const isExpanded = expandedNodes.has(barnId);
        const hasRooms = barn.rooms && barn.rooms.length > 0;

        let html = `
        <div class="tree-node barn-node" data-id="${barn.id}" data-type="barn">
            <div class="tree-node-header">
                ${hasRooms ? `
                    <span class="tree-toggle" data-node-id="${escapeHtml(barnId)}" role="button" tabindex="0">
                        ${isExpanded ? '▼' : '▶'}
                    </span>
                ` : '<span class="tree-toggle-placeholder"></span>'}
                <span class="tree-icon">🐷</span>
                <span class="tree-label">${escapeHtml(barn.name)}</span>
                <span class="tree-stats">(${barn.stats.totalRooms}방, ${barn.stats.totalSections}칸)</span>
                <div class="tree-actions">
                    <button class="btn-icon" data-action="addRoomsBulk" data-id="${escapeHtml(barn.id)}" title="방 추가">
                        <span style="font-size: 14px;">+🚪</span>
                    </button>
                    <button class="btn-icon" data-action="editBarn" data-id="${escapeHtml(barn.id)}" title="수정">✏️</button>
                    ${!hasRooms ? `<button class="btn-icon btn-danger" data-action="deleteBarn" data-id="${escapeHtml(barn.id)}" title="삭제">🗑️</button>` : ''}
                </div>
            </div>
            ${hasRooms && isExpanded ? `
                <div class="tree-children">
                    ${barn.rooms.map(room => renderRoomNode(room, barn.id)).join('')}
                </div>
            ` : ''}
        </div>
    `;

        return html;
    }


    function renderRoomNode(room, barnId) {
        const roomId = `room-${room.id}`;
        const isExpanded = expandedNodes.has(roomId);
        const hasSections = room.sections && room.sections.length > 0;

        let html = `
        <div class="tree-node room-node" data-id="${room.id}" data-type="room">
            <div class="tree-node-header">
                ${hasSections ? `
                    <span class="tree-toggle" data-node-id="${escapeHtml(roomId)}" role="button" tabindex="0">
                        ${isExpanded ? '▼' : '▶'}
                    </span>
                ` : '<span class="tree-toggle-placeholder"></span>'}
                <span class="tree-icon">🚪</span>
                <span class="tree-label">${escapeHtml(room.name)}</span>
                <span class="tree-stats">(${room.sectionCount}칸)</span>
                <div class="tree-actions">
                    <button class="btn-icon" data-action="editRoom" data-id="${escapeHtml(room.id)}" title="수정">✏️</button>
                    <button class="btn-icon btn-danger" data-action="deleteRoom" data-id="${escapeHtml(room.id)}" title="삭제">🗑️</button>
                </div>
            </div>
            ${hasSections && isExpanded ? `
                <div class="tree-children">
                    ${room.sections.map(section => renderSectionNode(section, room.id)).join('')}
                </div>
            ` : ''}
        </div>
    `;

        return html;
    }

    function renderSectionNode(section, roomId) {
        // 칸 정보 표시
        const pigInfo = section.currentPigCount ? `${section.currentPigCount}두` : '비어있음';
        const weightInfo = section.averageWeight ? `, ${section.averageWeight}kg` : '';
        const daysInfo = section.daysOld ? `, ${section.daysOld}일령` : '';

        let html = `
        <div class="tree-node section-node" data-id="${section.id}" data-type="section">
            <div class="tree-node-header">
                <span class="tree-toggle-placeholder"></span>
                <span class="tree-icon">📍</span>
                <span class="tree-label">${escapeHtml(section.name)}</span>
                <span class="tree-stats">(${pigInfo}${weightInfo}${daysInfo})</span>
                <div class="tree-actions">
                    <button class="btn-icon" data-action="editSection" data-id="${escapeHtml(section.id)}" title="사육정보 수정">✏️</button>
                </div>
            </div>
        </div>
    `;

        return html;
    }

    // ========================================
    // 트리 토글
    // ========================================
    function toggleNode(nodeId) {
        if (expandedNodes.has(nodeId)) {
            expandedNodes.delete(nodeId);
        } else {
            expandedNodes.add(nodeId);
        }
        renderTree();
    }

    // ========================================
    // 건물 관련 함수
    // ========================================
    async function handleAddBuildingClick() {
        if (!facilitiesFarmId) {
            alert('농장 정보가 없습니다.');
            return;
        }

        try {
            const res = await fetch(`/api/farm-structure/${facilitiesFarmId}/production`);
            if (!res.ok) {
                throw new Error('운영 시설 정보를 불러오지 못했습니다.');
            }
            const data = await res.json();

            if (!data || data.length === 0) {
                openNoStructureWarningModal();
                return;
            }

            showAddBuildingModal();
        } catch (error) {
            console.error('건물 추가 전 운영 시설 확인 오류:', error);
            alert('운영 시설 정보를 확인하는 중 오류가 발생했습니다: ' + error.message);
        }
    }

    function showAddBarnFromBuilding(buildingId) {
        const building = findBuildingById(buildingId);
        const firstFloor = (building?.floors || [])[0];
        if (firstFloor) {
            showAddBarnModal(firstFloor.buildingId, firstFloor.floorNumber);
        } else {
            alert('먼저 층 정보가 있는 건물을 생성해야 합니다.');
        }
    }

    function showAddBarnModalForFloor(buildingId, floorNumber) {
        showAddBarnModal(buildingId, floorNumber);
    }
    function openNoStructureWarningModal() {
        const modal = document.getElementById('noStructureWarningModal');
        if (modal) {
            modal.classList.add('show');
        }
    }
    function closeNoStructureWarningModal() {
        const modal = document.getElementById('noStructureWarningModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    function showAddBuildingModal() {
        const modal = document.getElementById('buildingModal');
        document.getElementById('buildingModalTitle').textContent = '건물 추가';
        document.getElementById('buildingForm').reset();
        document.getElementById('buildingId').value = '';
        const floorsInput = document.getElementById('buildingFloors');
        if (floorsInput) {
            floorsInput.value = '1';
            floorsInput.disabled = false;
        }
        modal.classList.add('show');
    }

    function showEditBuildingModal(buildingId) {
        const building = findBuildingById(buildingId);
        if (!building) return;

        const modal = document.getElementById('buildingModal');
        document.getElementById('buildingModalTitle').textContent = '건물 수정';
        document.getElementById('buildingId').value = building.id;
        document.getElementById('buildingName').value = building.name;
        const floorsInput = document.getElementById('buildingFloors');
        if (floorsInput) {
            floorsInput.value = building.totalFloors != null ? building.totalFloors : (building.floors || []).length || 1;
            floorsInput.disabled = false;
        }
        document.getElementById('buildingDescription').value = building.description || '';
        modal.classList.add('show');
    }

    async function saveBuildingForm(e) {
        e.preventDefault();

        const buildingId = document.getElementById('buildingId').value;
        const name = document.getElementById('buildingName').value;
        const totalFloors = document.getElementById('buildingFloors').value;
        const description = document.getElementById('buildingDescription').value;

        try {
            let response;
            if (buildingId) {
                // 수정
                response = await fetch(`/api/farm-facilities/buildings/${buildingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, description, totalFloors: totalFloors ? Number(totalFloors) : null })
                });
            } else {
                // 추가
                response = await fetch(`/api/farm-facilities/${facilitiesFarmId}/buildings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, description, totalFloors: totalFloors ? Number(totalFloors) : null })
                });
            }

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || '저장 실패');
            }

            closeBuildingModal();
            await loadTreeData();
            alert(buildingId ? '건물이 수정되었습니다.' : '건물이 추가되었습니다.');
        } catch (error) {
            console.error('건물 저장 오류:', error);
            alert('저장 중 오류가 발생했습니다: ' + error.message);
        }
    }

    async function deleteBuilding(buildingId) {
        if (!confirm('이 건물과 하위의 모든 돈사, 방, 칸이 삭제됩니다. 계속하시겠습니까?')) {
            return;
        }

        try {
            const response = await fetch(`/api/farm-facilities/buildings/${buildingId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || '삭제 실패');
            }

            await loadTreeData();
            alert('건물이 삭제되었습니다.');
        } catch (error) {
            console.error('건물 삭제 오류:', error);
            alert('삭제 중 오류가 발생했습니다: ' + error.message);
        }
    }

    function closeBuildingModal() {
        document.getElementById('buildingModal').classList.remove('show');
    }

    // ========================================
    // 돈사 관련 함수
    // ========================================
    async function showAddBarnModal(buildingId, floorNumber) {
        const modal = document.getElementById('barnModal');
        if (!modal) return;

        const floorNum = floorNumber != null && floorNumber >= 1 ? floorNumber : 1;
        document.getElementById('barnFloor').value = String(floorNum);
        document.getElementById('barnModalTitle').innerHTML = '<span>🐷</span> 돈사 ' + floorNum + '층 추가';

        document.getElementById('barnForm').reset();
        document.getElementById('barnId').value = '';
        document.getElementById('barnBuildingId').value = buildingId;
        document.getElementById('barnFloor').value = String(floorNum);

        try {
            await loadBarnTypeOptions();
        } catch (err) {
            console.warn('운영돈사 목록 로드 실패:', err);
        }
        // 화면 최상단 표시: body로 이동 + 높은 z-index (overflow 영역에 가려지지 않도록)
        if (modal.parentNode !== document.body) document.body.appendChild(modal);
        modal.style.cssText = 'display:flex!important;visibility:visible!important;z-index:99999!important;position:fixed!important;top:0!important;left:0!important;width:100%!important;height:100%!important;background:rgba(0,0,0,0.5)!important;align-items:center!important;justify-content:center!important;';
        modal.classList.add('show');
    }

    async function showEditBarnModal(barnId) {
        const barnContext = findBarnById(barnId);
        if (!barnContext) return;
        const { barn, building, floor } = barnContext;

        const modal = document.getElementById('barnModal');
        if (!modal) return;
        if (modal.parentNode !== document.body) document.body.appendChild(modal);
        modal.style.cssText = 'display:flex!important;visibility:visible!important;z-index:99999!important;position:fixed!important;top:0!important;left:0!important;width:100%!important;height:100%!important;background:rgba(0,0,0,0.5)!important;align-items:center!important;justify-content:center!important;';
        const floorNum = barn.floorNumber != null ? barn.floorNumber : (floor?.floorNumber || 1);
        document.getElementById('barnFloor').value = String(floorNum);
        document.getElementById('barnModalTitle').innerHTML = '<span>🐷</span> 돈사 ' + floorNum + '층 수정';

        document.getElementById('barnId').value = barn.id;
        document.getElementById('barnBuildingId').value = barn.buildingId;

        await loadBarnTypeOptions();

        document.getElementById('barnType').value = barn.barnType || '';
        document.getElementById('barnDescription').value = barn.description || '';
        modal.classList.add('show');
    }

    // 농장 운영돈사 목록을 셀렉트 박스에 로드
    async function loadBarnTypeOptions() {
        const selectEl = document.getElementById('barnType');

        try {
            // 농장의 운영돈사 목록 가져오기
            const response = await fetch(`/api/farm-structure/${facilitiesFarmId}/production`);

            if (!response.ok) {
                throw new Error('운영돈사 목록 로드 실패');
            }

            const farmStructures = await response.json();

            // 셀렉트 박스 초기화
            selectEl.innerHTML = '<option value="">선택하세요</option>';

            // 운영돈사 목록 추가
            farmStructures.forEach(structure => {
                const option = document.createElement('option');
                option.value = structure.name; // 돈사명을 value로 사용
                option.textContent = structure.name;
                selectEl.appendChild(option);
            });

            // 운영돈사가 없는 경우
            if (farmStructures.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = '농장 정보에서 운영돈사를 먼저 설정하세요';
                option.disabled = true;
                selectEl.appendChild(option);
            }

        } catch (error) {
            console.error('운영돈사 목록 로드 오류:', error);
            // 오류 시 기본 옵션만 표시
            selectEl.innerHTML = '<option value="">선택하세요</option>';
        }
    }

    async function saveBarnForm(e) {
        e.preventDefault();

        const barnId = document.getElementById('barnId').value;
        const buildingId = document.getElementById('barnBuildingId').value;
        const floorNumber = parseInt(document.getElementById('barnFloor').value, 10) || 1;
        const barnType = document.getElementById('barnType').value;
        const description = document.getElementById('barnDescription').value;

        if (!barnType) {
            alert('돈사 종류를 선택하세요.');
            return;
        }

        try {
            let response;
            if (barnId) {
                const ctx = findBarnById(barnId);
                const name = ctx ? ctx.barn.name : barnType;

                response = await fetch(`/api/farm-facilities/barns/${barnId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, barnType, description, floorNumber })
                });
            } else {
                const name = generateBarnName(buildingId, barnType);

                response = await fetch(`/api/farm-facilities/buildings/${buildingId}/barns`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, barnType, description, floorNumber })
                });
            }

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || '저장 실패');
            }

            closeBarnModal();
            // 모달 인라인 스타일 제거 (다음 열 때 다시 적용됨)

            // 해당 건물 / 층 노드 확장
            const savedBarn = await response.json();
            const ctx = findBarnById(savedBarn.id);
            if (ctx && ctx.building && ctx.floor) {
                expandedNodes.add(`building-${ctx.building.id}`);
                const floorKey = `floor-${ctx.building.id}-${ctx.floor.floorNumber || 1}`;
                expandedNodes.add(floorKey);
            }

            await loadTreeData();
            alert(barnId ? '돈사가 수정되었습니다.' : '돈사가 추가되었습니다.');
        } catch (error) {
            console.error('돈사 저장 오류:', error);
            alert('저장 중 오류가 발생했습니다: ' + error.message);
        }
    }

    // 돈사 이름 자동 생성 (중복 시 번호 부여)
    function generateBarnName(buildingId, barnType) {
        const building = findBuildingById(buildingId);
        const allBarns = (building?.floors || []).flatMap(f => f.barns || []);
        if (!allBarns.length) return barnType;

        const sameBarnTypes = allBarns.filter(b => b.barnType === barnType);
        if (sameBarnTypes.length === 0) return barnType;
        return `${barnType}${sameBarnTypes.length + 1}`;
    }

    async function deleteBarn(barnId) {
        if (!confirm('이 돈사와 하위의 모든 방, 칸이 삭제됩니다. 계속하시겠습니까?')) {
            return;
        }

        try {
            const response = await fetch(`/api/farm-facilities/barns/${barnId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || '삭제 실패');
            }

            await loadTreeData();
            alert('돈사가 삭제되었습니다.');
        } catch (error) {
            console.error('돈사 삭제 오류:', error);
            alert('삭제 중 오류가 발생했습니다: ' + error.message);
        }
    }

    function closeBarnModal() {
        const modal = document.getElementById('barnModal');
        if (modal) {
            modal.classList.remove('show');
            modal.style.cssText = '';
        }
    }

    // ========================================
    // 방 관련 함수
    // ========================================
    function showAddRoomModal(barnId) {
        const ctx = findBarnById(barnId);
        if (!ctx) return;
        const barn = ctx.barn;

        const modal = document.getElementById('roomModal');
        if (!modal) return;
        document.getElementById('roomModalTitle').textContent = '방 추가';
        document.getElementById('roomForm').reset();
        document.getElementById('roomId').value = '';
        document.getElementById('roomBarnId').value = barnId;
        document.getElementById('roomSectionCount').value = barn.defaultSectionsPerRoom ?? 4;

        if (modal.parentNode !== document.body) document.body.appendChild(modal);
        modal.style.cssText = 'display:flex!important;visibility:visible!important;z-index:99999!important;position:fixed!important;top:0!important;left:0!important;width:100%!important;height:100%!important;background:rgba(0,0,0,0.5)!important;align-items:center!important;justify-content:center!important;';
        modal.classList.add('show');
    }

    function showAddRoomsBulkModal(barnId) {
        const ctx = findBarnById(barnId);
        if (!ctx) return;
        const barn = ctx.barn;

        const modal = document.getElementById('roomBulkModal');
        if (!modal) return;
        document.getElementById('bulkBarnId').value = barnId;

        let nextRoomNumber = 1;
        if (barn.rooms && barn.rooms.length > 0) {
            const maxNumber = Math.max(...barn.rooms.map(r => r.roomNumber || 0));
            nextRoomNumber = maxNumber + 1;
        }

        document.getElementById('bulkStartNumber').value = nextRoomNumber;
        document.getElementById('bulkRoomCount').value = '1';
        document.getElementById('bulkSectionCount').value = barn.defaultSectionsPerRoom ?? 4;

        if (modal.parentNode !== document.body) document.body.appendChild(modal);
        modal.style.cssText = 'display:flex!important;visibility:visible!important;z-index:99999!important;position:fixed!important;top:0!important;left:0!important;width:100%!important;height:100%!important;background:rgba(0,0,0,0.5)!important;align-items:center!important;justify-content:center!important;';
        modal.classList.add('show');
    }

    function showEditRoomModal(roomId) {
        const room = findRoomById(roomId);
        if (!room) return;

        const modal = document.getElementById('roomModal');
        if (!modal) return;
        document.getElementById('roomModalTitle').textContent = '방 수정';
        document.getElementById('roomId').value = room.id;
        document.getElementById('roomBarnId').value = room.barnId;
        document.getElementById('roomName').value = room.name;
        document.getElementById('roomNumber').value = room.roomNumber || '';
        document.getElementById('roomSectionCount').value = room.sectionCount;
        document.getElementById('roomArea').value = room.area || '';
        document.getElementById('roomCapacityPerSection').value = room.capacityPerSection || '';
        document.getElementById('roomDescription').value = room.description || '';
        if (modal.parentNode !== document.body) document.body.appendChild(modal);
        modal.style.cssText = 'display:flex!important;visibility:visible!important;z-index:99999!important;position:fixed!important;top:0!important;left:0!important;width:100%!important;height:100%!important;background:rgba(0,0,0,0.5)!important;align-items:center!important;justify-content:center!important;';
        modal.classList.add('show');
    }

    async function saveRoomForm(e) {
        e.preventDefault();

        const roomId = document.getElementById('roomId').value;
        const barnId = document.getElementById('roomBarnId').value;
        const name = document.getElementById('roomName').value;
        const roomNumber = parseInt(document.getElementById('roomNumber').value) || null;
        const sectionCount = parseInt(document.getElementById('roomSectionCount').value) || 1;
        const area = parseFloat(document.getElementById('roomArea').value) || null;
        const capacityPerSection = parseInt(document.getElementById('roomCapacityPerSection').value) || null;
        const description = document.getElementById('roomDescription').value;

        try {
            let response;
            if (roomId) {
                // 수정
                response = await fetch(`/api/farm-facilities/rooms/${roomId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, roomNumber, sectionCount, area, capacityPerSection, description })
                });
            } else {
                // 추가
                response = await fetch(`/api/farm-facilities/barns/${barnId}/rooms`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, roomNumber, sectionCount, area, capacityPerSection, description })
                });
            }

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || '저장 실패');
            }

            closeRoomModal();

            expandedNodes.add(`barn-${barnId}`);
            const ctx = findBarnById(barnId);
            if (ctx && ctx.building) {
                expandedNodes.add(`building-${ctx.building.id}`);
                if (ctx.floor) {
                    expandedNodes.add(`floor-${ctx.building.id}-${ctx.floor.floorNumber || 1}`);
                }
            }

            await loadTreeData();
            alert(roomId ? '방이 수정되었습니다.' : '방이 추가되었습니다.');
        } catch (error) {
            console.error('방 저장 오류:', error);
            alert('저장 중 오류가 발생했습니다: ' + error.message);
        }
    }

    async function saveRoomsBulk(e) {
        e.preventDefault();

        const barnId = document.getElementById('bulkBarnId').value;
        const startNumber = parseInt(document.getElementById('bulkStartNumber').value);
        const roomCount = parseInt(document.getElementById('bulkRoomCount').value);
        const sectionCount = parseInt(document.getElementById('bulkSectionCount').value);

        if (roomCount < 1 || roomCount > 100) {
            alert('방 개수는 1~100 사이여야 합니다.');
            return;
        }

        const rooms = [];
        for (let i = 0; i < roomCount; i++) {
            const roomNum = startNumber + i;
            rooms.push({
                name: `${roomNum}번방`,
                roomNumber: roomNum,
                sectionCount: sectionCount
            });
        }

        try {
            const response = await fetch(`/api/farm-facilities/barns/${barnId}/rooms/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rooms })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || '저장 실패');
            }

            closeRoomBulkModal();

            // 해당 돈사 / 건물 / 층 노드 확장
            expandedNodes.add(`barn-${barnId}`);
            const ctx = findBarnById(barnId);
            if (ctx && ctx.building && ctx.floor) {
                expandedNodes.add(`building-${ctx.building.id}`);
                expandedNodes.add(`floor-${ctx.building.id}-${ctx.floor.floorNumber || 1}`);
            }

            await loadTreeData();
            alert(`${roomCount}개의 방이 추가되었습니다.`);
        } catch (error) {
            console.error('방 일괄 추가 오류:', error);
            alert('저장 중 오류가 발생했습니다: ' + error.message);
        }
    }

    async function deleteRoom(roomId) {
        if (!confirm('이 방과 하위의 모든 칸이 삭제됩니다. 계속하시겠습니까?')) {
            return;
        }

        try {
            const response = await fetch(`/api/farm-facilities/rooms/${roomId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || '삭제 실패');
            }

            await loadTreeData();
            alert('방이 삭제되었습니다.');
        } catch (error) {
            console.error('방 삭제 오류:', error);
            alert('삭제 중 오류가 발생했습니다: ' + error.message);
        }
    }

    function closeRoomModal() {
        const modal = document.getElementById('roomModal');
        if (modal) {
            modal.classList.remove('show');
            modal.style.cssText = '';
        }
    }

    function closeRoomBulkModal() {
        const modal = document.getElementById('roomBulkModal');
        if (modal) {
            modal.classList.remove('show');
            modal.style.cssText = '';
        }
    }

    // ========================================
    // 유틸리티 함수
    // ========================================
    function findBuildingById(buildingId) {
        // buildingId 는 트리 상의 "건물(동) 그룹" id
        return treeData.find(b => b.id === buildingId);
    }

    // buildingId = 건물 1 row의 id. 층은 building.floors (1..totalFloors)
    function findFloorByBuildingId(buildingId) {
        const building = treeData.find(b => b.id === buildingId);
        if (!building || !building.floors || building.floors.length === 0) return null;
        return { building, floor: building.floors[0], floors: building.floors };
    }

    function findBarnById(barnId) {
        for (const building of treeData) {
            for (const floor of building.floors || []) {
                const barn = (floor.barns || []).find(b => b.id === barnId);
                if (barn) {
                    return { barn, building, floor };
                }
            }
        }
        return null;
    }

    function findRoomById(roomId) {
        for (const building of treeData) {
            for (const floor of building.floors || []) {
                for (const barn of floor.barns || []) {
                    const room = (barn.rooms || []).find(r => r.id === roomId);
                    if (room) return room;
                }
            }
        }
        return null;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 칸 수정 모달 (임시 구현 - 향후 확장 가능)
    function showEditSectionModal(sectionId) {
        alert(`칸 ID: ${sectionId}\n\n칸별 사육 정보 수정 기능은 향후 추가될 예정입니다.\n(두수, 평균체중, 입주일, 일령 등)`);
    }

    // ========================================
    // 전역 함수로 노출 (HTML onclick에서 호출 가능하도록)
    // ========================================
    window.toggleNode = toggleNode;
    window.showAddBuildingModal = showAddBuildingModal;
    window.handleAddBuildingClick = handleAddBuildingClick;
    window.showEditBuildingModal = showEditBuildingModal;
    window.saveBuildingForm = saveBuildingForm;
    window.deleteBuilding = deleteBuilding;
    window.closeBuildingModal = closeBuildingModal;
    window.openNoStructureWarningModal = openNoStructureWarningModal;
    window.closeNoStructureWarningModal = closeNoStructureWarningModal;
    window.showAddBarnFromBuilding = showAddBarnFromBuilding;
    window.showAddBarnModalForFloor = showAddBarnModalForFloor;
    window.showAddBarnModal = showAddBarnModal;
    window.showEditBarnModal = showEditBarnModal;
    window.saveBarnForm = saveBarnForm;
    window.deleteBarn = deleteBarn;
    window.closeBarnModal = closeBarnModal;
    window.showAddRoomModal = showAddRoomModal;
    window.showAddRoomsBulkModal = showAddRoomsBulkModal;
    window.showEditRoomModal = showEditRoomModal;
    window.saveRoomForm = saveRoomForm;
    window.saveRoomsBulk = saveRoomsBulk;
    window.deleteRoom = deleteRoom;
    window.closeRoomModal = closeRoomModal;
    window.closeRoomBulkModal = closeRoomBulkModal;
    window.showEditSectionModal = showEditSectionModal;

})(); // IIFE 종료
