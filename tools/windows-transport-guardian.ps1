param(
 [Parameter(Mandatory=$true)][string]$ConfigPath,
 [switch]$Run,[switch]$Monitor,[int]$MaxChecks=0
)
$ErrorActionPreference='Stop'
if($Run -and $Monitor){throw 'Exclusive recovery and observer mode cannot be combined'}
if($MaxChecks -lt 0 -or $MaxChecks -gt 1000){throw 'Invalid check limit'}
$c=Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
if($c.schema -ne 'mas-transport-guardian-1'){throw 'Unsupported guardian config'}
$ssh=[string]$c.sshExecutable; $sshConfig=[string]$c.sshConfig; $target=[string]$c.sshTarget
if($Run -and (!$ssh -or !(Test-Path -LiteralPath $ssh -PathType Leaf) -or
 !$sshConfig -or !(Test-Path -LiteralPath $sshConfig -PathType Leaf) -or
 $sshConfig.Contains('"') -or $target -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$')){
 throw 'Invalid local SSH executable, config or alias'
}
$uri=$null
if(![uri]::TryCreate([string]$c.probeUrl,[UriKind]::Absolute,[ref]$uri) -or
 $uri.Scheme -notin @('http','https') -or
 $uri.Host -notin @('localhost','127.0.0.1','::1') -or
 $uri.UserInfo -or $uri.Query -or $uri.Fragment){throw 'Unsafe loopback probe URL'}
$poll=[int]$c.pollSec; $grace=[int]$c.startGraceSec
$threshold=[int]$c.failuresBeforeRestart; $base=[int]$c.backoffBaseSec
$cap=[int]$c.backoffCapSec
if($poll -lt 3 -or $poll -gt 120 -or $grace -lt 3 -or $grace -gt 120 -or
 $threshold -lt 2 -or $threshold -gt 20 -or $base -lt 5 -or
 $cap -lt $base -or $cap -gt 1800){throw 'Unsafe guardian retry policy'}
if($Run -and $c.exclusiveOwnership -ne $true){throw 'Run requires explicit exclusiveOwnership'}
if($Run -and @($c.conflictingTasks).Count -eq 0){throw 'Run requires conflictingTasks inventory'}
if($Run){
 foreach($name in @($c.conflictingTasks)){
  if($name -notmatch '^[A-Za-z0-9_ .-]{1,100}$'){throw 'Unsafe task name'}
  $task=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  if($task -and @($task|Where-Object {$_.State -eq 'Running'}).Count -gt 0){
   throw 'Existing transport task is active: refuse competing tunnel'
  }
 }
}
$pauseFile=[string]$c.pauseFile
if($pauseFile -and ![IO.Path]::IsPathRooted($pauseFile)){throw 'Pause marker must be absolute'}
$dir=Join-Path (Split-Path -Parent $ConfigPath) 'telemetry'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$file=Join-Path $dir 'transport-status.json'
$mutex=New-Object Threading.Mutex($false,'Local\AdamantiumTransportGuardian')
$held=$false
try{$held=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$held=$true}
if(!$held){$mutex.Dispose();throw 'Guardian already active'}
$child=$null;$failures=0;$restarts=0;$nextAt=[DateTime]::MinValue
$lastGood=$null;$reason='unobserved';$started=[DateTime]::MinValue
if(Test-Path -LiteralPath $file -PathType Leaf){
 try{$prior=Get-Content $file -Raw | ConvertFrom-Json
  if($prior.schema -eq 'mas-transport-guardian-status-1'){
   $restarts=[Math]::Max(0,[int]$prior.restarts)
   $failures=[Math]::Max(0,[int]$prior.failures)
   if($prior.nextAttemptUtc){$nextAt=[DateTime]::Parse($prior.nextAttemptUtc).ToUniversalTime()}
   $lastGood=$prior.lastGoodUtc
  }
 }catch{}
}
function Probe(){
 try{$r=Invoke-WebRequest -Uri $uri.AbsoluteUri -Method Get -UseBasicParsing -TimeoutSec 5 -MaximumRedirection 0
  return ($r.StatusCode -eq 200)
 }catch{return $false}
}
function Persist([string]$mode,[bool]$healthy,[bool]$running){
 $doc=@{schema='mas-transport-guardian-status-1';updatedAt=[DateTime]::UtcNow.ToString('o');
  mode=$mode;probeOk=$healthy;ownsSshProcess=$running;failures=$failures;
  restarts=$restarts;reason=$reason;lastGoodUtc=$lastGood;
  nextAttemptUtc=if($nextAt -gt [DateTime]::UtcNow){$nextAt.ToString('o')}else{$null}}
 $tmp=Join-Path $dir ('transport.'+[guid]::NewGuid().ToString('N')+'.tmp')
 [IO.File]::WriteAllText($tmp,($doc | ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)))
 if(Test-Path -LiteralPath $file){
  $backup=Join-Path $dir ('transport.'+[guid]::NewGuid().ToString('N')+'.bak')
  [IO.File]::Replace($tmp,$file,$backup)
  Remove-Item -LiteralPath $backup -ErrorAction SilentlyContinue
 }else{[IO.File]::Move($tmp,$file)}
}
function StopOwned(){
 if($null -ne $child){
  try{if(!$child.HasExited){$child.Kill();[void]$child.WaitForExit(3000)}}catch{}
  $child.Dispose();$script:child=$null
 }
}
function StartOwned(){
 $p=New-Object Diagnostics.ProcessStartInfo
 $p.FileName=$ssh
 $p.Arguments='-F "'+$sshConfig+'" -N -T -o BatchMode=yes -o StrictHostKeyChecking=yes -o ExitOnForwardFailure=yes -o PermitLocalCommand=no -o ControlMaster=no -o ServerAliveInterval=10 -o ServerAliveCountMax=3 -o ConnectTimeout=8 '+$target
 $p.UseShellExecute=$false;$p.CreateNoWindow=$true
 $script:child=[Diagnostics.Process]::Start($p)
 $script:started=[DateTime]::UtcNow
}
$checks=0
try{
 while($true){
  $now=[DateTime]::UtcNow;$paused=($pauseFile -and (Test-Path -LiteralPath $pauseFile))
  if($paused){StopOwned;$reason='paused';$failures=0;$mode='paused';$probeOk=$false}
  else{
   $probeOk=Probe
   if($probeOk){$lastGood=$now.ToString('o');$failures=0;$reason='healthy'}
   else{$failures=[Math]::Min(100000,$failures+1);$reason='probe_failed'}
   if($child -and $child.HasExited){
    StopOwned;$nextAt=$now.AddSeconds($base);$reason='ssh_exited'
   }
   if($child -and !$probeOk -and ($now-$started).TotalSeconds -ge $grace -and
    $failures -ge $threshold){
    StopOwned;$restarts++;$reason='ssh_unhealthy'
    $wait=[Math]::Min($cap,$base*[Math]::Pow(2,[Math]::Min(10,$restarts-1)))
    $nextAt=$now.AddSeconds($wait + (Get-Random -Minimum 0 -Maximum 4))
   }
   if($Run -and !$child -and !$probeOk -and $now -ge $nextAt){
    try{StartOwned;$reason='ssh_starting'}catch{$reason='ssh_spawn_failed';$nextAt=$now.AddSeconds($base)}
   }
   $mode=if($probeOk){'transport_healthy'}elseif($child){'connecting'}
    elseif($Run){'backoff'}else{'observe_only'}
  }
  Persist $mode ([bool]$probeOk) ([bool]($child -and !$child.HasExited))
  $checks++
  if((!$Run -and !$Monitor) -or ($MaxChecks -gt 0 -and $checks -ge $MaxChecks)){break}
  Start-Sleep -Seconds $poll
 }
}finally{StopOwned;if($held){$mutex.ReleaseMutex()};$mutex.Dispose()}
