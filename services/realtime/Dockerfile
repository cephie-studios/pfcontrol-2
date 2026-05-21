FROM golang:1.22-bookworm AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /pfcontrol-realtime ./cmd/pfcontrol-realtime

FROM gcr.io/distroless/static-debian12
COPY --from=builder /pfcontrol-realtime /pfcontrol-realtime
EXPOSE 8080
ENTRYPOINT ["/pfcontrol-realtime"]
