package dto

// OverviewData matches the frontend OverviewData type.
type OverviewData struct {
	ActiveSessions       []OverviewSession          `json:"activeSessions"`
	TotalActiveSessions  int                        `json:"totalActiveSessions"`
	TotalFlights         int                        `json:"totalFlights"`
	ArrivalsByAirport    map[string][]OverviewFlight `json:"arrivalsByAirport"`
	LastUpdated          string                     `json:"lastUpdated"`
}

type OverviewSession struct {
	SessionID       string              `json:"sessionId"`
	AirportIcao     string              `json:"airportIcao"`
	ActiveRunway    *string             `json:"activeRunway,omitempty"`
	CreatedAt       string              `json:"createdAt"`
	CreatedBy       string              `json:"createdBy"`
	IsPFATC         bool                `json:"isPFATC"`
	IsAdvancedATC   bool                `json:"isAdvancedATC"`
	ActiveUsers     int                 `json:"activeUsers"`
	Controllers     []ControllerBadge   `json:"controllers"`
	Atis            interface{}         `json:"atis"`
	Flights         []OverviewFlight    `json:"flights"`
	FlightCount     int                 `json:"flightCount"`
}

type ControllerBadge struct {
	Username          string  `json:"username"`
	Role              string  `json:"role"`
	Avatar            *string `json:"avatar,omitempty"`
	HasVatsimRating   bool    `json:"hasVatsimRating"`
	IsEventController bool    `json:"isEventController"`
}

type OverviewFlight map[string]interface{}

type ClientFlight map[string]interface{}

type SessionUser struct {
	ID        string      `json:"id"`
	Username  string      `json:"username"`
	Avatar    *string     `json:"avatar"`
	JoinedAt  int64       `json:"joinedAt"`
	Position  string      `json:"position"`
	Roles     []UserRole  `json:"roles"`
}

type UserRole struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Color    string `json:"color"`
	Icon     string `json:"icon"`
	Priority int    `json:"priority"`
}

type SectorController struct {
	ID        string     `json:"id"`
	Username  string     `json:"username"`
	Avatar    *string    `json:"avatar"`
	Station   string     `json:"station"`
	JoinedAt  int64      `json:"joinedAt"`
	Roles     []UserRole `json:"roles"`
}
