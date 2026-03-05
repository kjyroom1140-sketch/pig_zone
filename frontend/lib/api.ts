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
  targetStructureTemplateId?: number | null;
  targetStructureTemplateName?: string | null;
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

// ---------------------------
// Farm: Admin과 동일한 일정 마스터 CRUD (farm scoped)
// - /api/farms/:farmId/schedule-*
// - work plans master: /api/farms/:farmId/schedule-work-plans-master
// ---------------------------

export type FarmScheduleWorkPlanMasterItem = ScheduleWorkPlanItem;

export async function getFarmScheduleWorkPlansMaster(farmId: string): Promise<FarmScheduleWorkPlanMasterItem[]> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-work-plans-master`), { credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string; detail?: string };
    const msg = err.detail ? `${err.error ?? '목록 조회 실패'}: ${err.detail}` : (err.error || '목록 조회 실패');
    throw new Error(msg);
  }
  return Array.isArray(data) ? (data as FarmScheduleWorkPlanMasterItem[]) : [];
}

export type FarmScheduleExecutionItem = {
  id: string;
  farmId: string;
  workPlanId?: number | null;
  sectionId?: string | null;
  executionType: 'birth' | 'move' | 'inspection' | string;
  scheduledDate: string; // YYYY-MM-DD
  status: 'pending' | 'completed' | 'skipped' | 'cancelled' | string;
  completedAt?: string | null;
  completedBy?: string | null;
  resultRefType?: string | null;
  resultRefId?: string | null;
  idempotencyKey?: string | null;
  createdAt: string;
  updatedAt: string;
  workContent?: string | null;
  sortationName?: string | null;
  jobtypeName?: string | null;
  criteriaName?: string | null;
};

export async function getFarmScheduleExecutions(
  farmId: string,
  params?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    executionType?: string;
    sectionId?: string;
    limit?: number;
  }
): Promise<FarmScheduleExecutionItem[]> {
  const qs = new URLSearchParams();
  if (params?.startDate) qs.set('startDate', params.startDate);
  if (params?.endDate) qs.set('endDate', params.endDate);
  if (params?.status) qs.set('status', params.status);
  if (params?.executionType) qs.set('executionType', params.executionType);
  if (params?.sectionId) qs.set('sectionId', params.sectionId);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return fetchApi(`/farms/${farmId}/schedule-executions${suffix}`);
}

export type SyncFarmScheduleExecutionsFromOpeningResult = {
  synced: boolean;
  createdExecutions: number;
  scannedGroups: number;
  skippedNoBirthDate: number;
  reason?: string;
};

export async function syncFarmScheduleExecutionsFromOpening(
  farmId: string
): Promise<SyncFarmScheduleExecutionsFromOpeningResult> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-executions/sync-opening`), {
    method: 'POST',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string; detail?: string };
    const msg = err.detail ? `${err.error ?? '일정 동기화 실패'}: ${err.detail}` : (err.error || '일정 동기화 실패');
    throw new Error(msg);
  }
  return data as SyncFarmScheduleExecutionsFromOpeningResult;
}

export type CreateFarmScheduleExecutionBody = {
  /** 1회성 등록 시 생략. sortationId, jobtypeId, workContent 사용 */
  workPlanId?: number;
  sortationId?: number;
  jobtypeId?: number;
  workContent?: string;
  sectionId: string;
  executionType?: 'birth' | 'move' | 'inspection';
  scheduledDate: string; // YYYY-MM-DD
  idempotencyKey?: string;
};

export async function createFarmScheduleExecution(
  farmId: string,
  body: CreateFarmScheduleExecutionBody
): Promise<FarmScheduleExecutionItem> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-executions`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string; detail?: string };
    const msg = err.detail ? `${err.error ?? '예정 등록 실패'}: ${err.detail}` : (err.error || '예정 등록 실패');
    throw new Error(msg);
  }
  return data as FarmScheduleExecutionItem;
}

export async function deleteFarmScheduleExecution(
  farmId: string,
  executionId: string
): Promise<{ deleted: boolean }> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-executions/${executionId}`), {
    method: 'DELETE',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string; detail?: string };
    const msg = err.detail ? `${err.error ?? '예정 삭제 실패'}: ${err.detail}` : (err.error || '예정 삭제 실패');
    throw new Error(msg);
  }
  return data as { deleted: boolean };
}

export type CompleteFarmScheduleExecutionBirthBody = {
  bornCount: number;
  sectionId?: string;
  groupNo?: string;
  originSowId?: string;
  memo?: string;
  idempotencyKey: string;
};

