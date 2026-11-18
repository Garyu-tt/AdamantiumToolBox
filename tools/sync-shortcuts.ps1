$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$profile=Join-Path $env:LOCALAPPDATA 'Adamantium Toolbox'
$settings=Get-Content -Raw (Join-Path $profile 'auth.json')|ConvertFrom-Json
$headers=@{Authorization=('Bearer '+$settings.token)}
$graph=Invoke-RestMethod -Uri 'http://127.0.0.1:8880/api/graph' -Headers $headers
$start=Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Adamantium Toolbox'
$desktop=[Environment]::GetFolderPath('Desktop')
New-Item -ItemType Directory -Path $start -Force|Out-Null
$shell=New-Object -ComObject WScript.Shell
function Shortcut([string]$file,[string]$view,[string]$icon,[string]$iconFile=''){
 $lnk=$shell.CreateShortcut($file)
 $lnk.TargetPath='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
 $arg='-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+(Join-Path $root 'launch.ps1')+'"'
 if($view){$arg+=' -View '+$view}
 $lnk.Arguments=$arg
 $lnk.WorkingDirectory=$root
 $location=Join-Path $root ('icons\'+$icon+'.ico')
 if($iconFile -and [IO.Path]::GetExtension($iconFile) -eq '.ico' -and (Test-Path -LiteralPath $iconFile)){$location=$iconFile}
 if(!(Test-Path -LiteralPath $location)){$location=Join-Path $root 'icons\adamantium.ico'}
 $lnk.IconLocation=$location+',0'
 $lnk.Description='Adamantium Toolbox application'
 $lnk.Save()
}
foreach($name in @('NeuroCMS Workbench.lnk','AdantiumToolKit.lnk')){
 $old=Join-Path $desktop $name
 if(Test-Path $old){
  $link=$shell.CreateShortcut($old)
  if($link.Arguments -match 'Program Files[\\/](NeuroCMS Workbench|AdantiumToolKit)[\\/]launch.ps1'){
   Remove-Item -LiteralPath $old
  }
 }
}
Shortcut (Join-Path $desktop 'Adamantium Toolbox.lnk') '' 'adamantium'
Shortcut (Join-Path $start 'Adamantium Toolbox.lnk') '' 'adamantium'
$keep=@('Adamantium Toolbox.lnk')
foreach($node in @($graph.nodes|Where-Object {$_.type -eq 'view'})){
 $id=[string]$node.id
 if($id -notmatch '^[a-z0-9_-]+\.[a-z0-9_-]+$'){continue}
 $name=($id -replace '[^a-z0-9._-]','_')+'.lnk'
 $ico=[string]$node.icon
 if($ico -notmatch '^[a-z0-9_-]+$'){$ico='adamantium'}
 Shortcut (Join-Path $start $name) $id $ico ([string]$node.iconFile)
 $keep+=$name
}
Get-ChildItem -LiteralPath $start -Filter '*.lnk'|Where-Object {$keep -notcontains $_.Name}|Remove-Item
Write-Output ('START_MENU='+(@($graph.nodes|Where-Object {$_.type -eq 'view'}).Count)+' apps')
