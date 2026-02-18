# Git 백업 방법

## 1. 현재 상태 (완료됨)

- `d:\webviewer` 폴더에 Git 저장소가 초기화되어 있습니다.
- 첫 번째 커밋이 생성되었습니다 (작업 현황 백업).
- `.gitignore`에 의해 `node_modules/`, `.env`, `*.log`는 커밋에서 제외됩니다.

---

## 2. 평소에 백업(커밋)하기

작업을 마칠 때마다 아래 명령을 실행하면 됩니다.

```powershell
cd d:\webviewer

# 변경된 파일 확인
git status

# 모든 변경 사항 스테이징
git add -A

# 커밋 (메시지는 작업 내용으로 바꿔도 됨)
git commit -m "작업 내용 요약"
```

---

## 3. 원격 저장소(GitHub 등)에 백업하기

### 3-1. GitHub에서 새 저장소 만들기

1. https://github.com 에 로그인 (Google 아이디로 로그인해도 됨)
2. **New repository** → 저장소 이름 입력 (예: `webviewer`) → **Create**
3. 저장소 URL 복사 (예: `https://github.com/kjyroom1140-sketch/pig_zone.git`)

**"본인 아이디"가 뭔가요?** (예: 이 프로젝트에서는 `kjyroom1140-sketch`)  
- Google로 로그인해도 **GitHub 사용자명(Username)**을 씁니다. Gmail 주소가 아닙니다.  
- 확인 방법: GitHub 오른쪽 위 프로필 사진 클릭 → **Your profile** → 주소창에 `github.com/여기가본인아이디` 로 나옵니다.  
- 또는 새 저장소 만든 뒤 나오는 URL에 `github.com/본인아이디/저장소이름` 형태로 표시됩니다.

### 3-2. 로컬과 연결 후 푸시

```powershell
cd d:\webviewer

# 원격 저장소 추가 (pig_zone 저장소 사용 시)
git remote add origin https://github.com/kjyroom1140-sketch/pig_zone.git

# 처음 푸시 (브랜치 이름이 main이면 main으로)
git branch -M main
git push -u origin main
```

이후에는 작업 후 커밋하고 푸시하면 됩니다.

```powershell
git add -A
git commit -m "작업 내용"
git push
```

---

## 4. Git 사용자 이름/이메일 설정 (선택)

커밋에 본인 이름이 표시되게 하려면 한 번만 설정합니다.

```powershell
# 전역 설정 (모든 프로젝트에 적용)
git config --global user.email "your@email.com"
git config --global user.name "Your Name"

# 이 프로젝트에만 적용하려면 --global 빼고
cd d:\webviewer
git config user.email "your@email.com"
git config user.name "Your Name"
```

---

## 5. 복원하는 방법

- **다른 PC나 폴더로 복사**: `d:\webviewer` 폴더 전체를 복사한 뒤, 해당 위치에서 `npm install` 실행.
- **원격에서 클론**: `git clone https://github.com/kjyroom1140-sketch/pig_zone.git` 후 `npm install`.

---

## 6. 요약

| 작업           | 명령어 |
|----------------|--------|
| 변경 사항 확인 | `git status` |
| 백업(커밋)     | `git add -A` → `git commit -m "메시지"` |
| 원격에 올리기  | `git push` (원격 설정 후) |