export type CompleteFarmScheduleExecutionBirthResult = {
  id: string;
  status: 'completed' | string;
  resultRefType?: string;
  resultRefId?: string;
  groupId?: string;
  groupNo?: string;
  message?: string;
};

export async function completeFarmScheduleExecutionBirth(
  farmId: string,
  executionId: string,
  body: CompleteFarmScheduleExecutionBirthBody
): Promise<CompleteFarmScheduleExecutionBirthResult> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-executions/${executionId}/complete-birth`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string; detail?: string };
    const msg = err.detail ? `${err.error ?? '분만 완료 실패'}: ${err.detail}` : (err.error || '분만 완료 실패');
    throw new Error(msg);
  }
  return data as CompleteFarmScheduleExecutionBirthResult;
}

export type CompleteFarmScheduleExecutionMoveLine = {
  /** 생략 시 출발 칸(fromSectionId)의 유일한 돈군으로 자동 결정 */
  sourceGroupId?: string;
  /** 생략 시 도착 칸(toSectionId)에 기존 돈군이 있으면 해당 돈군, 없으면 신규 생성 */
  targetGroupId?: string;
  fromSectionId?: string;
  toSectionId: string;
  headCount: number;
  lineType?: string;
};

export type CompleteFarmScheduleExecutionMoveBody = {
  eventType: 'full' | 'partial' | 'split' | 'merge' | 'entry' | 'shipment';
  memo?: string;
  idempotencyKey: string;
  lines: CompleteFarmScheduleExecutionMoveLine[];
};

export type CompleteFarmScheduleExecutionMoveResult = {
  id: string;
  status: 'completed' | string;
  resultRefType?: string;
  resultRefId?: string;
  lines?: number;
  message?: string;
};

export async function completeFarmScheduleExecutionMove(
  farmId: string,
  executionId: string,
  body: CompleteFarmScheduleExecutionMoveBody
): Promise<CompleteFarmScheduleExecutionMoveResult> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-executions/${executionId}/complete-move`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string; detail?: string };
    const msg = err.detail ? `${err.error ?? '이동 완료 실패'}: ${err.detail}` : (err.error || '이동 완료 실패');
    throw new Error(msg);
  }
  return data as CompleteFarmScheduleExecutionMoveResult;
}

export type DirectCompleteFarmScheduleExecutionBirthBody = CompleteFarmScheduleExecutionBirthBody & {
  workPlanId: number;
  scheduledDate: string; // YYYY-MM-DD
};

export async function directCompleteFarmScheduleExecutionBirth(
  farmId: string,
  body: DirectCompleteFarmScheduleExecutionBirthBody
): Promise<CompleteFarmScheduleExecutionBirthResult> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-executions/direct-complete-birth`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string; detail?: string };
    const msg = err.detail ? `${err.error ?? '분만 바로 완료 실패'}: ${err.detail}` : (err.error || '분만 바로 완료 실패');
    throw new Error(msg);
  }
  return data as CompleteFarmScheduleExecutionBirthResult;
}

export type DirectCompleteFarmScheduleExecutionMoveBody = CompleteFarmScheduleExecutionMoveBody & {
  workPlanId: number;
  scheduledDate: string; // YYYY-MM-DD
};

export async function directCompleteFarmScheduleExecutionMove(
  farmId: string,
  body: DirectCompleteFarmScheduleExecutionMoveBody
): Promise<CompleteFarmScheduleExecutionMoveResult> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-executions/direct-complete-move`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string; detail?: string };
    const msg = err.detail ? `${err.error ?? '이동 바로 완료 실패'}: ${err.detail}` : (err.error || '이동 바로 완료 실패');
    throw new Error(msg);
  }
  return data as CompleteFarmScheduleExecutionMoveResult;
}

