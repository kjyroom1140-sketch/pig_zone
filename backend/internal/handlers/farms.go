package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"pig-farm-api/internal/middleware"
)

// UserFarmListItem is GET /api/farms response item (includes current user's role for the farm).
type UserFarmListItem struct {
	ID             uuid.UUID `json:"id"`
	FarmName       string    `json:"farmName"`
	FarmCode       string    `json:"farmCode"`
	OwnerID        uuid.UUID `json:"ownerId"`
	OwnerName      *string   `json:"ownerName,omitempty"`      // 대표자명
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"createdAt"`
	Role           string    `json:"role"`                     // user_farms.role
	BusinessNumber *string   `json:"businessNumber,omitempty"` // 사업자번호
	FarmType       *string   `json:"farmType,omitempty"`       // 농장종류
	Address        *string   `json:"address,omitempty"`       // 농장주소
	PostalCode     *string   `json:"postalCode,omitempty"`    // 우편번호
	Country        *string   `json:"country,omitempty"`       // 국가
	AddressDetail  *string   `json:"addressDetail,omitempty"` // 상세주소
	ContactName    *string   `json:"contactName,omitempty"`    // 담당자이름
	ContactPhone   *string   `json:"contactPhone,omitempty"`   // 담당자연락처
	ContactEmail   *string   `json:"contactEmail,omitempty"`   // 담당자이메일
	Phone          *string   `json:"phone,omitempty"`          // (기존)
	Email          *string   `json:"email,omitempty"`          // (기존)
	OfficePhone    *string   `json:"officePhone,omitempty"`    // 사무실번호
	FaxNumber      *string   `json:"faxNumber,omitempty"`      // FAX번호
}

// FarmsList returns farms the current user can access, with role per farm.
func (h *Handler) FarmsList(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "로그인이 필요합니다."})
		return
	}
	userID := claims.UserID
	// 전체 컬럼 조회 시도; 실패 시(컬럼 미존재) 최소 컬럼만 조회
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT f.id, f."farmName", f."farmCode", f."ownerId", f.status, f."createdAt", uf.role,
			f."ownerName", f.phone, f.email,
			f."businessNumber", f."farmType", f.address, f."postalCode", f.country, f."addressDetail",
			f."contactName", f."contactPhone", f."contactEmail", f."officePhone", f."faxNumber"
		FROM farms f
		INNER JOIN user_farms uf ON uf."farmId" = f.id AND uf."userId" = $1 AND uf."isActive" = true
		ORDER BY f."createdAt" DESC
	`, userID)
	useMinimal := false
	if err != nil {
		rows, err = h.db.Pool.Query(r.Context(), `
			SELECT f.id, f."farmName", f."farmCode", f."ownerId", f.status, f."createdAt", uf.role
			FROM farms f
			INNER JOIN user_farms uf ON uf."farmId" = f.id AND uf."userId" = $1 AND uf."isActive" = true
			ORDER BY f."createdAt" DESC
		`, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "농장 목록을 가져오는 중 오류가 발생했습니다."})
			return
		}
		useMinimal = true
	}
	defer rows.Close()

	var list []UserFarmListItem
	for rows.Next() {
		var f UserFarmListItem
		if useMinimal {
			if err := rows.Scan(&f.ID, &f.FarmName, &f.FarmCode, &f.OwnerID, &f.Status, &f.CreatedAt, &f.Role); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "농장 목록을 가져오는 중 오류가 발생했습니다."})
				return
			}
		} else {
			var ownerName, phone, email, businessNumber, farmType, address, postalCode, country, addressDetail, contactName, contactPhone, contactEmail, officePhone, faxNumber *string
			if err := rows.Scan(&f.ID, &f.FarmName, &f.FarmCode, &f.OwnerID, &f.Status, &f.CreatedAt, &f.Role,
				&ownerName, &phone, &email,
				&businessNumber, &farmType, &address, &postalCode, &country, &addressDetail,
				&contactName, &contactPhone, &contactEmail, &officePhone, &faxNumber); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "농장 목록을 가져오는 중 오류가 발생했습니다."})
				return
			}
			f.OwnerName, f.Phone, f.Email = ownerName, phone, email
			f.BusinessNumber, f.FarmType, f.Address = businessNumber, farmType, address
			f.PostalCode, f.Country, f.AddressDetail = postalCode, country, addressDetail
			f.ContactName, f.ContactPhone, f.ContactEmail = contactName, contactPhone, contactEmail
			f.OfficePhone, f.FaxNumber = officePhone, faxNumber
		}
		list = append(list, f)
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"farms": list})
}

