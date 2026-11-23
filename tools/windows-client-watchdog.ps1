param(
 [string]$ConfigPath=(Join-Path $env:LOCALAPPDATA 'Adamantium Toolbox\client-watchdog\config.json'),
 [switch]$Once
)
$ErrorActionPreference='Stop'
$dir=Split-Path -Parent $ConfigPath
if(!(Test-Path -LiteralPath $ConfigPath -PathType Leaf)){throw 'Missing owner-approved watchdog config'}
$config=Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
if($config.schema -ne 'mas-client-watchdog-config-1'){throw 'Invalid config schema'}
if(@($config.targets).Count -gt 32){throw 'Too many targets'}
$poll=[int]$config.pollIntervalSec
if($poll -lt 5 -or $poll -gt 300){throw 'Invalid poll interval'}
$lock=New-Object System.Threading.Mutex($false,'Local\AdamantiumClientDeviceWatchdog')
if(!$lock.WaitOne(0)){throw 'Watchdog already running'}
$stateFile=Join-Path $dir 'status.json'
$previous=@{}
if(Test-Path -LiteralPath $stateFile -PathType Leaf){
 try{$prior=Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
  if($prior.schema -eq 'mas-client-watchdog-state-1'){
   foreach($p in @($prior.targets)){if($p.id -match '^[a-z][a-z0-9_-]{1,39}$'){$previous[$p.id]=$p}}
  }
 }catch{}
}
function Previous([string]$id){if($previous.ContainsKey($id)){return $previous[$id]}; return $null}
function SafeIso($v){if($v){return [string]$v};return $null}
function Probe($value){
 if(!$value){return $null}
 $u=$null
 if(![uri]::TryCreate([string]$value,[UriKind]::Absolute,[ref]$u)){throw 'Invalid probe URL'}
 if($u.UserInfo -or $u.Query -or $u.Fragment){throw 'Probe URL must not contain credentials or parameters'}
 if($u.Scheme -ne 'https' -and !($u.Scheme -eq 'http' -and
    @('localhost','127.0.0.1','::1').Contains($u.Host))){throw 'Untrusted probe URL'}
 try{$r=Invoke-WebRequest -Method Get -Uri $u.AbsoluteUri -TimeoutSec 5 -MaximumRedirection 0 -UseBasicParsing
  return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300)
 }catch{return $false}
}
function WriteState($items){
 $doc=@{schema='mas-client-watchdog-state-1';updatedAt=[DateTime]::UtcNow.ToString('o');targets=@($items)}
 $tmp=Join-Path $dir ('status.'+[guid]::NewGuid().ToString('N')+'.tmp')
 $body=$doc | ConvertTo-Json -Depth 6 -Compress
 [IO.File]::WriteAllText($tmp,$body,(New-Object System.Text.UTF8Encoding($false)))
 if(Test-Path -LiteralPath $stateFile){[IO.File]::Replace($tmp,$stateFile,$null)}
 else{[IO.File]::Move($tmp,$stateFile)}
}
try{
 while($true){
  $rows=@()
  foreach($target in @($config.targets)){
   $id=[string]$target.id;$name=[string]$target.taskName
   if($id -notmatch '^[a-z][a-z0-9_-]{1,39}$' -or !$name -or $name.Length -gt 100){
    throw 'Invalid task identity'
   }
   $old=Previous $id
   $now=[DateTime]::UtcNow
   $task=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue | Select-Object -First 1
   $running=($null -ne $task -and [string]$task.State -eq 'Running')
   $probe=Probe $target.healthUrl
   $healthy=if($null -ne $probe){$probe}else{$running}
   $fails=if($healthy){0}else{[Math]::Min(100000,([int]$old.failures+1))}
   $reason=if(!$task){'task_missing'}elseif($healthy){'healthy'}
     elseif(!$running){'task_stopped'}else{'probe_failed'}
   $lastGood=if($healthy){$now.ToString('o')}else{SafeIso $old.lastGoodUtc}
   $lastAttempt=SafeIso $old.lastAttemptUtc
   $threshold=if($target.failuresBeforeStart){[int]$target.failuresBeforeStart}else{3}
   $cooldown=if($target.cooldownSec){[int]$target.cooldownSec}else{120}
   if($threshold -lt 2 -or $threshold -gt 100 -or $cooldown -lt 30 -or $cooldown -gt 3600){
    throw 'Unsafe restart policy'
   }
   $elapsed=if($lastAttempt){($now-[DateTime]::Parse($lastAttempt)).TotalSeconds}else{1e10}
   $principal=if($task){[string]$task.Principal.UserId}else{''}
   $owned=$principal -eq $env:USERNAME -or $principal.EndsWith('\'+$env:USERNAME,[StringComparison]::OrdinalIgnoreCase)
   $least=$task -and [string]$task.Principal.RunLevel -eq 'LeastPrivilege'
   if($target.autoStart -eq $true -and $fails -ge $threshold -and !$running -and $task){
    if(!$owned -or !$least){$reason='probe_unsupported'}
    elseif($elapsed -lt $cooldown){$reason='cooldown'}
    else{
     $lastAttempt=$now.ToString('o')
     try{Start-ScheduledTask -TaskName $name -ErrorAction Stop;$reason='restart_requested'}
     catch{$reason='restart_failed'}
    }
   }
   $row=@{id=$id;taskRunning=$running;probeOk=$probe;failures=$fails;reason=$reason;
    lastGoodUtc=$lastGood;lastAttemptUtc=$lastAttempt}
   $rows+= $row
  }
  WriteState $rows
  $previous=@{};foreach($row in $rows){$previous[$row.id]=[pscustomobject]$row}
  if($Once){break}
  Start-Sleep -Seconds $poll
 }
}finally{$lock.ReleaseMutex();$lock.Dispose()}
