$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$nodePath = (Get-Command node -ErrorAction Stop).Source
$taskName = 'TandoScope-Daily-Claude'
$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
if ((Get-TimeZone).Id -ne 'GMT Standard Time') {
  throw 'This 07:00 Dublin schedule requires Windows timezone GMT Standard Time. Adapt the trigger before installing elsewhere.'
}
$action = New-ScheduledTaskAction -Execute $nodePath -Argument ('"' + (Join-Path $PSScriptRoot 'scheduled-run.ts') + '"') -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -Daily -At '07:00'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 6) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'TandoScope: public tender backfill, market comparison and up to 10 Claude extractions daily; local data and logs, no broadcasts.' -Force | Out-Null
Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State
Get-ScheduledTaskInfo -TaskName $taskName | Select-Object NextRunTime, LastTaskResult
