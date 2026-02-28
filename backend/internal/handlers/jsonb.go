// Package handlers: JSONB 읽기 규칙 (PostgreSQL + pgx v5)
//
// DB 환경에 맞는 API용 JSONB 읽기 규칙:
//   - PostgreSQL JSONB 컬럼을 API 응답(interface{})으로 쓸 때는 SELECT 시 "컬럼::text" 로 조회하고,
//     스캔은 *string 으로 받은 뒤 ParseJSONBFromText 로 파싱한다.
//   - pgx v5 에서 JSONB → *[]byte 스캔은 환경에 따라 실패할 수 있어, ::text + *string 방식으로 통일한다.
//
// 쓰기(INSERT/UPDATE): JSONB 컬럼에는 []byte(JSON 문자열) 로 전달하면 된다.
package handlers

import "encoding/json"

// ParseJSONBFromText 는 SELECT 시 jsonb_col::text 로 조회해 *string 으로 스캔한 값을
// API 응답용 interface{} 로 파싱한다. nil/빈 문자열이면 nil 반환.
func ParseJSONBFromText(s *string) interface{} {
	if s == nil || *s == "" {
		return nil
	}
	var v interface{}
	_ = json.Unmarshal([]byte(*s), &v)
	return v
}

// ParseJSONBFromBytes 는 이미 []byte 로 읽은 JSONB 값을 API 응답용 interface{} 로 파싱한다.
// (일부 쿼리에서 JSONB를 *[]byte 로 스캔하는 경우에만 사용.)
func ParseJSONBFromBytes(b *[]byte) interface{} {
	if b == nil || len(*b) == 0 {
		return nil
	}
	var v interface{}
	_ = json.Unmarshal(*b, &v)
	return v
}
