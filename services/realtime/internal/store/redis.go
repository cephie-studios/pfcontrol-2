package store

import (
	"context"

	"github.com/redis/go-redis/v9"
)

func NewRedis(url string) (*redis.Client, error) {
	opt, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	client := redis.NewClient(opt)
	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, err
	}
	return client, nil
}

func ScanActiveSessionIDs(ctx context.Context, rdb *redis.Client) ([]string, error) {
	var cursor uint64
	var ids []string
	for {
		keys, next, err := rdb.Scan(ctx, cursor, "activeUsers:*", 100).Result()
		if err != nil {
			return nil, err
		}
		for _, key := range keys {
			n, err := rdb.HLen(ctx, key).Result()
			if err != nil || n == 0 {
				continue
			}
			sid := key[len("activeUsers:"):]
			if sid != "" {
				ids = append(ids, sid)
			}
		}
		cursor = next
		if cursor == 0 {
			break
		}
	}
	return ids, nil
}
