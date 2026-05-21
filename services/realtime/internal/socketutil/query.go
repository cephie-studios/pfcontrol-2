package socketutil

import socketio "github.com/zishang520/socket.io/servers/socket/v3"

func Query(client *socketio.Socket, key string) string {
	q := client.Request().Query()
	if q == nil {
		return ""
	}
	if v, ok := q.Get(key); ok {
		return v
	}
	return ""
}
