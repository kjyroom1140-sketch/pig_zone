package config

import (
	"os"
)

// Load loads configuration from environment (use .env via godotenv in main if needed).
type Config struct {
	Port         string
	DBHost       string
	DBPort       string
	DBName       string
	DBUser       string
	DBPassword   string
	JWTSecret    string
	CORSOrigins  string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		DBHost:      getEnv("POSTGRES_HOST", "localhost"),
		DBPort:      getEnv("POSTGRES_PORT", "5432"),
		DBName:      getEnv("POSTGRES_DB", "pig_farm_db"),
		DBUser:      getEnv("POSTGRES_USER", "postgres"),
		DBPassword:  getEnv("POSTGRES_PASSWORD", "postgres"),
		JWTSecret:   getEnv("JWT_SECRET", "your-jwt-secret-change-in-production"),
		CORSOrigins: getEnv("CORS_ORIGINS", "http://localhost:3000,https://localhost:3000"),
	}
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
