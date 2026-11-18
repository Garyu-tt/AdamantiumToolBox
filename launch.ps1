param([string]$View = '',[switch]$NoWindow)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$profile=Join-Path $env:LOCALAPPDATA 'Adamantium Toolbox'
New-Item -ItemType Directory -Force -Path $profile | Out-Null
$auth=Join-Path $profile 'auth.json'
function New-Secret {
 $bytes=New-Object byte[] 32
 $rng=[System.Security.Cryptography.RandomNumberGenerator]::Create()
 try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
 return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
}
if(!(Test-Path $auth)){
 $settings=@{token=(New-Secret);internal=(New-Secret)}
 ($settings|ConvertTo-Json -Compress)|Set-Content -LiteralPath $auth -Encoding UTF8
}
$settings=Get-Content -Raw -LiteralPath $auth | ConvertFrom-Json
$policyPath=Join-Path $profile 'policy.json'
if(!(Test-Path $policyPath)){
 Copy-Item -LiteralPath (Join-Path $root 'standards\architecture\default-owner-policy.json') -Destination $policyPath
}
$policy=Get-Content -Raw -LiteralPath $policyPath | ConvertFrom-Json
if($policy.schema -ne 'mas-owner-policy-1'){throw 'Invalid owner policy'}
$env:ADA_CAPS=(@($policy.capabilities) -join ',')
$env:ADA_CORE_URL='http://127.0.0.1:'+$(if($env:ADA_PORT){$env:ADA_PORT}else{'8880'})

$task=Get-ScheduledTask -TaskName 'AdamantiumToolboxServer' -ErrorAction SilentlyContinue
if($task){
 try{Start-ScheduledTask -TaskName 'AdamantiumToolboxServer' -ErrorAction Stop}catch{}
}else{
 $env:ADA_TOKEN=$settings.token;$env:ADA_INTERNAL_KEY=$settings.internal
 
 & (Get-Command node.exe).Source (Join-Path $root 'core\supervisor.mjs')
}
$ready=$false
for($i=0;$i -lt 30;$i++){
 try{
  $h=Invoke-RestMethod -Uri 'http://127.0.0.1:8880/health' -TimeoutSec 1
  if($h.service -eq 'Adamantium Toolbox'){$ready=$true;break}
 }catch{}
 Start-Sleep -Milliseconds 250
}
if(!$ready){throw 'Workbench server failed to start'}
if($NoWindow){Write-Output 'READY';exit 0}
try{& (Join-Path $root 'tools\sync-shortcuts.ps1')|Out-Null}catch{}
$edge='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if(!(Test-Path $edge)){$edge='C:\Program Files\Google\Chrome\Application\chrome.exe'}
if(!(Test-Path $edge)){throw 'Edge or Chrome is required'}
$base='http://127.0.0.1:8880/'
if($View){
 if($View -notmatch '^[a-z0-9_-]+\.[a-z0-9_-]+$'){throw 'Invalid view id'}
 $base+='?app='+[Uri]::EscapeDataString($View)
}
$url=$base+'#token='+$settings.token
Start-Process -FilePath $edge -ArgumentList @('--app='+$url,'--no-first-run')