export type FarmPigGroupItem = {
  id: string;
  farmId: string;
  groupNo: string;
  rootGroupId?: string | null;
  currentSectionId?: string | null;
  headCount: number;
  status: string;
  createdReason: string;
  parentGroupId?: string | null;
  memo?: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getFarmPigGroups(farmId: string): Promise<FarmPigGroupItem[]> {
  return fetchApi(`/farms/${farmId}/pig-groups`);
}

export async function createFarmScheduleWorkPlanMaster(
  farmId: string,
  body: {
    structure_template_id: number | null;
    sortation_id: number | null;
    jobtype_id: number | null;
    criteria_id: number | null;
    criteria_content: CriteriaContent | null;
    work_content?: string | null;
    target_structure_template_id?: number | null;
  }
): Promise<{ id: number }> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-work-plans-master`), {
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

export async function updateFarmScheduleWorkPlanMaster(
  farmId: string,
  id: number,
  body: {
    structure_template_id?: number | null;
    sortation_id?: number | null;
    jobtype_id?: number | null;
    criteria_id?: number | null;
    criteria_content?: CriteriaContent | null;
    work_content?: string | null;
    target_structure_template_id?: number | null;
  }
): Promise<void> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-work-plans-master/${id}`), {
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

export async function deleteFarmScheduleWorkPlanMaster(farmId: string, id: number): Promise<void> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-work-plans-master/${id}`), {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '기초 일정 삭제 실패');
  }
}

export async function reorderFarmScheduleWorkPlansMaster(farmId: string, idOrder: number[]): Promise<void> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-work-plans-master/reorder`), {
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

export type FarmScheduleSortationItem = ScheduleSortationItem;
export async function getFarmScheduleSortations(farmId: string, structureTemplateId?: number): Promise<FarmScheduleSortationItem[]> {
  const q = structureTemplateId != null ? `?structure_template_id=${structureTemplateId}` : '';
  return fetchApi(`/farms/${farmId}/schedule-sortations${q}`);
}
export async function createFarmScheduleSortation(
  farmId: string,
  body: { structure_template_id: number; sortation_definition_id?: number; sortations?: unknown; sort_order?: number }
): Promise<{ id: number }> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-sortations`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '구분 추가 실패');
  return data as { id: number };
}
export async function updateFarmScheduleSortation(
  farmId: string,
  id: number,
  body: { structure_template_id?: number; sortations?: unknown; sort_order?: number }
): Promise<void> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-sortations/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '수정 실패');
}
export async function deleteFarmScheduleSortation(farmId: string, id: number): Promise<void> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-sortations/${id}`), { method: 'DELETE', credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '구분 삭제 실패');
  }
}

export type FarmScheduleSortationDefinitionItem = ScheduleSortationDefinitionItem;
export async function getFarmScheduleSortationDefinitions(farmId: string): Promise<FarmScheduleSortationDefinitionItem[]> {
  return fetchApi(`/farms/${farmId}/schedule-sortation-definitions`);
}
export async function createFarmScheduleSortationDefinition(
  farmId: string,
  body: { name: string; sort_order?: number }
): Promise<{ id: number }> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-sortation-definitions`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '구분 정의 추가 실패');
  return data as { id: number };
}
export async function updateFarmScheduleSortationDefinition(
  farmId: string,
  id: number,
  body: { name?: string; sort_order?: number }
): Promise<void> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-sortation-definitions/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '수정 실패');
}
export async function deleteFarmScheduleSortationDefinition(farmId: string, id: number): Promise<void> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-sortation-definitions/${id}`), { method: 'DELETE', credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '구분 정의 삭제 실패');
  }
}

export type FarmScheduleJobtypeItem = ScheduleJobtypeItem;
export async function getFarmScheduleJobtypes(farmId: string): Promise<FarmScheduleJobtypeItem[]> {
  return fetchApi(`/farms/${farmId}/schedule-jobtypes`);
}
export async function createFarmScheduleJobtype(
  farmId: string,
  body: { name?: string; sortation_id: number; jobtype_definition_id?: number; jobtypes?: unknown; sort_order?: number }
): Promise<{ id: number }> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-jobtypes`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '작업유형 추가 실패');
  return data as { id: number };
}
export async function updateFarmScheduleJobtype(
  farmId: string,
  id: number,
  body: { sortation_id?: number; jobtypes?: unknown; sort_order?: number }
): Promise<void> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-jobtypes/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '수정 실패');
}
export async function deleteFarmScheduleJobtype(farmId: string, id: number): Promise<void> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-jobtypes/${id}`), { method: 'DELETE', credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '작업유형 삭제 실패');
  }
}

export type FarmScheduleJobtypeDefinitionItem = ScheduleJobtypeDefinitionItem;
export async function getFarmScheduleJobtypeDefinitions(farmId: string): Promise<FarmScheduleJobtypeDefinitionItem[]> {
  return fetchApi(`/farms/${farmId}/schedule-jobtype-definitions`);
}
export async function createFarmScheduleJobtypeDefinition(
  farmId: string,
  body: { name: string; sort_order?: number }
): Promise<{ id: number }> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-jobtype-definitions`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '작업유형 정의 추가 실패');
  return data as { id: number };
}
export async function updateFarmScheduleJobtypeDefinition(
  farmId: string,
  id: number,
  body: { name?: string; sort_order?: number }
): Promise<void> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-jobtype-definitions/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '수정 실패');
}
export async function deleteFarmScheduleJobtypeDefinition(farmId: string, id: number): Promise<void> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-jobtype-definitions/${id}`), { method: 'DELETE', credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '작업유형 정의 삭제 실패');
  }
}

