package auth

import (
	"context"
	"strings"

	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/store"
	"github.com/golang-jwt/jwt/v5"
	socketio "github.com/zishang520/socket.io/servers/socket/v3"
)

func UserIDFromHandshake(client *socketio.Socket, jwtSecret string) string {
	if jwtSecret == "" {
		return ""
	}
	headers := client.Request().Headers()
	if headers == nil {
		return ""
	}
	cookie, ok := headers.Get("Cookie")
	if !ok {
		cookie, ok = headers.Get("cookie")
	}
	if !ok || cookie == "" {
		return ""
	}
	for _, part := range strings.Split(cookie, ";") {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, "auth_token=") {
			token := strings.TrimPrefix(part, "auth_token=")
			claims := jwt.MapClaims{}
			parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (interface{}, error) {
				return []byte(jwtSecret), nil
			})
			if err != nil || !parsed.Valid {
				return ""
			}
			if uid, ok := claims["userId"].(string); ok {
				return uid
			}
		}
	}
	return ""
}

func IsEventController(ctx context.Context, db *store.Store, userID string) bool {
	var count int
	err := db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM user_roles ur
		INNER JOIN roles r ON r.id = ur.role_id
		WHERE ur.user_id = $1 AND r.name = 'Event Controller'
	`, userID).Scan(&count)
	return err == nil && count > 0
}
