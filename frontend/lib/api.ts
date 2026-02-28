function getApiBase(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (url === '') return ''; // HTTPS 로컬 개발 시 동일 오리진(/api) 프록시 사용
  if (url) return url;
  return 'http://localhost:8080';
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  return path.startsWith('http') ? path : `${base}/api${path}`;
}

const AUTH_TOKEN_KEY = 'auth_token';

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  else sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const t = getStoredToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** API 요청 시 credentials + Authorization 헤더를 항상 포함 */
function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    credentials: 'include',
    ...init,
    headers: { ...authHeaders(), ...(init?.headers as Record<string, string>) },
  });
}

export type LoginResponse = {
  message: string;
  user: { id: string; username: string; fullName: string; systemRole: string; email?: string | null; phone?: string | null };
  token?: string;
};

export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await apiFetch(apiUrl('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '로그인 실패');
  if (data.token) setAuthToken(data.token);
  return data;
}

export async function logout(): Promise<void> {
  setAuthToken(null);
  await apiFetch(apiUrl('/auth/logout'), { method: 'POST' });
}

export async function me(): Promise<{ user: LoginResponse['user']; currentFarmId: string | null; position?: string | null }> {
  const res = await apiFetch(apiUrl('/auth/me'));
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '인증 실패');
  return data;
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch(apiUrl(path), options);
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error || '요청 실패');
  return data as T;
}

export type UserListItem = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  systemRole: string;
  isActive: boolean;
  createdAt: string;
};

export async function getAdminStats(): Promise<{ users: number; farms: number }> {
  const data = await fetchApi<{ stats: { users: number; farms: number } }>('/admin/stats');
  return data.stats;
}

export async function getAdminUsers(): Promise<{ users: UserListItem[] }> {
  return fetchApi('/admin/users');
}

export type CreateUserBody = {
  username: string;
  fullName: string;
  email: string;
  password: string;
  phone?: string;
};

export async function createAdminUser(body: CreateUserBody): Promise<{ message: string; user: { id: string; username: string; fullName: string; email: string; systemRole: string } }> {
  const res = await apiFetch(apiUrl('/admin/users'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error || '회원 추가 실패');
  return data as { message: string; user: { id: string; username: string; fullName: string; email: string; systemRole: string } };
}

export type UpdateUserBody = {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
};

export async function updateAdminUser(userId: string, body: UpdateUserBody): Promise<{ message: string }> {
  const res = await apiFetch(apiUrl(`/admin/users/${userId}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error || '회원 수정 실패');
  return data as { message: string };
}

export async function getAdminFarms(): Promise<{ farms: { id: string; farmName: string; farmCode: string; status: string; createdAt: string }[] }> {
  return fetchApi('/admin/farms');
}

export async function getAdminUserFarms(userId: string): Promise<{ farms: { id: string; farmName: string; farmCode: string; status: string; createdAt: string }[] }> {
  return fetchApi(`/admin/user-farms/${userId}`);
}

/** 기준내용(criteria_content) type별 형식. 시작일·종료일은 일(1-31) 숫자로 저장 */
export type CriteriaContentType = 'range' | 'daily' | 'weekly' | 'weekend' | 'monthly' | 'yearly' | 'count';
export type CriteriaContent =
  | { type: 'range'; start_day?: number; end_day?: number }
  | { type: 'daily' }
  | { type: 'weekly'; interval?: number; by_weekday?: number[] }
  | { type: 'weekend'; start_day?: number; end_day?: number }
  | { type: 'monthly'; day_of_month?: number }
  | { type: 'yearly'; month?: number; day?: number }
  | { type: 'count'; count?: number };

/** 전역 기초 일정(schedule_work_plans). sortationId/jobtypeId/criteriaId 는 정의(definitions) 테이블 id. */
export type ScheduleWorkPlanItem = {
  id: number;
  structureTemplateId: number | null;
  sortationId: number | null;
  jobtypeId: number | null;
  criteriaId: number | null;
  criteriaContent: CriteriaContent | null;
  workContent?: string | null;
  createdAt: string;
  updatedAt: string;
  structureTemplateName?: string | null;
  sortationName?: string | null;
  jobtypeName?: string | null;
  criteriaName?: string | null;
};
export async function getScheduleWorkPlans(): Promise<ScheduleWorkPlanItem[]> {
  const res = await apiFetch(apiUrl('/admin/schedule-work-plans'), { credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string; detail?: string };
    const msg = err.detail ? `${err.error ?? '목록 조회 실패'}: ${err.detail}` : (err.error || '목록 조회 실패');
    throw new Error(msg);
  }
  return Array.isArray(data) ? data : [];
}

export async function createScheduleWorkPlan(body: {
  structure_template_id: number | null;
  sortation_id: number | null;
  jobtype_id: number | null;
  criteria_id: number | null;
  criteria_content: CriteriaContent | null;
  work_content?: string | null;
}): Promise<{ id: number }> {
  const res = await apiFetch(apiUrl('/admin/schedule-work-plans'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string; detail?: string };
    const msg = err.detail ? `${err.error ?? '기초 일정 추가 실패'}: ${err.detail}` : (err.error || '기초 일정 추가 실패');
    throw new Error(msg);
  }
  return data as { id: number };
}

export async function updateScheduleWorkPlan(
  id: number,
  body: {
    structure_template_id?: number | null;
    sortation_id?: number | null;
    jobtype_id?: number | null;
    criteria_id?: number | null;
    criteria_content?: CriteriaContent | null;
    work_content?: string | null;
  }
): Promise<void> {
  const res = await apiFetch(apiUrl(`/admin/schedule-work-plans/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '기초 일정 수정 실패');
  }
}

export async function deleteScheduleWorkPlan(id: number): Promise<void> {
  const res = await apiFetch(apiUrl(`/admin/schedule-work-plans/${id}`), {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '기초 일정 삭제 실패');
  }
}

/** 작업 목록 순서 변경. id_order: 새 순서의 id 배열 */
export async function reorderScheduleWorkPlans(idOrder: number[]): Promise<void> {
  const res = await apiFetch(apiUrl('/admin/schedule-work-plans/reorder'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ id_order: idOrder }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '순서 변경 실패');
  }
}

