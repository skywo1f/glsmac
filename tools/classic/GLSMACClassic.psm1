Set-StrictMode -Version Latest

$script:ClassicVersion = '5.4'
$script:ExpectedTerranxSha1 = '4B19C1FE3266B5EBC4305CD182ED6E864E3A1C4A'
$script:ExpectedThinkerSha256 = '07B610C83E8DE2B3D805E7D33BB12406149E056AFBDEB22FFA2F210B1AEEB507'
$script:RuntimeMarkerName = '.glsmac-classic-runtime.json'

function Get-GLSMACFileHash {
	param(
		[Parameter(Mandatory = $true)]
		[string] $Path,
		[Parameter(Mandatory = $true)]
		[ValidateSet('SHA1', 'SHA256')]
		[string] $Algorithm
	)

	$hasher = if ($Algorithm -eq 'SHA1') {
		[System.Security.Cryptography.SHA1]::Create()
	}
	else {
		[System.Security.Cryptography.SHA256]::Create()
	}
	$stream = [System.IO.File]::OpenRead($Path)
	try {
		[System.BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '')
	}
	finally {
		$stream.Dispose()
		$hasher.Dispose()
	}
}

function Get-GLSMACClassicInfo {
	[CmdletBinding()]
	param()

	[pscustomobject]@{
		Version = $script:ClassicVersion
		ExpectedTerranxSha1 = $script:ExpectedTerranxSha1
		ExpectedThinkerSha256 = $script:ExpectedThinkerSha256
	}
}

function Get-NormalizedPath {
	param(
		[Parameter(Mandatory = $true)]
		[string] $Path
	)

	[System.IO.Path]::GetFullPath($Path).TrimEnd(
		[System.IO.Path]::DirectorySeparatorChar,
		[System.IO.Path]::AltDirectorySeparatorChar
	)
}

function Test-PathContainedBy {
	param(
		[Parameter(Mandatory = $true)]
		[string] $Path,
		[Parameter(Mandatory = $true)]
		[string] $Parent
	)

	$normalizedPath = (Get-NormalizedPath $Path) + [System.IO.Path]::DirectorySeparatorChar
	$normalizedParent = (Get-NormalizedPath $Parent) + [System.IO.Path]::DirectorySeparatorChar
	$normalizedPath.StartsWith($normalizedParent, [System.StringComparison]::OrdinalIgnoreCase)
}

function Assert-GLSMACSmacInstallation {
	[CmdletBinding()]
	param(
		[Parameter(Mandatory = $true)]
		[string] $SmacPath
	)

	$source = Get-NormalizedPath $SmacPath
	if (-not [System.IO.Directory]::Exists($source)) {
		throw "SMAC installation directory does not exist: $source"
	}

	$terranx = Join-Path $source 'terranx.exe'
	if (-not [System.IO.File]::Exists($terranx)) {
		throw "SMAC installation is missing terranx.exe: $source"
	}

	$hash = (Get-GLSMACFileHash -Path $terranx -Algorithm SHA1).ToUpperInvariant()
	if ($hash -ne $script:ExpectedTerranxSha1) {
		throw "Unsupported terranx.exe (SHA-1 $hash). Thinker v$($script:ClassicVersion) requires $($script:ExpectedTerranxSha1)."
	}

	[pscustomobject]@{
		Path = $source
		TerranxPath = $terranx
		TerranxSha1 = $hash
	}
}

function Assert-GLSMACThinkerPackage {
	[CmdletBinding()]
	param(
		[Parameter(Mandatory = $true)]
		[string] $ThinkerZip
	)

	$archive = Get-NormalizedPath $ThinkerZip
	if (-not [System.IO.File]::Exists($archive)) {
		throw "Thinker v$($script:ClassicVersion) archive not found: $archive"
	}

	$hash = (Get-GLSMACFileHash -Path $archive -Algorithm SHA256).ToUpperInvariant()
	if ($hash -ne $script:ExpectedThinkerSha256) {
		throw "Unexpected Thinker archive (SHA-256 $hash). Expected $($script:ExpectedThinkerSha256)."
	}

	[pscustomobject]@{
		Path = $archive
		Sha256 = $hash
	}
}

