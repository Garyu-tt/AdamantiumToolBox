$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$task='AdamantiumToolboxServer'
$node=(Get-Command node.exe -ErrorAction Stop).Source
$action=New-ScheduledTaskAction -Execute $node -Argument ('"'+(Join-Path $root 'core\background.mjs')+'"') -WorkingDirectory $root
$identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal=New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings=New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Seconds 0)
Register-ScheduledTask -TaskName $task -Action $action -Principal $principal -Settings $settings -Force|Out-Null
Start-ScheduledTask -TaskName $task
Write-Output ('TASK='+$task)
