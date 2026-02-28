package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
)

// AdminSettings handles GET /api/admin/settings.
func (h *Handler) AdminSettings(w http.ResponseWriter, r *http.Request) {
	settings := map[string]interface{}{
		"systemName": "양돈농장 관리 시스템",
		"version":    "1.0.0",
		"database":   os.Getenv("POSTGRES_DB"),
		"environment": os.Getenv("NODE_ENV"),
	}
	if settings["database"] == "" {
		settings["database"] = "pig_farm_db"
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"settings": settings})
}

// ConnectionInfo for GET/PUT /api/admin/settings/connection.
type ConnectionInfo struct {
	ServerURL      string `json:"serverUrl"`
	ServerUser     string `json:"serverUser"`
	ServerPassword string `json:"serverPassword"`
	DBHost         string `json:"dbHost"`
	DBPort         string `json:"dbPort"`
	DBName         string `json:"dbName"`
	DBUser         string `json:"dbUser"`
	DBPassword     string `json:"dbPassword"`
	HasOverride    bool   `json:"hasOverride"`
}

func getEnvDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// AdminSettingsConnection handles GET /api/admin/settings/connection.
func (h *Handler) AdminSettingsConnection(w http.ResponseWriter, r *http.Request) {
	info := loadConnectionInfo()
	writeJSON(w, http.StatusOK, map[string]interface{}{"connection": info})
}

// AdminSettingsConnectionPut handles PUT /api/admin/settings/connection.
func (h *Handler) AdminSettingsConnectionPut(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}
	var body ConnectionInfo
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	if err := saveConnectionOverride(&body); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "연결 설정 저장 중 오류가 발생했습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "저장되었습니다. 서버를 재시작하면 새 연결 설정이 적용됩니다.",
	})
}

const overrideFilename = "connection-override.json"

// configOverridePath returns path to connection-override.json (same as Node config/connection-override.json).
func configOverridePath() string {
	base := os.Getenv("CONFIG_DIR") // project root when set
	if base == "" {
		base = "."
	}
	return filepath.Join(base, "config", overrideFilename)
}

func loadConnectionInfo() ConnectionInfo {
	current := loadOverrideFile()
	mask := "(설정됨)"
	portStr := "5432"
	if current.DBPort > 0 {
		portStr = fmt.Sprintf("%d", current.DBPort)
	}
	info := ConnectionInfo{
		ServerURL:      getEnvDefault("SERVER_URL", getEnvDefault("BASE_URL", current.ServerURL)),
		ServerUser:     getEnvDefault("SERVER_USER", current.ServerUser),
		DBHost:         getEnvDefault("POSTGRES_HOST", current.DBHost),
		DBPort:         getEnvDefault("POSTGRES_PORT", portStr),
		DBName:         getEnvDefault("POSTGRES_DB", current.DBName),
		DBUser:         getEnvDefault("POSTGRES_USER", current.DBUser),
		HasOverride:    current.HasOverride,
	}
	if info.ServerURL == "" {
		info.ServerURL = "(미설정)"
	}
	if info.ServerUser == "" {
		info.ServerUser = "(미설정)"
	}
	if info.DBHost == "" {
		info.DBHost = "localhost"
	}
	if info.DBPort == "" {
		info.DBPort = "5432"
	}
	if info.DBName == "" {
		info.DBName = "pig_farm_db"
	}
	if info.DBUser == "" {
		info.DBUser = "postgres"
	}
	if current.ServerPassword != "" || os.Getenv("SERVER_PASSWORD") != "" {
		info.ServerPassword = mask
	}
	if current.DBPassword != "" || os.Getenv("POSTGRES_PASSWORD") != "" {
		info.DBPassword = mask
	}
	return info
}

type overrideFile struct {
	ServerURL      string `json:"serverUrl"`
	ServerUser     string `json:"serverUser"`
	ServerPassword string `json:"serverPassword"`
	DBHost         string `json:"dbHost"`
	DBPort         int    `json:"dbPort"`
	DBName         string `json:"dbName"`
	DBUser         string `json:"dbUser"`
	DBPassword     string `json:"dbPassword"`
	HasOverride    bool   `json:"hasOverride"`
}

func loadOverrideFile() overrideFile {
	path := configOverridePath()
	data, err := os.ReadFile(path)
	if err != nil {
		return overrideFile{}
	}
	var o overrideFile
	_ = json.Unmarshal(data, &o)
	o.HasOverride = true
	return o
}

func saveConnectionOverride(body *ConnectionInfo) error {
	current := loadOverrideFile()
	next := overrideFile{
		ServerURL:   body.ServerURL,
		ServerUser:  body.ServerUser,
		DBHost:      body.DBHost,
		DBPort:      5432,
		DBName:      body.DBName,
		DBUser:      body.DBUser,
		HasOverride: true,
	}
	if body.DBPort != "" {
		var p int
		if _, err := fmt.Sscanf(body.DBPort, "%d", &p); err == nil {
			next.DBPort = p
		}
	}
	if body.ServerPassword != "" && body.ServerPassword != "(설정됨)" {
		next.ServerPassword = body.ServerPassword
	} else if current.ServerPassword != "" {
		next.ServerPassword = current.ServerPassword
	}
	if body.DBPassword != "" && body.DBPassword != "(설정됨)" {
		next.DBPassword = body.DBPassword
	} else if current.DBPassword != "" {
		next.DBPassword = current.DBPassword
	}
	path := configOverridePath()
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(next, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0600)
}
