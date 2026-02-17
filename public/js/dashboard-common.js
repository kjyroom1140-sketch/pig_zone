/**
 * 대시보드 공통: 헤더·네비 조각 주입, farmId, 사용자/농장명, 네비 active, 로그아웃
 * 각 대시보드 페이지에서 placeholder(#dashboard-header-nav-placeholder) + 이 스크립트 포함
 */
(function () {
    'use strict';

    var placeholder = document.getElementById('dashboard-header-nav-placeholder');
    if (!placeholder) return;

    var params = new URLSearchParams(window.location.search);
    var farmId = params.get('farmId');
    var currentPage = document.body.getAttribute('data-dashboard-page') || '';

    // farmId 없을 때: dashboard가 아니면 select-farm 또는 dashboard로
    if (!farmId && currentPage !== 'monitoring') {
        window.location.href = '/dashboard.html';
        return;
    }

    window.dashboardFarmId = farmId;

    function setNavHrefs() {
        var q = farmId ? '?farmId=' + encodeURIComponent(farmId) : '';
        [].forEach.call(document.querySelectorAll('.dashboard-nav-item'), function (el) {
            var path = (el.getAttribute('data-href') || '').split('?')[0];
            if (path) el.setAttribute('data-href', path + q);
            var page = el.getAttribute('data-nav-page');
            if (page === currentPage) el.classList.add('active');
        });
        bindNavClicks();
    }

    function bindNavClicks() {
        [].forEach.call(document.querySelectorAll('.dashboard-nav-item'), function (el) {
            el.onclick = function () {
                var url = this.getAttribute('data-href');
                if (url) window.location.href = url;
            };
            el.onkeydown = function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    var url = this.getAttribute('data-href');
                    if (url) window.location.href = url;
                }
            };
        });
    }

    function applyAuth(data) {
        var user = data && data.user;
        if (!user) return;

        var el;
        if (el = document.getElementById('headerUserInfo'))
            el.textContent = user.fullName || user.username || '—';

        var roleBadge = document.getElementById('userRoleBadge');
        var systemBadge = document.getElementById('systemRoleBadge');
        if (roleBadge && systemBadge) {
            if (['system_admin', 'super_admin'].indexOf(user.systemRole) >= 0) {
                roleBadge.textContent = '최고 관리자';
                roleBadge.className = 'badge badge-admin';
                systemBadge.textContent = '최고 관리자 모드';
                systemBadge.style.background = 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)';
            } else {
                roleBadge.textContent = '관리자';
                systemBadge.textContent = '농장 관리 시스템';
            }
        }

        var userFarms = Array.isArray(user.userFarms) ? user.userFarms : [];
        var uf = userFarms.filter(function (x) { return x.farm && x.farm.id === farmId; })[0];
        if (el = document.getElementById('currentFarmName'))
            el.textContent = (uf && uf.farm) ? uf.farm.farmName : (farmId ? '권한 없음' : '농장을 선택해 주세요');

        if (el = document.getElementById('linkFarmAdmin'))
            el.href = farmId ? '/farm_admin.html?farmId=' + encodeURIComponent(farmId) : '/select-farm.html';

        var navSettings = document.getElementById('navFarmSettings');
        if (navSettings) {
            var isSystemOrSuper = ['system_admin', 'super_admin'].indexOf(user.systemRole) >= 0;
            var farmRole = (uf && uf.role) ? uf.role : '';
            var isFarmAdmin = farmRole === 'farm_admin' || farmRole === 'owner';
            if (isSystemOrSuper || isFarmAdmin) {
                navSettings.style.display = '';
                navSettings.setAttribute('data-href', '/farm_admin.html?farmId=' + encodeURIComponent(farmId));
            } else {
                navSettings.style.display = 'none';
            }
        }

        if (uf && uf.farm && document.title)
            document.title = uf.farm.farmName + ' - ' + (document.title.split(' - ')[1] || document.title);
    }

    function bindLogout() {
        var btn = document.getElementById('btnLogout');
        if (!btn) return;
        btn.onclick = function () {
            fetch('/api/auth/logout', { method: 'POST' })
                .then(function (res) { if (res.ok) window.location.href = '/login.html'; })
                .catch(function (e) { console.error(e); });
        };
    }

    fetch('/partials/dashboard-header-nav.html')
        .then(function (res) { return res.text(); })
        .then(function (html) {
            placeholder.innerHTML = html;
            setNavHrefs();
            bindLogout();

            if (!farmId) {
                if (document.getElementById('currentFarmName'))
                    document.getElementById('currentFarmName').textContent = '농장을 선택해 주세요';
                if (document.getElementById('headerUserInfo'))
                    document.getElementById('headerUserInfo').textContent = '—';
                if (document.getElementById('linkFarmAdmin'))
                    document.getElementById('linkFarmAdmin').href = '/select-farm.html';
                return;
            }

            fetch('/api/auth/me')
                .then(function (res) {
                    if (res.status === 401) {
                        window.location.href = '/login.html';
                        return null;
                    }
                    return res.json();
                })
                .then(function (data) {
                    if (data) applyAuth(data);
                })
                .catch(function (err) {
                    console.error(err);
                    if (document.getElementById('currentFarmName'))
                        document.getElementById('currentFarmName').textContent = '오류';
                    if (document.getElementById('headerUserInfo'))
                        document.getElementById('headerUserInfo').textContent = '—';
                });
        })
        .catch(function (err) {
            console.error('헤더 로드 실패:', err);
            placeholder.innerHTML = '<p class="dashboard-main">헤더를 불러올 수 없습니다. <a href="/select-farm.html">농장 선택</a></p>';
        });
})();
