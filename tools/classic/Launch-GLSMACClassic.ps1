[CmdletBinding()]
param(
	[string] $SmacPath,
	[string] $RuntimePath,
	[string] $ThinkerZip,
	[ValidateSet('windowed', 'native', 'screen')]
	[string] $DisplayMode = 'windowed',
	[switch] $InstallOnly,
	[switch] $ForceInstall,
	[switch] $NoDialogs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'GLSMACClassic.psm1') -Force

if ([string]::IsNullOrWhiteSpace($ThinkerZip)) {
	$ThinkerZip = Join-Path $PSScriptRoot 'third-party\Thinker_v5.4.zip'
}

function Show-ClassicError {
	param([string] $Message)

	if (-not $NoDialogs) {
		try {
			Add-Type -AssemblyName System.Windows.Forms
			[System.Windows.Forms.MessageBox]::Show(
				$Message,
				'GLSMAC Classic',
				[System.Windows.Forms.MessageBoxButtons]::OK,
				[System.Windows.Forms.MessageBoxIcon]::Error
			) | Out-Null
		}
		catch {
			# The console error below remains available if desktop UI is unavailable.
		}
	}
}

function Select-SmacDirectory {
	Add-Type -AssemblyName System.Windows.Forms
	$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
	$dialog.Description = 'Select your Sid Meier''s Alpha Centauri Planetary Pack folder.'
	$dialog.ShowNewFolderButton = $false
	if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
		throw 'No SMAC installation was selected.'
	}
	$dialog.SelectedPath
}

function Get-SettingsPath {
	$localAppData = [System.Environment]::GetFolderPath(
		[System.Environment+SpecialFolder]::LocalApplicationData
	)
	Join-Path $localAppData 'GLSMAC\classic-settings.json'
}

try {
	$settingsPath = Get-SettingsPath
	if ([string]::IsNullOrWhiteSpace($SmacPath) -and (Test-Path -LiteralPath $settingsPath)) {
		try {
			$settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
			if ($settings.smacPath) {
				$SmacPath = $settings.smacPath
			}
		}
		catch {
			$SmacPath = $null
		}
	}

	if ([string]::IsNullOrWhiteSpace($SmacPath) -and $env:GLSMAC_SMAC_PATH) {
		$SmacPath = $env:GLSMAC_SMAC_PATH
	}
	if ([string]::IsNullOrWhiteSpace($SmacPath)) {
		if ($NoDialogs) {
			throw 'Specify -SmacPath or set GLSMAC_SMAC_PATH when dialogs are disabled.'
		}
		$SmacPath = Select-SmacDirectory
	}

	$source = Assert-GLSMACSmacInstallation -SmacPath $SmacPath
	$settingsDirectory = Split-Path -Parent $settingsPath
	New-Item -ItemType Directory -Force -Path $settingsDirectory | Out-Null
	@{ smacPath = $source.Path } | ConvertTo-Json | Set-Content -LiteralPath $settingsPath -Encoding UTF8

	$installArguments = @{
		SmacPath = $source.Path
		ThinkerZip = $ThinkerZip
		ConfigTemplate = (Join-Path $PSScriptRoot 'thinker_user.ini')
	}
	if (-not [string]::IsNullOrWhiteSpace($RuntimePath)) {
		$installArguments.RuntimePath = $RuntimePath
	}
	if ($ForceInstall) {
		$installArguments.Force = $true
	}

	$runtime = Install-GLSMACClassicRuntime @installArguments
	if ($runtime.Installed) {
		Write-Host "GLSMAC Classic v5.4 installed at $($runtime.Path)"
	}
	else {
		Write-Host "GLSMAC Classic v5.4 integrity check passed at $($runtime.Path)"
	}

	if (-not $InstallOnly) {
		Start-GLSMACClassic -RuntimePath $runtime.Path -DisplayMode $DisplayMode
	}
}
catch {
	$message = $_.Exception.Message
	Show-ClassicError $message
	Write-Error $message
	exit 1
}
