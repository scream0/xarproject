//go:build ignore

package main
import ("bytes"; "fmt"; "net/http"; "io/ioutil"; "xar-backend-go/internal/config"; "github.com/joho/godotenv")
func main() {
    godotenv.Load("../../../.env.local")
    req, _ := http.NewRequest("POST", "http://127.0.0.1:8080/api/admin/vouchers", bytes.NewBuffer([]byte(`{"code":"C1","title":"T1","discount_amount":10,"valid_until":null}`)))
    req.Header.Set("Content-Type", "application/json")
    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil { fmt.Println("err", err); return }
    body, _ := ioutil.ReadAll(resp.Body)
    fmt.Println(resp.StatusCode, string(body))
}
