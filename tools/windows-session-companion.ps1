param(
 [Parameter(Mandatory=$true)][string]$ConfigPath,
 [switch]$Run
)
$ErrorActionPreference='Stop'
$c=Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
if($c.schema -ne 'mas-session-companion-1'){throw 'Invalid session config'}
$launcher=[string]$c.launchScript;$agent=[string]$c.agentScript
if(!$launcher -or !(Test-Path -LiteralPath $launcher -PathType Leaf) -or
 !$agent -or !(Test-Path -LiteralPath $agent -PathType Leaf) -or
 [IO.Path]::GetExtension($launcher) -ne '.ps1' -or
 [IO.Path]::GetExtension($agent) -ne '.py' -or
 $launcher.Contains('"')){throw 'Missing or invalid owner launcher'}
$poll=[int]$c.pollSec;$threshold=[int]$c.failuresBeforeLaunch
$base=[int]$c.backoffBaseSec;$cap=[int]$c.backoffCapSec
if($poll -lt 5 -or $poll -gt 120 -or $threshold -lt 2 -or
 $threshold -gt 20 -or $base -lt 10 -or $cap -lt $base -or
 $cap -gt 1800){throw 'Invalid session recovery policy'}
$pauseFile=[string]$c.pauseFile
if($Run -and ($c.exclusiveOwnership -ne $true -or !$pauseFile)){
 throw 'Interactive run requires explicit owner approval and pause marker'
}
if($pauseFile -and ![IO.Path]::IsPathRooted($pauseFile)){
 throw 'Pause marker must be absolute'
}
$session=[Diagnostics.Process]::GetCurrentProcess().SessionId
if($Run -and $session -eq 0){throw 'Session 0 desktop companion prohibited'}
$mutex=New-Object Threading.Mutex($false,'Local\AdamantiumSessionCompanion')
$held=$false
try{$held=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$held=$true}
if(!$held){$mutex.Dispose();throw 'Companion already active'}
$dir=Join-Path (Split-Path -Parent $ConfigPath) 'telemetry'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$file=Join-Path $dir 'session-status.json'
$fails=0;$launches=0;$lastGood=$null;$nextAt=[DateTime]::MinValue
if(Test-Path -LiteralPath $file -PathType Leaf){
 try{$old=Get-Content -LiteralPath $file -Raw|ConvertFrom-Json
  if($old.schema -eq 'mas-session-companion-status-1'){
   $fails=[Math]::Max(0,[int]$old.failures)
   $launches=[Math]::Max(0,[int]$old.launches)
   $lastGood=$old.lastGoodUtc
   if($old.nextAttemptUtc){$nextAt=[DateTime]::Parse($old.nextAttemptUtc).ToUniversalTime()}
  }
 }catch{}
}
function AgentState(){
 try{
  $ps=@(Get-CimInstance Win32_Process -Filter ('SessionId='+$session) -ErrorAction Stop)
  $marker=[Regex]::Escape([IO.Path]::GetFileName($agent))
  $found=@($ps|Where-Object {$_.Name -match '^pythonw?\.exe$' -and
   $_.CommandLine -match $marker})
  return @{known=$true;count=$found.Count}
 }catch{return @{known=$false;count=0}}
}
function Persist([string]$mode,[string]$reason,[int]$agentCount){
 $now=[DateTime]::UtcNow
 $doc=@{schema='mas-session-companion-status-1';updatedAt=$now.ToString('o');
  mode=$mode;reason=$reason;agentCount=[Math]::Min($agentCount,20);
  failures=$fails;launches=$launches;lastGoodUtc=$lastGood;
  nextAttemptUtc=if($nextAt -gt $now){$nextAt.ToString('o')}else{$null}}
 $tmp=Join-Path $dir ('session.'+[guid]::NewGuid().ToString('N')+'.tmp')
 [IO.File]::WriteAllText($tmp,($doc|ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)))
 if(Test-Path -LiteralPath $file){
  $bak=Join-Path $dir ('session.'+[guid]::NewGuid().ToString('N')+'.bak')
  [IO.File]::Replace($tmp,$file,$bak)
  Remove-Item -LiteralPath $bak -ErrorAction SilentlyContinue
 }else{[IO.File]::Move($tmp,$file)}
}
function LaunchOwned(){
 $exe=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
 if(!(Test-Path -LiteralPath $exe)){throw 'Windows PowerShell unavailable'}
 $p=New-Object Diagnostics.ProcessStartInfo
 $p.FileName=$exe;$p.Arguments='-NoProfile -File "'+$launcher+'"'
 $p.UseShellExecute=$false;$p.CreateNoWindow=$false
 $child=[Diagnostics.Process]::Start($p)
 if(!$child){throw 'Launch failed'}
 $child.Dispose()
}
try{
 while($true){
  $now=[DateTime]::UtcNow
  $paused=($pauseFile -and (Test-Path -LiteralPath $pauseFile))
  $detected=AgentState
  $count=[int]$detected.count
  if($paused){$mode='paused';$reason='pause_marker';$fails=0}
  elseif(!$detected.known){$mode='unknown';$reason='process_query_failed'}
  elseif($count -gt 0){$mode='agent_present';$reason='agent_detected';
   $fails=0;$nextAt=[DateTime]::MinValue;$lastGood=$now.ToString('o')}
  else{
   $fails=[Math]::Min(100000,$fails+1)
   $reason='agent_missing'
   $mode=if($Run){'backoff'}else{'observe_only'}
   if($Run -and $fails -ge $threshold -and $now -ge $nextAt){
    $launches++
    try{LaunchOwned;$reason='launch_requested';$mode='starting'}
    catch{$reason='launch_failed';$mode='backoff'}
    $wait=[Math]::Min($cap,$base*[Math]::Pow(2,[Math]::Min(8,$launches-1)))
    $nextAt=$now.AddSeconds($wait+(Get-Random -Minimum 0 -Maximum 5))
   }
  }
  Persist $mode $reason $count
  if(!$Run){break}
  Start-Sleep -Seconds $poll
 }
}finally{if($held){$mutex.ReleaseMutex()};$mutex.Dispose()}
