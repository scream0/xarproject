$files = @(
    "backend/internal/controllers/chat.go",
    "backend/internal/controllers/cron.go",
    "backend/internal/controllers/notifications.go",
    "backend/internal/controllers/order.go",
    "backend/internal/controllers/product.go",
    "backend/internal/controllers/reviews.go",
    "backend/internal/controllers/user.go",
    "backend/internal/controllers/vouchers.go",
    "backend/internal/controllers/wallet.go"
)
foreach ($file in $files) {
    $lines = Get-Content $file
    $out = @()
    $inLoop = $false
    $loopIndent = ""
    $loopVar = ""
    $braceCount = 0

    foreach ($line in $lines) {
        $out += $line
        
        if ($line -match "^(\s*)for (\w+)\.Next\(\) \{") {
            $inLoop = $true
            $loopIndent = $matches[1]
            $loopVar = $matches[2]
            $braceCount = 1
            continue
        }
        
        if ($inLoop) {
            if ($line -match "\{") {
                $braceCount += ($line.ToCharArray() | Where-Object {$_ -eq '{'}).Count
            }
            if ($line -match "\}") {
                $braceCount -= ($line.ToCharArray() | Where-Object {$_ -eq '}'}).Count
            }
            
            if ($braceCount -eq 0) {
                $inLoop = $false
                $out += "$loopIndent`if err := $($loopVar).Err(); err != nil {"
                $out += "$loopIndent`tfmt.Println(`"Rows error:`", err)"
                $out += "$loopIndent`}"
            }
        }
    }
    Set-Content $file -Value ($out -join "`n")
    Write-Host "Processed $file"
}
