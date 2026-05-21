package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
)

type EncryptedBlob struct {
	IV      string `json:"iv"`
	Data    string `json:"data"`
	AuthTag string `json:"authTag"`
}

func DecryptATIS(key128 string, encrypted EncryptedBlob) (interface{}, error) {
	if encrypted.IV == "" || encrypted.Data == "" || encrypted.AuthTag == "" {
		return nil, errors.New("invalid encrypted payload")
	}
	key := []byte(key128)[:32]
	iv, err := hex.DecodeString(encrypted.IV)
	if err != nil {
		return nil, err
	}
	data, err := hex.DecodeString(encrypted.Data)
	if err != nil {
		return nil, err
	}
	tag, err := hex.DecodeString(encrypted.AuthTag)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCMWithNonceSize(block, len(iv))
	if err != nil {
		return nil, err
	}
	if len(iv) != gcm.NonceSize() {
		return nil, errors.New("invalid IV length")
	}
	plain, err := gcm.Open(nil, iv, append(data, tag...), nil)
	if err != nil {
		return nil, err
	}
	var parsed interface{}
	if err := json.Unmarshal(plain, &parsed); err != nil {
		return string(plain), nil
	}
	return parsed, nil
}

func EncryptATIS(key128 string, text interface{}) (*EncryptedBlob, error) {
	key := []byte(key128)[:32]
	raw, err := json.Marshal(text)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	// Match server/utils/encryption.ts (Node crypto.randomBytes(16)).
	const nonceSize = 16
	gcm, err := cipher.NewGCMWithNonceSize(block, nonceSize)
	if err != nil {
		return nil, err
	}
	iv := make([]byte, nonceSize)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, err
	}
	sealed := gcm.Seal(nil, iv, raw, nil)
	tagLen := gcm.Overhead()
	ciphertext := sealed[:len(sealed)-tagLen]
	tag := sealed[len(sealed)-tagLen:]
	return &EncryptedBlob{
		IV:      hex.EncodeToString(iv),
		Data:    hex.EncodeToString(ciphertext),
		AuthTag: hex.EncodeToString(tag),
	}, nil
}
