# 다른 서버 DB 접근 및 IoT(MQTT) 연동 구조

다른 서버에 있는 DB에 접속해 조회·수정이 가능한지, 그리고 MQTT 서버·장치 DB를 둔 구조에서 어떻게 연동할지 정리한 문서입니다.

---

## 1. 다른 서버의 DB에 접근 가능한가?

**가능합니다.**  
현재 프로젝트는 `config/database.js`에서 `process.env.POSTGRES_HOST`로 DB 호스트를 지정합니다.  
이 값을 **다른 서버의 IP 또는 도메인**으로 바꾸고, 해당 서버에서 PostgreSQL이 **원격 접속을 허용**하도록 설정되어 있으면, 이 애플리케이션에서 그 DB에 연결해 조회·수정이 가능합니다.

### 1.1 현재 연결 설정 (예시)

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=pig_farm_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=...
```

- **같은 DB를 다른 서버로 쓰는 경우**:  
  `POSTGRES_HOST=192.168.1.100` 처럼 **원격 서버 주소**만 바꾸면 됩니다. (방화벽·pg_hba.conf에서 허용 필요)

- **두 개의 DB를 동시에 쓰는 경우** (아래 2. 참고):  
  하나는 기존 설정(농장 DB), 하나는 **별도 Sequelize 인스턴스**로 장치 DB용 연결을 만들면 됩니다.

### 1.2 필요한 조건

| 항목 | 설명 |
|------|------|
| **네트워크** | 이 앱이 돌아가는 서버 → DB 서버까지 포트(기본 5432) 접근 가능 (방화벽, 보안 그룹 등) |
| **PostgreSQL 설정** | DB 서버의 `postgresql.conf`에서 `listen_addresses`가 원격 접속을 허용하고, `pg_hba.conf`에서 해당 클라이언트 IP/계정 허용 |
| **계정** | 원격 DB에 접속할 사용자와 비밀번호. 보안상 전용 계정 + 강한 비밀번호 권장 |

---

## 2. MQTT 서버 + 장치 DB를 다른 서버에 둔 경우

말씀하신 구성처럼:

- **서버 A**: 현재 웹 앱 + 농장/일정 등 **현재 DB**
- **서버 B**: **MQTT 서버** + **장치/ IoT 정보용 DB**

이때 “장치 정보는 서버 B에서 불러온다”는 요구를 만족하는 방법은 크게 두 가지입니다.

### 방식 1: 이 앱에서 서버 B의 DB에 직접 연결

- **구조**:  
  - 이 앱(서버 A)에서 **DB 연결을 두 개** 가짐.  
    - 연결 1: 기존처럼 농장/일정용 DB (서버 A 로컬 또는 별도).  
    - 연결 2: 서버 B에 있는 **장치 DB** (PostgreSQL 등).
- **장점**:  
  - 장치 테이블을 이 앱의 Sequelize 모델로 다루면 **조회·수정 로직을 한 코드베이스**에서 처리 가능.
- **단점**:  
  - 서버 B의 DB 포트를 외부(서버 A)에 열어야 하고,  
  - DB 계정을 이 앱이 알게 되므로, 보안·권한 관리 필요.  
  - MQTT 브로커와 DB가 같은 서버에 있어도, “DB 직접 접속”과 “MQTT 구독”은 별도로 구현해야 함.

**구현 예시 (연결만 추가):**

```javascript
// config/database.js 에서 두 번째 연결 추가 예시
const sequelizeDevice = new Sequelize(
    process.env.DEVICE_DB_NAME || 'device_db',
    process.env.DEVICE_DB_USER || 'device_user',
    process.env.DEVICE_DB_PASSWORD,
    {
        host: process.env.DEVICE_DB_HOST,  // MQTT 서버(서버 B) IP/도메인
        port: process.env.DEVICE_DB_PORT || 5432,
        dialect: 'postgres',
        logging: false
    }
);
module.exports = { sequelize, sequelizeDevice, ... };
```

이렇게 하면 **다른 서버에 저장된 DB에 접근해서 조회·수정**하는 것이 가능합니다.

### 방식 2: 서버 B에 API를 두고, 이 앱은 API로 조회·수정 (권장)

- **구조**:  
  - 서버 B: MQTT 서버 + 장치 DB + **작은 HTTP API 서버** (예: Express).  
    - API 예: `GET /devices`, `GET /devices/:id`, `PUT /devices/:id`, 필요 시 MQTT로 제어 명령 전달.  
  - 서버 A(이 앱): 서버 B의 **API URL**만 알면 됨. DB에는 직접 연결하지 않음.  
  - 장치 실시간 상태는 MQTT로 서버 B가 발행하고, 이 앱은 MQTT 클라이언트로 구독해 사용할 수 있음.
- **장점**:  
  - 서버 B의 **DB 포트를 밖에 열지 않아도 됨**.  
  - 장치/DB 구조가 바뀌어도 API 스펙만 맞추면 되고, 이 앱은 “다른 서버의 API를 호출해 자료 조회·수정”만 하면 됨.  
  - MQTT와 DB는 서버 B 안에서만 연동하면 됨.
- **단점**:  
  - 서버 B에 API 서버를 하나 두어야 함.

정리하면, **“다른 서버에 있는 DB에 접근해서 조회·수정 가능한가?”** 에 대한 답은 **가능하다**이고,  
**“그걸 꼭 DB 직접 연결로 해야 하냐?”** 에 대해서는 **다른 서버에 API를 두고, 이 앱은 그 API로 조회·수정하는 방식**을 추천합니다.  
MQTT 서버와 장치 DB를 같은 서버에 둔 계획이면, 그 서버에 **장치 조회/수정용 API**를 추가하는 구성이 보안·유지보수 측면에서 유리합니다.

---

## 3. 요약

| 질문 | 답변 |
|------|------|
| 다른 서버에 있는 DB에 접속해 조회·수정 가능한가? | **가능합니다.** 호스트를 해당 서버로 두고, 방화벽·PostgreSQL 설정만 허용하면 됩니다. |
| MQTT 서버·장치 DB를 다른 서버에 두고, 여기서 장치 정보를 불러올 수 있나? | **가능합니다.** (1) 그 서버의 DB에 이 앱이 직접 연결하거나, (2) 그 서버에 API를 두고 이 앱은 API로 조회·수정하는 두 방식 모두 가능합니다. |
| 추천 구조 | **장치 DB는 다른 서버에 두고, 그 서버에 “장치 조회·수정 API”를 두고, 이 앱은 그 API + (선택) MQTT 클라이언트로 연동.** DB 직접 연결은 필요 시에만 사용. |

이 문서는 “다른 서버 DB 접근 가능 여부”와 “MQTT/장치 서버와의 연동 구조”를 위한 참고용입니다. 실제 구현 시에는 `DEVICE_DB_*` 또는 `DEVICE_API_URL`, MQTT 브로커 주소 등을 `.env`로 두고 사용하면 됩니다.