// FarmGetOne reads a single farm from the farms table.
// GET /api/farms/:farmId — 응답 데이터는 farms 테이블의 id, farmName, farmCode, ownerId, status, createdAt 컬럼에서 조회합니다.
func (h *Handler) FarmGetOne(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "로그인이 필요합니다."})
		return
	}
	farmIDStr := chi.URLParam(r, "farmId")
	var farmID uuid.UUID
	if err := farmID.UnmarshalText([]byte(farmIDStr)); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 농장 ID입니다."})
		return
	}
	var id uuid.UUID
	var farmName, farmCode string
	var ownerID uuid.UUID
	var status string
	var createdAt interface{}
	var ownerName, phone, email, businessNumber, farmType, address, postalCode, country, addressDetail, contactName, contactPhone, contactEmail, officePhone, faxNumber *string
	// farms 테이블에서 조회 (user_farms로 해당 사용자 접근 권한만 필터)
	err := h.db.Pool.QueryRow(r.Context(), `
		SELECT f.id, f."farmName", f."farmCode", f."ownerId", f.status, f."createdAt",
			f."ownerName", f.phone, f.email, f."businessNumber", f."farmType", f.address, f."postalCode", f.country, f."addressDetail",
			f."contactName", f."contactPhone", f."contactEmail", f."officePhone", f."faxNumber"
		FROM farms f
		INNER JOIN user_farms uf ON uf."farmId" = f.id AND uf."userId" = $1 AND uf."isActive" = true
		WHERE f.id = $2
	`, claims.UserID, farmID).Scan(&id, &farmName, &farmCode, &ownerID, &status, &createdAt,
		&ownerName, &phone, &email, &businessNumber, &farmType, &address, &postalCode, &country, &addressDetail,
		&contactName, &contactPhone, &contactEmail, &officePhone, &faxNumber)
	if err != nil {
		// system_admin / super_admin 은 user_farms 없이도 farms 테이블에서 직접 조회 허용
		if claims.SystemRole == "system_admin" || claims.SystemRole == "super_admin" {
			err = h.db.Pool.QueryRow(r.Context(), `
				SELECT id, "farmName", "farmCode", "ownerId", status, "createdAt",
					"ownerName", phone, email, "businessNumber", "farmType", address, "postalCode", country, "addressDetail",
					"contactName", "contactPhone", "contactEmail", "officePhone", "faxNumber"
				FROM farms
				WHERE id = $1
			`, farmID).Scan(&id, &farmName, &farmCode, &ownerID, &status, &createdAt,
				&ownerName, &phone, &email, &businessNumber, &farmType, &address, &postalCode, &country, &addressDetail,
				&contactName, &contactPhone, &contactEmail, &officePhone, &faxNumber)
		}
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "농장을 찾을 수 없습니다."})
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"farm": map[string]interface{}{
			"id": id.String(), "farmName": farmName, "farmCode": farmCode,
			"ownerId": ownerID.String(), "status": status, "createdAt": createdAt,
			"ownerName": ownerName, "phone": phone, "email": email,
			"businessNumber": businessNumber, "farmType": farmType, "address": address,
			"postalCode": postalCode, "country": country, "addressDetail": addressDetail,
			"contactName": contactName, "contactPhone": contactPhone, "contactEmail": contactEmail,
			"officePhone": officePhone, "faxNumber": faxNumber,
		},
	})
}

// FarmUpdateRequest for PUT /api/farms/:farmId (농장 정보 수정).
type FarmUpdateRequest struct {
	FarmCode       *string `json:"farmCode"`
	FarmName       *string `json:"farmName"`
	OwnerName      *string `json:"ownerName"`
	BusinessNumber *string `json:"businessNumber"`
	FarmType       *string `json:"farmType"`
	Address        *string `json:"address"`
	PostalCode     *string `json:"postalCode"`
	Country        *string `json:"country"`
	AddressDetail  *string `json:"addressDetail"`
	ContactName    *string `json:"contactName"`
	ContactPhone   *string `json:"contactPhone"`
	ContactEmail   *string `json:"contactEmail"`
	Phone          *string `json:"phone"`
	Email          *string `json:"email"`
	OfficePhone    *string `json:"officePhone"`
	FaxNumber      *string `json:"faxNumber"`
}

