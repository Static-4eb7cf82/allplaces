FROM golang:1.26-alpine AS build
WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /allplaces-api ./cmd/server

FROM gcr.io/distroless/static-debian12
COPY --from=build /allplaces-api /allplaces-api
EXPOSE 8081
ENTRYPOINT ["/allplaces-api"]
