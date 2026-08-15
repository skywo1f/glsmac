[CmdletBinding()]
param(
	[Parameter(Mandatory = $true)]
	[string] $SmacPath,
	[Parameter(Mandatory = $true)]
	[string] $ThinkerZip,
	[Parameter(Mandatory = $true)]
	[string] $RuntimePath,
	[switch] $ForceInstall,
	[switch] $LaunchSmoke,
	[string] $ScreenshotPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'GLSMACClassic.psm1') -Force

function Assert-Equal {
	param($Actual, $Expected, [string] $Message)
	if ($Actual -ne $Expected) {
		throw "$Message (actual: $Actual, expected: $Expected)"
	}
}

$source = Assert-GLSMACSmacInstallation -SmacPath $SmacPath
$thinker = Assert-GLSMACThinkerPackage -ThinkerZip $ThinkerZip
$sourceTerranxBefore = (Get-FileHash -LiteralPath $source.TerranxPath -Algorithm SHA256).Hash
$sourceIni = Join-Path $source.Path 'Alpha Centauri.ini'
$sourceIniBefore = if (Test-Path -LiteralPath $sourceIni) {
	(Get-FileHash -LiteralPath $sourceIni -Algorithm SHA256).Hash
}
else {
	$null
}

$installArguments = @{
	SmacPath = $source.Path
	ThinkerZip = $thinker.Path
	ConfigTemplate = (Join-Path $PSScriptRoot 'thinker_user.ini')
	RuntimePath = $RuntimePath
}
if ($ForceInstall) {
	$installArguments.Force = $true
}
$runtime = Install-GLSMACClassicRuntime @installArguments

Assert-Equal `
	(Get-FileHash -LiteralPath (Join-Path $runtime.Path 'terranx.exe') -Algorithm SHA1).Hash `
	$source.TerranxSha1 `
	'Runtime terranx.exe changed during staging'
Assert-Equal `
	(Get-FileHash -LiteralPath $source.TerranxPath -Algorithm SHA256).Hash `
	$sourceTerranxBefore `
	'Original terranx.exe changed during staging'
if ($sourceIniBefore) {
	Assert-Equal `
		(Get-FileHash -LiteralPath $sourceIni -Algorithm SHA256).Hash `
		$sourceIniBefore `
		'Original Alpha Centauri.ini changed during staging'
}

$alphaPath = Join-Path $runtime.Path 'smac_mod\alphax.txt'
$alpha = Get-Content -LiteralPath $alphaPath
$newFactionsIndex = [Array]::IndexOf($alpha, '#NEWFACTIONS')
$customFactionsIndex = [Array]::IndexOf($alpha, '#CUSTOMFACTIONS')
if ($newFactionsIndex -lt 0 -or $customFactionsIndex -le $newFactionsIndex) {
	throw 'Unable to verify staged faction sections.'
}
$crossfireEntries = $alpha[($newFactionsIndex + 1)..($customFactionsIndex - 1)] |
	Where-Object { $_.Trim() -and -not $_.Trim().StartsWith(';') }
Assert-Equal @($crossfireEntries).Count 0 'Crossfire factions remain selectable'

$config = Get-Content -LiteralPath (Join-Path $runtime.Path 'thinker_user.ini') -Raw
foreach ($requiredSetting in @(
	'smac_only=1',
	'modify_unit_limit=0',
	'ignore_reactor_power=0',
	'simple_hurry_cost=0',
	'new_world_builder=0',
	'spawn_spore_launchers=0',
	'spawn_sealurks=0',
	'spawn_battle_ogres=0',
	'spawn_fungal_towers=0'
)) {
	if (-not $config.Contains($requiredSetting)) {
		throw "Classic configuration is missing $requiredSetting"
	}
}

$reused = Install-GLSMACClassicRuntime `
	-SmacPath $source.Path `
	-ThinkerZip $thinker.Path `
	-ConfigTemplate (Join-Path $PSScriptRoot 'thinker_user.ini') `
	-RuntimePath $runtime.Path
if ($reused.Installed) {
	throw 'Second Classic installation did not reuse the validated runtime.'
}

if ($LaunchSmoke -or -not [string]::IsNullOrWhiteSpace($ScreenshotPath)) {
	$launchStarted = Get-Date
	$launcher = Start-GLSMACClassic -RuntimePath $runtime.Path -DisplayMode windowed -PassThru
	$game = $null
	$deadline = $launchStarted.AddSeconds(20)
	while (-not $game -and (Get-Date) -lt $deadline) {
		Start-Sleep -Milliseconds 250
		$game = Get-Process -Name terranx -ErrorAction SilentlyContinue |
			Where-Object {
				$_.Path -and
				$_.Path.StartsWith($runtime.Path, [System.StringComparison]::OrdinalIgnoreCase) -and
				$_.StartTime -ge $launchStarted
			} |
			Select-Object -First 1
	}
	if (-not $game) {
		$launcher.Refresh()
		$launcherResult = if ($launcher.HasExited) { $launcher.ExitCode } else { 'running' }
		throw "Thinker did not hand off to staged terranx.exe (launcher: $launcherResult)."
	}

	Start-Sleep -Seconds 8
	$game.Refresh()
	if ($game.HasExited -or -not $game.Responding) {
		throw 'The staged terranx.exe did not remain responsive during launch smoke.'
	}
	if (-not [string]::IsNullOrWhiteSpace($ScreenshotPath)) {
		Add-Type -AssemblyName System.Drawing
		if (-not ('GLSMACClassicCapture' -as [type])) {
			Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class GLSMACClassicCapture
{
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint flags);
}
'@
		}
		$target = [System.IO.Path]::GetFullPath($ScreenshotPath)
		[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($target)) | Out-Null
		$rect = New-Object GLSMACClassicCapture+RECT
		if (-not [GLSMACClassicCapture]::GetWindowRect($game.MainWindowHandle, [ref] $rect)) {
			throw 'Unable to query the staged Classic window rectangle.'
		}
		$width = $rect.Right - $rect.Left
		$height = $rect.Bottom - $rect.Top
		$bitmap = New-Object System.Drawing.Bitmap $width, $height
		$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
		try {
			$deviceContext = $graphics.GetHdc()
			try {
				if (-not [GLSMACClassicCapture]::PrintWindow($game.MainWindowHandle, $deviceContext, 2)) {
					throw 'Win32 PrintWindow failed for the staged Classic window.'
				}
			}
			finally {
				$graphics.ReleaseHdc($deviceContext)
			}

			$nonblack = 0
			$samples = 0
			for ($y = 0; $y -lt $height; $y += 16) {
				for ($x = 0; $x -lt $width; $x += 16) {
					$pixel = $bitmap.GetPixel($x, $y)
					if ($pixel.R -gt 8 -or $pixel.G -gt 8 -or $pixel.B -gt 8) {
						$nonblack++
					}
					$samples++
				}
			}
			if ($nonblack -lt [Math]::Ceiling($samples * 0.02)) {
				throw "Classic visual capture is effectively blank ($nonblack of $samples samples)."
			}
			$bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
		}
		finally {
			$graphics.Dispose()
			$bitmap.Dispose()
		}
	}

	$game.CloseMainWindow() | Out-Null
	if (-not $game.WaitForExit(5000)) {
		Stop-Process -Id $game.Id
	}
}

Write-Host 'GLSMAC Classic staging verification passed.'
Write-Host "Runtime: $($runtime.Path)"
Write-Host "Thinker SHA-256: $($thinker.Sha256)"
Write-Host "terranx.exe SHA-1: $($source.TerranxSha1)"