export type FarmScheduleCriteriaItem = ScheduleCriteriaItem;
export async function getFarmScheduleCriterias(farmId: string): Promise<FarmScheduleCriteriaItem[]> {
  return fetchApi(`/farms/${farmId}/schedule-criterias`);
}
export async function createFarmScheduleCriteria(
  farmId: string,
  body: { name?: string; jobtype_id: number; criteria_definition_id?: number; criterias?: unknown; sort_order?: number }
): Promise<{ id: number }> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-criterias`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '기준 추가 실패');
  return data as { id: number };
}
export async function updateFarmScheduleCriteria(
  farmId: string,
  id: number,
  body: { jobtype_id?: number; criterias?: unknown; sort_order?: number }
): Promise<void> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-criterias/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '수정 실패');
}
export async function deleteFarmScheduleCriteria(farmId: string, id: number): Promise<void> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-criterias/${id}`), { method: 'DELETE', credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '기준 삭제 실패');
  }
}

export type FarmScheduleCriteriaDefinitionItem = ScheduleCriteriaDefinitionItem;
export async function getFarmScheduleCriteriaDefinitions(farmId: string): Promise<FarmScheduleCriteriaDefinitionItem[]> {
  return fetchApi(`/farms/${farmId}/schedule-criteria-definitions`);
}
export async function createFarmScheduleCriteriaDefinition(
  farmId: string,
  body: { name: string; content_type: string; sort_order?: number }
): Promise<{ id: number }> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-criteria-definitions`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '기준 정의 추가 실패');
  return data as { id: number };
}
export async function updateFarmScheduleCriteriaDefinition(
  farmId: string,
  id: number,
  body: { name?: string; content_type?: string; sort_order?: number }
): Promise<void> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-criteria-definitions/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '수정 실패');
}
export async function deleteFarmScheduleCriteriaDefinition(farmId: string, id: number): Promise<void> {
  const res = await apiFetch(apiUrl(`/farms/${farmId}/schedule-criteria-definitions/${id}`), { method: 'DELETE', credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '기준 정의 삭제 실패');
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

export type FarmOpeningStatus = {
  farmId: string;
  initialized: boolean;
  farmInitializedAt?: string | null;
};

export async function getFarmOpeningStatus(farmId: string): Promise<FarmOpeningStatus> {
  return fetchApi(`/farms/${farmId}/bootstrap/opening/status`);
}

export type OpeningSowInput = {
  sowNo: string;
  status?: 'active' | 'inactive' | 'culled' | 'sold';
  parity?: number;
  birthDate?: string;
  memo?: string;
};

export type OpeningGroupInput = {
  groupNo?: string;
  headCount: number;
  status?: 'active' | 'closed' | 'merged';
  createdReason?: 'birth' | 'split' | 'manual' | 'merge';
  memo?: string;
};

export type OpeningSectionInput = {
  sectionId: string;
  sows?: OpeningSowInput[];
  groups?: OpeningGroupInput[];
};

export type OpeningPayload = {
  items: OpeningSectionInput[];
};

export type OpeningSectionSaveKind = 'breedingGestation' | 'farrowing' | 'other';

export type OpeningSectionSaveBody = {
  kind: OpeningSectionSaveKind;
  entryDate: string; // YYYY-MM-DD
  replaceExisting?: boolean;
  sows?: OpeningSowInput[];
  group?: {
    headCount: number;
    birthDate?: string; // YYYY-MM-DD
    ageDays?: number;
    status?: 'active' | 'closed' | 'merged';
    createdReason?: 'birth' | 'split' | 'manual' | 'merge';
    memo?: string;
  };
};

export type OpeningSectionSaveResult = {
  saved: boolean;
  farmId: string;
  sectionId: string;
  kind: OpeningSectionSaveKind | string;
  entryDate: string;
  sowCount: number;
  headCount: number;
  initialized: boolean;
  groupId?: string;
  groupNo?: string;
  birthDate?: string;
};

export type OpeningSectionDeleteResult = {
  deleted: boolean;
  farmId: string;
  sectionId: string;
  ledgerRowsDeleted: number;
  movementLineRowsDeleted: number;
  movementEventRowsDeleted: number;
  groupRowsDeleted: number;
  scheduleExecutionRowsDeleted: number;
  sowRowsDetached: number;
};

export type OpeningValidateResult = {
  farmId: string;
  valid: boolean;
  errors: string[];
  sections: number;
  totalSows: number;
  totalGroups: number;
  totalHeadCount: number;
};

export async function validateFarmOpening(
  farmId: string,
  body: OpeningPayload
): Promise<OpeningValidateResult> {
  return fetchApi(`/farms/${farmId}/bootstrap/opening/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export type OpeningCommitResult = {
  farmId: string;
  initialized: boolean;
  initializedAt: string;
  sections: number;
  totalSows: number;
  totalGroups: number;
  totalHeadCount: number;
};