// FarmUpdate handles PUT /api/farms/:farmId.
func (h *Handler) FarmUpdate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "로그인이 필요합니다."})
		return
	}
	farmIDStr := chi.URLParam(r, "farmId")
	var farmID uuid.UUID
	if err := farmID.UnmarshalText([]byte(farmIDStr)); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 농장 ID입니다."})
		return
	}
	var req FarmUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "요청 본문이 올바르지 않습니다."})
		return
	}
	ctx := r.Context()
	// 권한: user_farms 있거나 system_admin/super_admin
	canEdit := claims.SystemRole == "system_admin" || claims.SystemRole == "super_admin"
	if !canEdit {
		var ok bool
		_ = h.db.Pool.QueryRow(ctx, `SELECT true FROM user_farms WHERE "farmId" = $1 AND "userId" = $2 AND "isActive" = true`, farmID, claims.UserID).Scan(&ok)
		canEdit = ok
	}
	if !canEdit {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "이 농장을 수정할 권한이 없습니다."})
		return
	}
	_, err := h.db.Pool.Exec(ctx, `
		UPDATE farms SET
			"farmCode" = COALESCE($1, "farmCode"),
			"farmName" = COALESCE($2, "farmName"),
			"ownerName" = COALESCE($3, "ownerName"),
			"businessNumber" = COALESCE($4, "businessNumber"),
			"farmType" = COALESCE($5, "farmType"),
			address = COALESCE($6, address),
			"postalCode" = COALESCE($7, "postalCode"),
			country = COALESCE($8, country),
			"addressDetail" = COALESCE($9, "addressDetail"),
			"contactName" = COALESCE($10, "contactName"),
			"contactPhone" = COALESCE($11, "contactPhone"),
			"contactEmail" = COALESCE($12, "contactEmail"),
			phone = COALESCE($13, phone),
			email = COALESCE($14, email),
			"officePhone" = COALESCE($15, "officePhone"),
			"faxNumber" = COALESCE($16, "faxNumber"),
			"updatedAt" = NOW()
		WHERE id = $17
	`, ptrStr(req.FarmCode), ptrStr(req.FarmName), ptrStr(req.OwnerName), ptrStr(req.BusinessNumber), ptrStr(req.FarmType), ptrStr(req.Address),
		ptrStr(req.PostalCode), ptrStr(req.Country), ptrStr(req.AddressDetail),
		ptrStr(req.ContactName), ptrStr(req.ContactPhone), ptrStr(req.ContactEmail), ptrStr(req.Phone), ptrStr(req.Email), ptrStr(req.OfficePhone), ptrStr(req.FaxNumber), farmID)
	if err != nil {
		// 확장 컬럼이 없을 수 있음: 최소 컬럼만 업데이트 (farmCode, farmName은 보통 존재)
		_, err = h.db.Pool.Exec(ctx, `
			UPDATE farms SET
				"farmCode" = COALESCE($1, "farmCode"),
				"farmName" = COALESCE($2, "farmName"),
				"updatedAt" = NOW()
			WHERE id = $3
		`, ptrStr(req.FarmCode), ptrStr(req.FarmName), farmID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "농장 정보 수정 중 오류가 발생했습니다."})
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "저장되었습니다."})
}

func ptrStr(p *string) interface{} {
	if p == nil {
		return nil
	}
	return *p
}

// FarmCreateRequest for POST /api/farms.
type FarmCreateRequest struct {
	FarmName  string  `json:"farmName"`
	FarmCode  string  `json:"farmCode"`
	OwnerName *string `json:"ownerName"`
	Phone     *string `json:"phone"`
	Email     *string `json:"email"`
}

// FarmsCreate handles POST /api/farms (create farm + UserFarm for owner).
func (h *Handler) FarmsCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "로그인이 필요합니다."})
		return
	}
	var req FarmCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "농장명과 농장 코드는 필수 입력 항목입니다."})
		return
	}
	if req.FarmName == "" || req.FarmCode == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "농장명과 농장 코드는 필수 입력 항목입니다."})
		return
	}
	ctx := r.Context()
	var exists int
	err := h.db.Pool.QueryRow(ctx, `SELECT 1 FROM farms WHERE "farmCode" = $1`, req.FarmCode).Scan(&exists)
	if err == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "이미 사용 중인 농장 코드입니다."})
		return
	}
	farmID := uuid.New()
	ownerID := claims.UserID
	_, err = h.db.Pool.Exec(ctx, `
		INSERT INTO farms (id, "farmName", "farmCode", "ownerName", phone, email, "ownerId", status, "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', NOW(), NOW())
	`, farmID, req.FarmName, req.FarmCode, req.OwnerName, req.Phone, req.Email, ownerID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "농장 등록 중 오류가 발생했습니다."})
		return
	}
	ufID := uuid.New()
	_, err = h.db.Pool.Exec(ctx, `
		INSERT INTO user_farms (id, "userId", "farmId", role, "isActive", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, 'farm_admin', true, NOW(), NOW())
	`, ufID, ownerID, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "농장 등록 중 오류가 발생했습니다."})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "농장이 등록되었습니다.",
		"farm":    map[string]interface{}{"id": farmID.String(), "farmName": req.FarmName, "farmCode": req.FarmCode},
	})
}
