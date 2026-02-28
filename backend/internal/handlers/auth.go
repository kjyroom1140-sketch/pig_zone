package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"pig-farm-api/internal/config"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

func isNoRows(err error) bool { return errors.Is(err, pgx.ErrNoRows) }

// LoginRequest matches existing Express API.
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginResponse matches existing Express API response.
type LoginResponse struct {
	Message string `json:"message"`
	User    User   `json:"user"`
	Token   string `json:"token,omitempty"` // 클라이언트가 Authorization 헤더로 보낼 수 있음(크로스 오리진 시 쿠키 미전송 대비)
}

// Claims for JWT.
type Claims struct {
	UserID     string `json:"userId"`
	Username   string `json:"username"`
	FullName   string `json:"fullName"`
	SystemRole string `json:"systemRole"`
	jwt.RegisteredClaims
}

const tokenExpiry = 24 * time.Hour

// Login handles POST /api/auth/login.
func (h *Handler) Login(cfg *config.Config, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	if req.Username == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "사용자명과 비밀번호를 입력해주세요."})
		return
	}

	row, err := h.UserByUsername(r.Context(), req.Username)
	if err != nil {
		if isNoRows(err) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "사용자명 또는 비밀번호가 올바르지 않습니다."})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "로그인 중 오류가 발생했습니다."})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(row.Password), []byte(req.Password)); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "사용자명 또는 비밀번호가 올바르지 않습니다."})
		return
	}
	if !row.IsActive {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "비활성화된 계정입니다. 관리자에게 문의하세요."})
		return
	}

	_ = h.UpdateLastLogin(r.Context(), row.ID)

	claims := Claims{
		UserID:     row.ID.String(),
		Username:   row.Username,
		FullName:   row.FullName,
		SystemRole: row.SystemRole,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(tokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "로그인 중 오류가 발생했습니다."})
		return
	}

	// Set HTTP-only cookie (동일 오리진일 때 사용)
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    tokenString,
		Path:     "/",
		MaxAge:   86400, // 24h
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	user := userFromRow(*row)
	writeJSON(w, http.StatusOK, LoginResponse{Message: "로그인 성공", User: user, Token: tokenString})
}

// Logout handles POST /api/auth/logout.
func Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	})
	writeJSON(w, http.StatusOK, map[string]string{"message": "로그아웃되었습니다."})
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
