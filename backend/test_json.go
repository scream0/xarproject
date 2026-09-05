//go:build ignore

package main
import (
	"encoding/json"
	"fmt"
)
type Payload struct {
	ActiveCouriers json.RawMessage `json:"activeCouriers"`
}
func main() {
	var req Payload
	req.ActiveCouriers = json.RawMessage("")
	b, err := json.Marshal(req.ActiveCouriers)
	fmt.Printf("marshaled: '%s', error: %v\n", string(b), err)
}
