[CmdletBinding()]
param(
	[Parameter(Mandatory = $true)]
	[string] $GlsmacExe,
	[Parameter(Mandatory = $true)]
	[string] $ThinkerZip,
	[string] $OutputDirectory,
	[string] $Version,
	[switch] $Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'GLSMACClassic.psm1') -Force

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
	$OutputDirectory = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'out'
}

function Get-FullPath {
	param([string] $Path)
	[System.IO.Path]::GetFullPath($Path).TrimEnd('\', '/')
}

$exe = Get-FullPath $GlsmacExe
if (-not [System.IO.File]::Exists($exe)) {
	throw "GLSMAC executable not found: $exe"
}
$thinker = Assert-GLSMACThinkerPackage -ThinkerZip $ThinkerZip

if ([string]::IsNullOrWhiteSpace($Version)) {
	$commit = (& git -C (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) rev-parse --short HEAD).Trim()
	$Version = "{0}-{1}" -f (Get-Date -Format 'yyyyMMdd'), $commit
}
if ($Version -notmatch '^[A-Za-z0-9._-]+$') {
	throw 'Version may contain only letters, numbers, periods, underscores, and hyphens.'
}

$output = Get-FullPath $OutputDirectory
[System.IO.Directory]::CreateDirectory($output) | Out-Null
$packageName = "GLSMAC-Classic-Preview-$Version"
$packageRoot = Get-FullPath (Join-Path $output $packageName)
$outputPrefix = $output + [System.IO.Path]::DirectorySeparatorChar
if (-not ($packageRoot + [System.IO.Path]::DirectorySeparatorChar).StartsWith(
	$outputPrefix,
	[System.StringComparison]::OrdinalIgnoreCase
)) {
	throw 'Package output escaped the selected output directory.'
}

if ([System.IO.Directory]::Exists($packageRoot)) {
	if (-not $Force) {
		throw "Package directory already exists: $packageRoot"
	}
	if (-not [System.IO.Path]::GetFileName($packageRoot).StartsWith('GLSMAC-Classic-Preview-')) {
		throw 'Refusing to remove an unexpected package directory.'
	}
	Remove-Item -LiteralPath $packageRoot -Recurse -Force
}

$classicDirectory = Join-Path $packageRoot 'classic'
$thirdPartyDirectory = Join-Path $classicDirectory 'third-party'
[System.IO.Directory]::CreateDirectory($thirdPartyDirectory) | Out-Null

Copy-Item -LiteralPath $exe -Destination (Join-Path $packageRoot 'GLSMAC.exe')
$repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$dataSource = Join-Path $repositoryRoot 'GLSMAC_data\default'
if (-not [System.IO.Directory]::Exists($dataSource)) {
	throw "GLSMAC runtime data not found: $dataSource"
}
$dataDirectory = Join-Path $packageRoot 'GLSMAC_data'
[System.IO.Directory]::CreateDirectory($dataDirectory) | Out-Null
Copy-Item -LiteralPath $dataSource -Destination $dataDirectory -Recurse
foreach ($file in @(
	'GLSMACClassic.psm1',
	'Launch-GLSMACClassic.ps1',
	'thinker_user.ini',
	'README.md',
	'THINKER_LICENSE.txt'
)) {
	Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $classicDirectory $file)
}
Copy-Item -LiteralPath $thinker.Path -Destination (Join-Path $thirdPartyDirectory 'Thinker_v5.4.zip')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Play-GLSMAC-Classic.cmd') -Destination $packageRoot
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Play-GLSMAC-Preview.cmd') -Destination $packageRoot
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'RESCUE_RELEASE.md') -Destination (Join-Path $packageRoot 'README.md')

Copy-Item -LiteralPath (Join-Path $repositoryRoot 'LICENSE') -Destination (Join-Path $packageRoot 'GLSMAC_LICENSE.txt')

$hashLines = Get-ChildItem -LiteralPath $packageRoot -Recurse -File |
	Sort-Object FullName |
	ForEach-Object {
		$relative = $_.FullName.Substring($packageRoot.Length + 1).Replace('\', '/')
		$hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
		"$hash  $relative"
	}
$hashLines | Set-Content -LiteralPath (Join-Path $packageRoot 'SHA256SUMS.txt') -Encoding ASCII

$archive = Join-Path $output "$packageName.zip"
if (Test-Path -LiteralPath $archive) {
	if (-not $Force) {
		throw "Package archive already exists: $archive"
	}
	Remove-Item -LiteralPath $archive -Force
}
Compress-Archive -LiteralPath $packageRoot -DestinationPath $archive -CompressionLevel Optimal

[pscustomobject]@{
	PackageRoot = $packageRoot
	Archive = $archive
	ArchiveSha256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
	ThinkerSha256 = $thinker.Sha256
	GlsmacSha256 = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash
}