/** 구분. 시설(structure_template_id)별 필터 가능. sort_order: 표시 순서. sortation_name은 definition 조인 시 채워짐. sortation_definition_id: 정의 테이블 id (기초 일정 저장 시 사용) */
export type ScheduleSortationItem = { id: number; structure_template_id: number | null; sortations: string | null; sortation_name?: string | null; sortation_definition_id?: number | null; sort_order?: number };
export async function getScheduleSortations(structureTemplateId?: number): Promise<ScheduleSortationItem[]> {
  const q = structureTemplateId != null ? `?structure_template_id=${structureTemplateId}` : '';
  return fetchApi(`/schedule-sortations${q}`);
}

export async function createScheduleSortation(body: { structure_template_id: number; sortation_definition_id?: number; sortations?: unknown; sort_order?: number }): Promise<{ id: number }> {
  const res = await apiFetch(apiUrl('/schedule-sortations'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '구분 추가 실패');
  return data as { id: number };
}

/** 구분 정의 마스터 (구분 추가 시 선택용) */
export type ScheduleSortationDefinitionItem = { id: number; name: string; sort_order: number };
export async function getScheduleSortationDefinitions(): Promise<ScheduleSortationDefinitionItem[]> {
  return fetchApi('/schedule-sortation-definitions');
}

export async function createScheduleSortationDefinition(body: { name: string; sort_order?: number }): Promise<{ id: number }> {
  const res = await apiFetch(apiUrl('/schedule-sortation-definitions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '구분 정의 추가 실패');
  return data as { id: number };
}

export async function updateScheduleSortationDefinition(id: number, body: { name?: string; sort_order?: number }): Promise<void> {
  const res = await apiFetch(apiUrl(`/schedule-sortation-definitions/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '수정 실패');
}

export async function deleteScheduleSortationDefinition(id: number): Promise<void> {
  const res = await apiFetch(apiUrl(`/schedule-sortation-definitions/${id}`), { method: 'DELETE', credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '구분 정의 삭제 실패');
  }
}

/** 기준. 작업유형(jobtype_id) 연결. sort_order: 표시 순서. criteria_name/content_type는 definition 조인 시 채워짐. criteria_definition_id: 정의 테이블 id (기초 일정 저장 시 사용) */
export type ScheduleCriteriaItem = { id: number; jobtype_id: number | null; criterias: string | null; criteria_name?: string | null; content_type?: string | null; criteria_definition_id?: number | null; description?: string | null; sort_order?: number };
export async function getScheduleCriterias(): Promise<ScheduleCriteriaItem[]> {
  return fetchApi('/schedule-criterias');
}

export async function createScheduleCriteria(body: { name?: string; jobtype_id: number; criteria_definition_id?: number; criterias?: unknown; description?: string | null; sort_order?: number }): Promise<{ id: number }> {
  const res = await apiFetch(apiUrl('/schedule-criterias'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string; detail?: string };
    const msg = err.detail ? `${err.error ?? '기준 추가 실패'}: ${err.detail}` : (err.error || '기준 추가 실패');
    throw new Error(msg);
  }
  return data as { id: number };
}

/** 작업유형. 구분(sortation_id) 연결. sort_order: 표시 순서. jobtype_name은 definition 조인 시 채워짐. jobtype_definition_id: 정의 테이블 id (기초 일정 저장 시 사용) */
export type ScheduleJobtypeItem = { id: number; sortation_id: number | null; jobtypes: string | null; jobtype_name?: string | null; jobtype_definition_id?: number | null; sort_order?: number };
export async function getScheduleJobtypes(): Promise<ScheduleJobtypeItem[]> {
  return fetchApi('/schedule-jobtypes');
}

export async function createScheduleJobtype(body: { name?: string; sortation_id: number; jobtype_definition_id?: number; jobtypes?: unknown; sort_order?: number }): Promise<{ id: number }> {
  const res = await apiFetch(apiUrl('/schedule-jobtypes'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string; detail?: string };
    const msg = err.detail ? `${err.error ?? '작업유형 추가 실패'}: ${err.detail}` : (err.error || '작업유형 추가 실패');
    throw new Error(msg);
  }
  return data as { id: number };
}

/** 작업유형 정의 마스터 (작업유형 목록 선택 시 사용) */
export type ScheduleJobtypeDefinitionItem = { id: number; name: string; sort_order: number };
export async function getScheduleJobtypeDefinitions(): Promise<ScheduleJobtypeDefinitionItem[]> {
  return fetchApi('/schedule-jobtype-definitions');
}

export async function createScheduleJobtypeDefinition(body: { name: string; sort_order?: number }): Promise<{ id: number }> {
  const res = await apiFetch(apiUrl('/schedule-jobtype-definitions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '작업유형 정의 추가 실패');
  return data as { id: number };
}

export async function updateScheduleJobtypeDefinition(id: number, body: { name?: string; sort_order?: number }): Promise<void> {
  const res = await apiFetch(apiUrl(`/schedule-jobtype-definitions/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '수정 실패');
}

export async function deleteScheduleJobtypeDefinition(id: number): Promise<void> {
  const res = await apiFetch(apiUrl(`/schedule-jobtype-definitions/${id}`), { method: 'DELETE', credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '작업유형 정의 삭제 실패');
  }
}

export async function updateScheduleSortation(id: number, body: { structure_template_id?: number | null; sortations?: unknown; sort_order?: number }): Promise<void> {
  const res = await apiFetch(apiUrl(`/schedule-sortations/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '수정 실패');
  }
}

export async function updateScheduleCriteria(id: number, body: { jobtype_id?: number | null; criterias?: unknown; description?: string | null; sort_order?: number }): Promise<void> {
  const res = await apiFetch(apiUrl(`/schedule-criterias/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '수정 실패');
  }
}

export async function updateScheduleJobtype(id: number, body: { sortation_id?: number | null; jobtypes?: unknown; sort_order?: number }): Promise<void> {
  const res = await apiFetch(apiUrl(`/schedule-jobtypes/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '수정 실패');
  }
}

export async function deleteScheduleSortation(id: number): Promise<void> {
  const res = await apiFetch(apiUrl(`/schedule-sortations/${id}`), { method: 'DELETE', credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '구분 삭제 실패');
  }
}

export async function deleteScheduleCriteria(id: number): Promise<void> {
  const res = await apiFetch(apiUrl(`/schedule-criterias/${id}`), { method: 'DELETE', credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '기준 삭제 실패');
  }
}

export async function deleteScheduleJobtype(id: number): Promise<void> {
  const res = await apiFetch(apiUrl(`/schedule-jobtypes/${id}`), { method: 'DELETE', credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '작업유형 삭제 실패');
  }
}

/** 기준 정의 마스터 (기준내용 표현 방법). 기준 추가 시 이 목록에서 선택 */
export type ScheduleCriteriaDefinitionItem = { id: number; name: string; content_type: string; sort_order: number };
export async function getScheduleCriteriaDefinitions(): Promise<ScheduleCriteriaDefinitionItem[]> {
  return fetchApi('/schedule-criteria-definitions');
}

export async function createScheduleCriteriaDefinition(body: { name: string; content_type: string; sort_order?: number }): Promise<{ id: number }> {
  const res = await apiFetch(apiUrl('/schedule-criteria-definitions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '기준 정의 추가 실패');
  return data as { id: number };
}

export async function updateScheduleCriteriaDefinition(id: number, body: { name?: string; content_type?: string; sort_order?: number }): Promise<void> {
  const res = await apiFetch(apiUrl(`/schedule-criteria-definitions/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '수정 실패');
}

export async function deleteScheduleCriteriaDefinition(id: number): Promise<void> {
  const res = await apiFetch(apiUrl(`/schedule-criteria-definitions/${id}`), { method: 'DELETE', credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '기준 정의 삭제 실패');
  }
}

export type BreedItem = { id: number; code: string; nameKo: string; nameEn: string | null; usage: string | null };
export async function getBreeds(): Promise<BreedItem[]> {
  return fetchApi('/breeds');
}

export type FarmItem = {
  id: string;
  farmName: string;
  farmCode: string;
  ownerId?: string;
  status?: string;
  createdAt?: string;
  role?: string;
  ownerName?: string | null;
  businessNumber?: string | null;
  farmType?: string | null;
  address?: string | null;
  postalCode?: string | null;
  country?: string | null;
  addressDetail?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  email?: string | null;
  officePhone?: string | null;
  faxNumber?: string | null;
};

export async function getFarms(): Promise<{ farms: FarmItem[] }> {
  return fetchApi('/farms');
}

export type FarmUpdateBody = {
  farmCode?: string;
  farmName?: string;
  ownerName?: string;
  businessNumber?: string;
  farmType?: string;
  address?: string;
  postalCode?: string;
  country?: string;
  addressDetail?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  phone?: string;
  email?: string;
  officePhone?: string;
  faxNumber?: string;
};

export async function updateFarm(farmId: string, body: FarmUpdateBody): Promise<{ message: string }> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error || '저장 실패');
  return data;
}

export async function getConnectionSettings(): Promise<{
  connection: {
    serverUrl: string;
    serverUser: string;
    serverPassword: string;
    dbHost: string;
    dbPort: string;
    dbName: string;
    dbUser: string;
    dbPassword: string;
  };
}> {
  return fetchApi('/admin/settings/connection');
}

export async function saveConnectionSettings(body: Record<string, string>): Promise<{ message: string }> {
  const res = await apiFetch(apiUrl('/admin/settings/connection'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error || '저장 실패');
  return data;
}

export async function getFarm(farmId: string): Promise<{ id: string; farmName: string; farmCode: string; status: string }> {
  const data = await fetchApi<{ farm?: { id: string; farmName: string; farmCode: string; status: string } }>(`/farms/${farmId}`);
  const farm = data?.farm;
  if (farm) return farm;
  return data as unknown as { id: string; farmName: string; farmCode: string; status: string };
}

export async function getFarmStructureProduction(farmId: string): Promise<{ id: string; templateId: number; name: string; weight?: string; optimalDensity?: number; description?: string }[]> {
  return fetchApi(`/farm-structure/${farmId}/production`);
}

/** 농장 사육시설(production) 저장. templateIds: 선택한 structure_templates id 배열 */
export async function saveFarmStructureProduction(farmId: string, templateIds: number[]): Promise<{ message: string }> {
  const res = await apiFetch(apiUrl(`/farm-structure/${farmId}/production`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateIds }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error || '농장 구조 저장 실패');
  return data as { message: string };
}

// 농장 시설 트리 타입 (건물 → 돈사 → 방 → 칸)
export type FarmSection = {
  id: string;
  name?: string | null;
  sectionNumber?: number | null;
  currentPigCount?: number | null;
  averageWeight?: unknown;
  entryDate?: unknown;
  birthDate?: unknown;
  breedType?: unknown;
  area?: unknown;
  capacity?: unknown;
  orderIndex?: number | null;
};
export type FarmRoom = {
  id: string;
  name?: string | null;
  roomNumber?: number | null;
  sectionCount?: number | null;
  area?: unknown;
  totalCapacity?: unknown;
  orderIndex?: number | null;
  sections: FarmSection[];
};
export type FarmBarn = {
  id: string;
  name?: string | null;
  barnType?: string | null;
  structureTemplateId?: number;
  floorNumber?: number | null;
  orderIndex?: number | null;
  description?: string | null;
  rooms: FarmRoom[];
};
export type FarmBuilding = {
  id: string;
  name: string;
  code?: string | null;
  orderIndex?: number | null;
  description?: string | null;
  totalFloors?: number | null;
  barns: FarmBarn[];
};

export async function getFarmFacilitiesTree(farmId: string): Promise<FarmBuilding[]> {
  return fetchApi(`/farm-facilities/${farmId}/tree`, { cache: 'no-store' });
}

export async function createFarmBuilding(
  farmId: string,
  body: { name?: string; totalFloors?: number }
): Promise<{ id: string; name: string; totalFloors: number }> {
  return fetchApi(`/farm-facilities/${farmId}/buildings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function updateFarmBuilding(
  farmId: string,
  buildingId: string,
  body: { name?: string; totalFloors?: number; description?: string }
): Promise<{ message: string }> {
  return fetchApi(`/farm-facilities/${farmId}/buildings/${buildingId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteFarmBuilding(farmId: string, buildingId: string): Promise<{ message: string }> {
  return fetchApi(`/farm-facilities/${farmId}/buildings/${buildingId}`, { method: 'DELETE' });
}

export async function createFarmBarn(
  farmId: string,
  buildingId: string,
  body: {
    structureTemplateId?: number;
    category?: string;
    floorNumber?: number;
    name?: string;
    roomCount?: number;
  }
): Promise<{ id: string; name: string; barnType: string; floorNumber: number; roomIds: string[] }> {
  return fetchApi(`/farm-facilities/${farmId}/buildings/${buildingId}/barns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function updateFarmBarn(
  farmId: string,
  barnId: string,
  body: { name?: string; description?: string }
): Promise<{ message: string }> {
  return fetchApi(`/farm-facilities/${farmId}/barns/${barnId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteFarmBarn(farmId: string, barnId: string): Promise<{ message: string }> {
  return fetchApi(`/farm-facilities/${farmId}/barns/${barnId}`, { method: 'DELETE' });
}

export async function createFarmRoomsBulk(
  farmId: string,
  barnId: string,
  count: number
): Promise<{ roomIds: string[]; count: number }> {
  return fetchApi(`/farm-facilities/${farmId}/barns/${barnId}/rooms/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count }),
  });
}

export async function updateFarmRoom(
  farmId: string,
  roomId: string,
  body: { name?: string }
): Promise<{ message: string }> {
  return fetchApi(`/farm-facilities/${farmId}/rooms/${roomId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteFarmRoom(farmId: string, roomId: string): Promise<{ message: string }> {
  return fetchApi(`/farm-facilities/${farmId}/rooms/${roomId}`, { method: 'DELETE' });
}

export async function createFarmSectionsBulk(
  farmId: string,
  roomId: string,
  count: number
): Promise<{ sectionIds: string[]; count: number }> {
  return fetchApi(`/farm-facilities/${farmId}/rooms/${roomId}/sections/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count }),
  });
}

export async function getFarmStaff(farmId: string): Promise<{ userFarmId: string; userId: string; username?: string; fullName?: string; email?: string; phone?: string; role: string; department?: string; position?: string }[]> {
  return fetchApi(`/farms/${farmId}/staff`);
}

export type StructureTemplate = {
  id: number;
  name: string;
  category: string;
  themeColor?: string | null;
  weight?: string;
  optimalDensity?: number;
  ageLabel?: string;
  description?: string;
  sortOrder: number;
};

export async function getStructureTemplates(): Promise<StructureTemplate[]> {
  return fetchApi('/structureTemplates');
}

export async function createStructureTemplate(body: {
  name: string;
  category: string;
  themeColor?: string;
  weight?: string;
  optimalDensity?: number;
  ageLabel?: string;
  description?: string;
}): Promise<StructureTemplate> {
  const res = await apiFetch(apiUrl('/structureTemplates'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    const text = await res.text();
    console.error('[structureTemplates POST]', res.status, text);
    throw new Error(res.status === 500 ? '서버 오류. 콘솔(F12)에서 상세 메시지를 확인하세요.' : `요청 실패: ${res.status}`);
  }
  if (!res.ok) {
    const err = data as { error?: string; detail?: string };
    const msg = err.detail ? `${err.error || '추가 실패'}: ${err.detail}` : (err.error || '추가 실패');
    console.error('[structureTemplates POST]', res.status, err);
    throw new Error(msg);
  }
  return data as StructureTemplate;
}

export async function updateStructureTemplate(
  id: number,
  body: {
    name?: string;
    category?: string;
    themeColor?: string;
    weight?: string;
    optimalDensity?: number;
    ageLabel?: string;
    description?: string;
    sortOrder?: number;
  }
): Promise<StructureTemplate> {
  const res = await apiFetch(apiUrl(`/structureTemplates/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error || '수정 실패');
  return data as StructureTemplate;
}

export async function deleteStructureTemplate(id: number): Promise<void> {
  const res = await apiFetch(apiUrl(`/structureTemplates/${id}`), {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error((data as { error?: string }).error || '삭제 실패');
  }
}

export async function reorderStructureTemplate(id: number, direction: 'up' | 'down'): Promise<void> {
  const res = await apiFetch(apiUrl('/structureTemplates/reorder'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ id, direction }),
  });
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) throw new Error('순서 변경 실패');
    return;
  }
  if (!res.ok) throw new Error((data as { error?: string }).error || '순서 변경 실패');
}

export async function getFarmScheduleTaskTypes(farmId: string): Promise<{ id: number; name: string; code?: string; category?: string; sortOrder: number }[]> {
  return fetchApi(`/farms/${farmId}/schedule-task-types`);
}

export async function getFarmScheduleBasisTypes(farmId: string): Promise<{ id: number; name: string; code?: string; targetType?: string; sortOrder: number }[]> {
  return fetchApi(`/farms/${farmId}/schedule-basis-types`);
}

export async function getFarmScheduleItems(
  farmId: string,
  params?: { targetType?: string; structureTemplateId?: string; taskTypeId?: string; basisTypeId?: string }
): Promise<FarmScheduleItem[]> {
  const q = new URLSearchParams(params as Record<string, string>).toString();
  return fetchApi(`/farms/${farmId}/schedule-items${q ? `?${q}` : ''}`);
}

export type FarmScheduleItem = {
  id: number;
  farmId: string;
  targetType: string;
  structureTemplateId?: number;
  basisTypeId?: number;
  ageLabel?: string;
  dayMin?: number;
  dayMax?: number;
  taskTypeId: number;
  sortOrder: number;
  isActive: boolean;
  recurrenceType?: string;
  recurrenceInterval?: number;
  recurrenceWeekdays?: string;
  recurrenceMonthDay?: number;
  structureTemplate?: { id: number; name: string; category?: string };
  taskType?: { id: number; code?: string; name: string; category?: string };
  basisTypeRef?: { id: number; code?: string; name: string; targetType?: string };
};

export async function getFarmScheduleWorkPlans(
  farmId: string,
  from: string,
  to: string
): Promise<FarmScheduleWorkPlan[]> {
  return fetchApi(`/farms/${farmId}/schedule-work-plans?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
}

export type FarmScheduleWorkPlan = {
  id: number;
  farmId: string;
  farmScheduleItemId: number;
  taskTypeCategory?: string;
  roomId?: string;
  sectionId?: string;
  plannedStartDate: string;
  plannedEndDate: string;
  entrySource?: string;
  entryCount?: number;
  completedDate?: string;
  scheduleItem?: { id: number; taskType?: { id: number; code?: string; name: string; category?: string } };
};
