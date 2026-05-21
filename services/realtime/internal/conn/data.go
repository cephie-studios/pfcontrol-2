package conn

// SocketData is stored on each socket via SetData.
type SocketData struct {
	SessionID         string
	Role              string
	NetworkKind       string
	IsEventController bool
	AirportIcao       string
}

func Get(socketData any) *SocketData {
	if socketData == nil {
		return &SocketData{}
	}
	if d, ok := socketData.(*SocketData); ok {
		return d
	}
	return &SocketData{}
}