export async function commitFarmOpening(
  farmId: string,
  body: OpeningPayload
): Promise<OpeningCommitResult> {
  return fetchApi(`/farms/${farmId}/bootstrap/opening/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function saveFarmOpeningSection(
  farmId: string,
  sectionId: string,
  body: OpeningSectionSaveBody
): Promise<OpeningSectionSaveResult> {
  return fetchApi(`/farms/${farmId}/bootstrap/opening/sections/${sectionId}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteFarmOpeningSection(
  farmId: string,
  sectionId: string
): Promise<OpeningSectionDeleteResult> {
  return fetchApi(`/farms/${farmId}/bootstrap/opening/sections/${sectionId}`, {
    method: 'DELETE',
  });
}

/** farm_structure 테이블에서 해당 농장의 production 목록 조회. templateId = structure_templates.id */
export async function getFarmStructureProduction(farmId: string): Promise<{ id: string; templateId: number; name?: string | null; weight?: string; optimalDensity?: number; description?: string }[]> {
  return fetchApi(`/farm-structure/${farmId}/production`);
}

/** 농장 사육시설(production) 저장. templateIds: 선택한 structure_templates id 배열 */
export async function saveFarmStructureProduction(farmId: string, templateIds: number[]): Promise<{ message: string }> {
  const res = await apiFetch(apiUrl(`/farm-structure/${farmId}/production`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateIds }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string; detail?: string };
    const msg = err.detail ? `${err.error || '농장 구조 저장 실패'}: ${err.detail}` : (err.error || '농장 구조 저장 실패');
    throw new Error(msg);
  }
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
  housingMode?: 'stall' | 'group' | string | null;
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

export type SectionInventoryBalanceItem = {
  farmId: string;
  sectionId: string;
  headCount: number;
  updatedAt: string;
};

export async function getFarmSectionInventoryBalances(farmId: string): Promise<SectionInventoryBalanceItem[]> {
  return fetchApi(`/farms/${farmId}/section-inventory/balances`);
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

export async function reorderFarmBarns(
  farmId: string,
  buildingId: string,
  barnIds: string[]
): Promise<{ message: string }> {
  return fetchApi(`/farm-facilities/${farmId}/buildings/${buildingId}/barns-reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barnIds }),
  });
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
  body: { name?: string; housingMode?: 'stall' | 'group' }
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

export type FarmStaffItem = {
  userFarmId: string;
  userId: string;
  username?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role: string;
  department?: string;
  position?: string;
  employmentType?: string;
  hireDate?: string;
  resignDate?: string;
  isActive: boolean;
};

export async function getFarmStaff(farmId: string): Promise<FarmStaffItem[]> {
  return fetchApi(`/farms/${farmId}/staff`);
}

export async function createFarmStaff(
  farmId: string,
  body: {
    account: {
      username: string;
      password: string;
      fullName: string;
      phone?: string;
      email?: string;
    };
    staff?: {
      role?: string;
      department?: string;
      position?: string;
      employmentType?: string;
      hireDate?: string;
    };
  }
): Promise<{ user: { id: string; username: string; fullName: string }; userFarm: { id: string } }> {
  return fetchApi(`/farms/${farmId}/staff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function linkFarmStaff(
  farmId: string,
  body: {
    userId: string;
    role?: string;
    department?: string;
    position?: string;
    employmentType?: string;
    hireDate?: string;
  }
): Promise<{ userFarm: { id: string } }> {
  return fetchApi(`/farms/${farmId}/staff/link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function updateFarmStaff(
  farmId: string,
  userFarmId: string,
  body: {
    user?: {
      fullName?: string;
      phone?: string;
      email?: string;
    };
    staff?: {
      role?: string;
      department?: string;
      position?: string;
      employmentType?: string;
      hireDate?: string;
      resignDate?: string;
    };
  }
): Promise<{ message: string }> {
  return fetchApi(`/farms/${farmId}/staff/${userFarmId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteFarmStaff(
  farmId: string,
  userFarmId: string
): Promise<{ success: boolean; message: string }> {
  return fetchApi(`/farms/${farmId}/staff/${userFarmId}`, {
    method: 'DELETE',
  });
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
