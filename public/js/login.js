// 로그인 폼 제출
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        showMessage('loginMessage', '사용자명과 비밀번호를 입력해주세요.', 'error');
        return;
    }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('loginMessage', '로그인 성공! 페이지를 이동합니다...', 'success');
            setTimeout(() => {
                // system_admin은 관리자 페이지로, 그 외는 농장 선택 페이지로
                if (data.user.systemRole === 'system_admin') {
                    window.location.href = '/admin.html';
                } else {
                    window.location.href = '/select-farm.html';
                }
            }, 1000);
        } else {
            showMessage('loginMessage', data.error || '로그인에 실패했습니다.', 'error');
        }
    } catch (error) {
        console.error('로그인 오류:', error);
        showMessage('loginMessage', '서버 연결에 실패했습니다.', 'error');
    }
});

// 메시지 표시 함수
function showMessage(elementId, message, type) {
    const messageEl = document.getElementById(elementId);
    messageEl.textContent = message;
    messageEl.className = `message show ${type}`;
}

// Enter 키로 폼 제출
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('loginForm').dispatchEvent(new Event('submit'));
        }
    });
});
