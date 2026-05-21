package store

import "time"

// flightRecencySince returns ISO text (for flight_plan_time column) and UTC time for timestamp columns.
func flightRecencySince(hoursBack int) (sinceIso string, sinceTime time.Time) {
	sinceTime = time.Now().UTC().Add(-time.Duration(hoursBack) * time.Hour)
	sinceIso = sinceTime.Format(time.RFC3339)
	return sinceIso, sinceTime
}
