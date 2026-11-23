param(
 [string]$Root=(Join-Path $env:LOCALAPPDATA 'Adamantium Toolbox\client-watchdog'),
 [int]$MaxAgeSeconds=120,
 [switch]$Strict
)
$ErrorActionPreference='Stop'
if(![IO.Path]::IsPathRooted($Root) -or $MaxAgeSeconds -lt 5 -or $MaxAgeSeconds -gt 600){
 throw 'Invalid observer root or freshness window'
}
function Snapshot([string]$name,[string]$schema,[string[]]$modes){
 $file=Join-Path (Join-Path $Root 'telemetry') $name
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){return @{mode='not_configured'}}
 try{
  $item=Get-Item -LiteralPath $file -Force -ErrorAction Stop
  if($item.Attributes -band [IO.FileAttributes]::ReparsePoint -or
   $item.Length -gt 65536){return @{mode='invalid'}}
  $data=Get-Content -LiteralPath $file -Raw -ErrorAction Stop|ConvertFrom-Json
  if($data.schema -ne $schema){return @{mode='invalid'}}
  $stamp=[DateTimeOffset]::MinValue
  if(![DateTimeOffset]::TryParse([string]$data.updatedAt,[ref]$stamp)){
   return @{mode='invalid'}
  }
  $age=([DateTimeOffset]::UtcNow-$stamp.ToUniversalTime()).TotalSeconds
  if($age -lt -60){return @{mode='invalid'}}
  $mode=if($age -gt $MaxAgeSeconds){'stale'}
   elseif([string]$data.mode -in $modes){[string]$data.mode}else{'invalid'}
  if($schema -eq 'mas-session-companion-status-1'){
   $agents=if($data.agentCount -is [int] -and $data.agentCount -ge 0){
    [Math]::Min(20,$data.agentCount)}else{0}
   return @{mode=$mode;updatedUtc=$stamp.ToUniversalTime().ToString('o');
    agentCount=$agents}
  }
  return @{mode=$mode;updatedUtc=$stamp.ToUniversalTime().ToString('o');
   probeOk=($data.probeOk -eq $true)}
 }catch{return @{mode='invalid'}}
}
$session=Snapshot 'session-status.json' 'mas-session-companion-status-1' @(
 'paused','unknown','agent_present','observe_only','backoff','starting')
$transport=Snapshot 'transport-status.json' 'mas-transport-guardian-status-1' @(
 'paused','transport_healthy','connecting','backoff','observe_only')
$ready=($session.mode -eq 'agent_present' -and $transport.mode -eq 'transport_healthy' -and
 $transport.probeOk -eq $true)
$overall=if($ready){'local_signals_healthy'}else{'degraded'}
$doc=@{schema='mas-client-status-1';host=$env:COMPUTERNAME;
 observedUtc=[DateTimeOffset]::UtcNow.ToString('o');overall=$overall;
 controllerAuthorization='not_verified';session=$session;transport=$transport}
$doc|ConvertTo-Json -Depth 5 -Compress
if($Strict -and !$ready){exit 2}
