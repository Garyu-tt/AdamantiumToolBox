$ErrorActionPreference='Stop'
$source=Split-Path -Parent $MyInvocation.MyCommand.Path
& python (Join-Path $source 'tools\architecture-check.py')
if($LASTEXITCODE -ne 0){throw 'Architecture policy violation'}
& python (Join-Path $source 'tests\architecture.test.py')
if($LASTEXITCODE -ne 0){throw 'Architecture gate regression'}
& python (Join-Path $source 'tools\check-size.py')
if($LASTEXITCODE -ne 0){throw 'Source size gate failed'}
foreach($test in @('tests\linkfs.test.mjs','tests\contract.test.mjs','tests\semantic.test.mjs','tests\codegraph.test.mjs','tests\mesh.test.mjs','tests\storage.test.mjs','tests\isolation.test.mjs','tests\assets.test.mjs','tests\services.test.mjs','tests\headless.test.mjs','tests\lifecycle.test.mjs','tests\runtime_guard.test.mjs','tests\runtime_recovery.test.mjs','tests\browser.test.mjs','tests\browser_lease.test.mjs','tests\browser_relay.test.mjs','tests\browser_provider_cli.test.mjs','tests\browser_continuity.test.mjs','tests\browser_handoff.test.mjs','tests\window_geometry.test.mjs','tests\window_ui.test.mjs')){
 & node (Join-Path $source $test)
 if($LASTEXITCODE -ne 0){throw ('Test failed: '+$test)}
}
& node (Join-Path $source 'tools\mas-check.mjs')
if($LASTEXITCODE -ne 0){throw 'MAS validation failed'}
$target=Join-Path $env:ProgramFiles 'Adamantium Toolbox'
$existing=Get-ScheduledTask -TaskName AdamantiumToolboxServer -ErrorAction SilentlyContinue
if($existing -and $existing.State -eq 'Running'){
 Stop-ScheduledTask -TaskName AdamantiumToolboxServer
 Start-Sleep -Seconds 2
}
if(!(Test-Path $target)){New-Item -ItemType Directory -Path $target -Force|Out-Null}
foreach($folder in @('core','services','apps','shell','icons','tools','standards','interface','docs','tests')){
 Copy-Item -LiteralPath (Join-Path $source $folder) -Destination $target -Recurse -Force
}
foreach($f in @('launch.ps1','README.md')){
 Copy-Item -LiteralPath (Join-Path $source $f) -Destination $target -Force
}
$runtime=Join-Path $env:LOCALAPPDATA 'Adamantium Toolbox'
foreach($dir in @('workspace','mesh','plugins\inbox','plugins\store')){
 New-Item -ItemType Directory -Path (Join-Path $runtime $dir) -Force|Out-Null
}
$junction=Join-Path $target 'data'
if(!(Test-Path $junction)){New-Item -ItemType Junction -Path $junction -Target $runtime|Out-Null}
$policy=Join-Path $runtime 'policy.json'
if(!(Test-Path $policy)){
 Copy-Item -LiteralPath (Join-Path $target 'standards\architecture\default-owner-policy.json') -Destination $policy
}
& (Join-Path $target 'tools\register-task.ps1')
& (Join-Path $target 'launch.ps1') -NoWindow
& (Join-Path $target 'tools\sync-shortcuts.ps1')
& node (Join-Path $target 'tests\http.test.mjs')
if($LASTEXITCODE -ne 0){throw 'HTTP integration test failed'}
& node (Join-Path $target 'tests\browser_proxy.test.mjs')
if($LASTEXITCODE -ne 0){throw 'Browser API integration failed'}
& node (Join-Path $target 'tests\window_shell.test.mjs')
if($LASTEXITCODE -ne 0){throw 'Window shell integration failed'}
Write-Output ('INSTALLED='+$target)
