$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$targetScript = Join-Path $repoRoot "scripts\start-atramentum-dev.cmd"
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "Manuscript Dev.lnk"

if (-not (Test-Path $targetScript)) {
  throw "Launcher script not found: $targetScript"
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetScript
$shortcut.WorkingDirectory = $repoRoot
$shortcut.IconLocation = "$env:SystemRoot\System32\SHELL32.dll,220"
$shortcut.Description = "Start Manuscript desktop writing app in development mode"
$shortcut.Save()

Write-Output "Created desktop shortcut: $shortcutPath"
