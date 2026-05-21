package sanitize

import (
	"regexp"
	"strings"
)

var scriptRe = regexp.MustCompile(`(?i)javascript:`)
var onEventRe = regexp.MustCompile(`(?i)on\w+\s*=`)

func String(input string, maxLen int) string {
	if input == "" {
		return ""
	}
	s := strings.ReplaceAll(input, "<", "")
	s = strings.ReplaceAll(s, ">", "")
	s = scriptRe.ReplaceAllString(s, "")
	s = onEventRe.ReplaceAllString(s, "")
	s = strings.TrimSpace(s)
	if maxLen > 0 && len(s) > maxLen {
		s = s[:maxLen]
	}
	return s
}

func Callsign(c string) string {
	if c == "" {
		return ""
	}
	var b strings.Builder
	for _, r := range c {
		if (r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			b.WriteRune(r)
		}
	}
	s := b.String()
	if len(s) > 16 {
		s = s[:16]
	}
	return s
}

func Squawk(s string) string {
	if s == "" {
		return ""
	}
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '7' {
			b.WriteRune(r)
		}
	}
	out := b.String()
	if len(out) > 4 {
		out = out[:4]
	}
	return out
}

func FlightLevel(fl string) string {
	if fl == "" {
		return ""
	}
	var b strings.Builder
	for _, r := range fl {
		if (r >= '0' && r <= '9') || (r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') {
			b.WriteRune(r)
		}
	}
	s := strings.ToUpper(b.String())
	if len(s) > 8 {
		s = s[:8]
	}
	return s
}

func Runway(r string) string {
	if r == "" {
		return ""
	}
	var b strings.Builder
	for _, r := range r {
		if (r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	s := strings.ToUpper(b.String())
	if len(s) > 10 {
		s = s[:10]
	}
	return s
}
