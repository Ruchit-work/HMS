# Test Appointment Reminders Locally
# Usage: .\test-reminders.ps1 [debug|dryrun|force|send]

param(
    [Parameter(Position=0)]
    [ValidateSet("debug", "dryrun", "force", "send")]
    [string]$Mode = "debug"
)

$baseUrl = "http://localhost:3000/api/notifications/appointment-reminders"
$url = $null

switch ($Mode) {
    "debug" {
        $url = "$baseUrl?debug=1&dryRun=1"
        Write-Host "🔍 Testing in DEBUG mode (dry run - no messages sent)" -ForegroundColor Cyan
    }
    "dryrun" {
        $url = "$baseUrl?debug=1&dryRun=1"
        Write-Host "🧪 Testing in DRY RUN mode (no messages sent)" -ForegroundColor Yellow
    }
    "force" {
        $url = "$baseUrl?debug=1&force=1"
        Write-Host "⚡ Testing in FORCE mode (will send even if already sent)" -ForegroundColor Magenta
    }
    "send" {
        $url = "$baseUrl?debug=1"
        Write-Host "📤 SENDING REAL REMINDERS (WhatsApp messages will be sent!)" -ForegroundColor Red
        $confirm = Read-Host "Are you sure you want to send real WhatsApp messages? (yes/no)"
        if ($confirm -ne "yes") {
            Write-Host "❌ Cancelled" -ForegroundColor Red
            exit
        }
    }
}

Write-Host "`n📡 Calling: $url" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri $url -Method GET -ErrorAction Stop
    $json = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host "`nResponse:" -ForegroundColor White
    $json | ConvertTo-Json -Depth 10 | Write-Host
    
    Write-Host "`n📊 Summary:" -ForegroundColor Cyan
    Write-Host "  Date: $($json.dateKey)" -ForegroundColor White
    Write-Host "  Timezone: $($json.timeZone)" -ForegroundColor White
    Write-Host "  Found: $($json.found) appointments" -ForegroundColor White
    Write-Host "  Processed: $($json.processed)" -ForegroundColor White
    Write-Host "  Sent: $($json.sent)" -ForegroundColor Green
    Write-Host "  Skipped: $($json.skipped)" -ForegroundColor Yellow
    Write-Host "  Failed: $($json.failed)" -ForegroundColor Red
    
    if ($json.message) {
        Write-Host "`n💬 Message: $($json.message)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host "`n✨ Done!" -ForegroundColor Green

