package crypto

import (
	"encoding/hex"
	"testing"
)

func TestDecryptATIS_NodeStyle16ByteIV(t *testing.T) {
	// Ciphertext produced by tmp-test-gcm-iv.mjs (Node encrypt with 16-byte IV)
	blob := EncryptedBlob{
		IV:      "000102030405060708090a0b0c0d0e0f",
		Data:    "5a8e8f4d08068665b8bb",
		AuthTag: "58b0c1d3fb203995430fc9f6577b48cb",
	}
	key128 := repeat('a', 128)
	got, err := DecryptATIS(key128, blob)
	if err != nil {
		t.Fatal(err)
	}
	m, ok := got.(map[string]interface{})
	if !ok || m["test"] != float64(1) {
		t.Fatalf("unexpected %v (%T)", got, got)
	}
}

func repeat(b byte, n int) string {
	out := make([]byte, n)
	for i := range out {
		out[i] = b
	}
	return string(out)
}

// Round-trip with 16-byte IV like Node.
func TestEncryptDecryptATIS_16ByteIV(t *testing.T) {
	key128 := repeat('a', 128)
	enc, err := EncryptATIS(key128, map[string]int{"test": 1})
	if err != nil {
		t.Fatal(err)
	}
	iv, _ := hex.DecodeString(enc.IV)
	if len(iv) != 16 {
		t.Fatalf("iv len %d want 16", len(iv))
	}
	got, err := DecryptATIS(key128, *enc)
	if err != nil {
		t.Fatal(err)
	}
	if got == nil {
		t.Fatal("nil")
	}
}