function Get-GLSMACClassicRuntimePath {
	[CmdletBinding()]
	param()

	$localAppData = [System.Environment]::GetFolderPath(
		[System.Environment+SpecialFolder]::LocalApplicationData
	)
	if ([string]::IsNullOrWhiteSpace($localAppData)) {
		throw 'Windows did not provide a Local AppData directory.'
	}

	Join-Path $localAppData "GLSMAC\Classic\$($script:ClassicVersion)"
}

function Copy-GLSMACDirectoryTree {
	param(
		[Parameter(Mandatory = $true)]
		[string] $Source,
		[Parameter(Mandatory = $true)]
		[string] $Destination
	)

	$sourceRoot = Get-NormalizedPath $Source
	$destinationRoot = Get-NormalizedPath $Destination
	if (
		(Test-PathContainedBy -Path $destinationRoot -Parent $sourceRoot) -or
		(Test-PathContainedBy -Path $sourceRoot -Parent $destinationRoot)
	) {
		throw 'The Classic runtime and original SMAC installation must be separate directory trees.'
	}

	[System.IO.Directory]::CreateDirectory($destinationRoot) | Out-Null
	foreach (
		$directory in [System.IO.Directory]::EnumerateDirectories(
			$sourceRoot,
			'*',
			[System.IO.SearchOption]::AllDirectories
		)
	) {
		$relative = $directory.Substring($sourceRoot.Length).TrimStart('\', '/')
		[System.IO.Directory]::CreateDirectory((Join-Path $destinationRoot $relative)) | Out-Null
	}

	foreach (
		$file in [System.IO.Directory]::EnumerateFiles(
			$sourceRoot,
			'*',
			[System.IO.SearchOption]::AllDirectories
		)
	) {
		$relative = $file.Substring($sourceRoot.Length).TrimStart('\', '/')
		$target = Join-Path $destinationRoot $relative
		$targetDirectory = [System.IO.Path]::GetDirectoryName($target)
		[System.IO.Directory]::CreateDirectory($targetDirectory) | Out-Null
		[System.IO.File]::Copy($file, $target, $true)
	}
}

function Disable-GLSMACCrossfireFactions {
	[CmdletBinding()]
	param(
		[Parameter(Mandatory = $true)]
		[string] $AlphaFile
	)

	$path = Get-NormalizedPath $AlphaFile
	if (-not [System.IO.File]::Exists($path)) {
		throw "SMAC-only faction catalog not found: $path"
	}

	$encoding = [System.Text.Encoding]::GetEncoding(1252)
	$content = [System.IO.File]::ReadAllText($path, $encoding)
	$pattern = '(?ms)^(#NEWFACTIONS\s*\r?\n).*?(?=^#CUSTOMFACTIONS\s*$)'
	$replacement = "`$1; Disabled by GLSMAC Classic: Crossfire factions are outside this release.`r`n`r`n"
	$updated = [System.Text.RegularExpressions.Regex]::Replace($content, $pattern, $replacement)
	if ($updated -eq $content) {
		throw 'Unable to locate the #NEWFACTIONS section in the Thinker SMAC catalog.'
	}

	[System.IO.File]::WriteAllText($path, $updated, $encoding)
}

function Get-GLSMACClassicMarker {
	param(
		[Parameter(Mandatory = $true)]
		[string] $RuntimePath
	)

	Join-Path (Get-NormalizedPath $RuntimePath) $script:RuntimeMarkerName
}

function Test-GLSMACClassicRuntime {
	[CmdletBinding()]
	param(
		[Parameter(Mandatory = $true)]
		[string] $RuntimePath,
		[Parameter(Mandatory = $true)]
		[string] $TerranxSha1,
		[Parameter(Mandatory = $true)]
		[string] $ThinkerSha256
	)

	$runtime = Get-NormalizedPath $RuntimePath
	$markerPath = Get-GLSMACClassicMarker $runtime
	if (-not [System.IO.File]::Exists($markerPath)) {
		return $false
	}

	try {
		$marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
		if (
			$marker.classicVersion -ne $script:ClassicVersion -or
			$marker.terranxSha1 -ne $TerranxSha1 -or
			$marker.thinkerSha256 -ne $ThinkerSha256
		) {
			return $false
		}
		foreach ($required in @('terranx.exe', 'thinker.exe', 'thinker.dll', 'thinker_user.ini', 'smac_mod\alphax.txt')) {
			if (-not [System.IO.File]::Exists((Join-Path $runtime $required))) {
				return $false
			}
		}
		$runtimeHash = Get-GLSMACFileHash -Path (Join-Path $runtime 'terranx.exe') -Algorithm SHA1
		return $runtimeHash -eq $TerranxSha1
	}
	catch {
		return $false
	}
}

function Install-GLSMACClassicRuntime {
	[CmdletBinding()]
	param(
		[Parameter(Mandatory = $true)]
		[string] $SmacPath,
		[Parameter(Mandatory = $true)]
		[string] $ThinkerZip,
		[Parameter(Mandatory = $true)]
		[string] $ConfigTemplate,
		[string] $RuntimePath = (Get-GLSMACClassicRuntimePath),
		[switch] $Force
	)

	$source = Assert-GLSMACSmacInstallation -SmacPath $SmacPath
	$thinker = Assert-GLSMACThinkerPackage -ThinkerZip $ThinkerZip
	$configPath = Get-NormalizedPath $ConfigTemplate
	if (-not [System.IO.File]::Exists($configPath)) {
		throw "Classic Thinker configuration not found: $configPath"
	}

	$runtime = Get-NormalizedPath $RuntimePath
	if (
		-not $Force -and
		(Test-GLSMACClassicRuntime -RuntimePath $runtime -TerranxSha1 $source.TerranxSha1 -ThinkerSha256 $thinker.Sha256)
	) {
		return [pscustomobject]@{
			Path = $runtime
			Installed = $false
			TerranxSha1 = $source.TerranxSha1
			ThinkerSha256 = $thinker.Sha256
		}
	}

	if ([System.IO.Directory]::Exists($runtime)) {
		$entries = [System.IO.Directory]::EnumerateFileSystemEntries($runtime)
		$hasEntries = $null -ne ($entries | Select-Object -First 1)
		$marker = Get-GLSMACClassicMarker $runtime
		if ($hasEntries -and -not [System.IO.File]::Exists($marker)) {
			throw "Refusing to overlay an unrecognized directory: $runtime"
		}
	}

	Copy-GLSMACDirectoryTree -Source $source.Path -Destination $runtime
	Expand-Archive -LiteralPath $thinker.Path -DestinationPath $runtime -Force
	Copy-Item -LiteralPath $configPath -Destination (Join-Path $runtime 'thinker_user.ini') -Force
	Disable-GLSMACCrossfireFactions -AlphaFile (Join-Path $runtime 'smac_mod\alphax.txt')

	$markerData = [ordered]@{
		classicVersion = $script:ClassicVersion
		installedAtUtc = [System.DateTime]::UtcNow.ToString('o')
		sourcePath = $source.Path
		terranxSha1 = $source.TerranxSha1
		thinkerSha256 = $thinker.Sha256
	}
	$markerData | ConvertTo-Json | Set-Content -LiteralPath (Get-GLSMACClassicMarker $runtime) -Encoding UTF8

	if (-not (Test-GLSMACClassicRuntime -RuntimePath $runtime -TerranxSha1 $source.TerranxSha1 -ThinkerSha256 $thinker.Sha256)) {
		throw 'Classic runtime failed its post-install integrity check.'
	}

	[pscustomobject]@{
		Path = $runtime
		Installed = $true
		TerranxSha1 = $source.TerranxSha1
		ThinkerSha256 = $thinker.Sha256
	}
}

function Start-GLSMACClassic {
	[CmdletBinding()]
	param(
		[Parameter(Mandatory = $true)]
		[string] $RuntimePath,
		[ValidateSet('windowed', 'native', 'screen')]
		[string] $DisplayMode = 'windowed',
		[switch] $PassThru
	)

	$runtime = Get-NormalizedPath $RuntimePath
	$thinker = Join-Path $runtime 'thinker.exe'
	if (-not [System.IO.File]::Exists($thinker)) {
		throw "Classic runtime is missing thinker.exe: $runtime"
	}

	$arguments = @('-smac', "-$DisplayMode")
	Start-Process -FilePath $thinker -ArgumentList $arguments -WorkingDirectory $runtime -PassThru:$PassThru
}

Export-ModuleMember -Function @(
	'Get-GLSMACClassicInfo',
	'Assert-GLSMACSmacInstallation',
	'Assert-GLSMACThinkerPackage',
	'Get-GLSMACClassicRuntimePath',
	'Disable-GLSMACCrossfireFactions',
	'Test-GLSMACClassicRuntime',
	'Install-GLSMACClassicRuntime',
	'Start-GLSMACClassic'
)
