param(
 [Parameter(Mandatory=$true)][string]$ConfigPath,
 [Parameter(Mandatory=$true)][string]$GuardianPath,
 [Parameter(Mandatory=$true)][string]$TaskName,
 [switch]$Approve,
 [switch]$Remove,
 [switch]$Active
)
$ErrorActionPreference='Stop'
if($TaskName -notmatch '^[A-Za-z][A-Za-z0-9_ .-]{1,79}$'){
 throw 'Invalid Scheduled Task name'
}
foreach($path in @($ConfigPath,$GuardianPath)){
 if(!$path -or ![IO.Path]::IsPathRooted($path) -or
  !(Test-Path -LiteralPath $path -PathType Leaf) -or $path.Contains('"')){
  throw 'Both private config and guardian source must be absolute local files'
 }
}
if([IO.Path]::GetExtension($GuardianPath) -ne '.ps1'){throw 'Guardian must be PowerShell'}
$c=Get-Content -LiteralPath $ConfigPath -Raw|ConvertFrom-Json
if($c.schema -ne 'mas-session-companion-1'){throw 'Invalid private profile'}
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
$exe=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$mode=if($Active){'-Run'}else{'-Monitor'}
$expected='-NoProfile -WindowStyle Hidden -File "'+$GuardianPath+'" -ConfigPath "'+$ConfigPath+'" '+$mode
$existing=Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
$operation=if($Remove){'remove'}else{'install'}
if(!$Approve){
 [pscustomobject]@{operation=$operation;taskName=$TaskName;
  currentUser=$identity.Name;alreadyExists=($null -ne $existing);
  approved=$false;changesMade=$false;mode=$mode}|ConvertTo-Json -Compress
 exit 0
}
if([Diagnostics.Process]::GetCurrentProcess().SessionId -eq 0){
 throw 'Cannot change an interactive launcher from Session 0'
}
if($Remove){
 if(!$existing){throw 'No existing task to remove'}
 $actions=@($existing.Actions)
 if($actions.Count -ne 1 -or $actions[0].Execute -ine $exe -or
    $actions[0].Arguments -ne $expected){
  throw 'Task identity mismatch: refuse to delete unrelated task'
 }
 Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
 if(Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue){
  throw 'Removal was not confirmed'
 }
 [pscustomobject]@{taskName=$TaskName;operation='remove';verified=$true}|ConvertTo-Json -Compress
 exit 0
}
if($existing){throw 'Task already exists: refuse overwrite'}
if($Active -and ($c.exclusiveOwnership -ne $true -or !$c.pauseFile -or
 ![IO.Path]::IsPathRooted([string]$c.pauseFile))){
 throw 'Active mode requires owner-approved exclusiveOwnership and pause marker'
}
$principal=New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Interactive -RunLevel Limited
$trigger=New-ScheduledTaskTrigger -AtLogOn -User $identity.Name
$action=New-ScheduledTaskAction -Execute $exe -Argument $expected
$argsSettings=@{MultipleInstances='IgnoreNew';RestartCount=3;RestartInterval=(New-TimeSpan -Minutes 1);ExecutionTimeLimit=[TimeSpan]::Zero;AllowStartIfOnBatteries=$true;DontStopIfGoingOnBatteries=$true;StartWhenAvailable=$true}
$settings=New-ScheduledTaskSettingsSet @argsSettings
$argsTask=@{TaskName=$TaskName;Principal=$principal;Action=$action;Trigger=$trigger;Settings=$settings;Description='Owner-approved MAS user-session agent companion'}
Register-ScheduledTask @argsTask | Out-Null
$installed=Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
if($installed.Principal.UserId -ine $identity.Name -or
 $installed.Principal.RunLevel -ne 'Limited'){
 throw 'Task installed but ownership check failed: operator review required'
}
[pscustomobject]@{taskName=$TaskName;operation='install';verified=$true;
 startedImmediately=$false;mode=$mode}|ConvertTo-Json -Compress
