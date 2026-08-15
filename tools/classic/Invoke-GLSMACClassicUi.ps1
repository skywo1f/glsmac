[CmdletBinding()]
param(
	[Parameter(Mandatory = $true)]
	[int] $TargetProcessId,
	[Parameter(Mandatory = $true)]
	[ValidateRange(0.0, 1.0)]
	[double] $RelativeX,
	[Parameter(Mandatory = $true)]
	[ValidateRange(0.0, 1.0)]
	[double] $RelativeY,
	[Parameter(Mandatory = $true)]
	[string] $ScreenshotPath,
	[string] $ExpectedPath,
	[ValidateRange(0, 30)]
	[int] $WaitSeconds = 2
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class GLSMACClassicUiDriver
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
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int x, int y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr info);

    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdc, uint flags);
}
'@

$process = Get-Process -Id $TargetProcessId -ErrorAction Stop
if ($ExpectedPath) {
	$actualPath = [System.IO.Path]::GetFullPath($process.Path)
	$requiredPath = [System.IO.Path]::GetFullPath($ExpectedPath)
	if (-not $actualPath.Equals($requiredPath, [System.StringComparison]::OrdinalIgnoreCase)) {
		throw "Refusing to drive unexpected process: $actualPath"
	}
}
if (-not $process.Responding -or $process.MainWindowHandle -eq [IntPtr]::Zero) {
	throw 'Target Classic process does not have a responsive main window.'
}

$rect = New-Object GLSMACClassicUiDriver+RECT
if (-not [GLSMACClassicUiDriver]::GetWindowRect($process.MainWindowHandle, [ref] $rect)) {
	throw 'Unable to query the Classic window rectangle.'
}
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top
[GLSMACClassicUiDriver]::SetForegroundWindow($process.MainWindowHandle) | Out-Null
[GLSMACClassicUiDriver]::SetCursorPos(
	$rect.Left + [int]($width * $RelativeX),
	$rect.Top + [int]($height * $RelativeY)
) | Out-Null
[GLSMACClassicUiDriver]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero)
[GLSMACClassicUiDriver]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Seconds $WaitSeconds

$target = [System.IO.Path]::GetFullPath($ScreenshotPath)
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($target)) | Out-Null
$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
	$deviceContext = $graphics.GetHdc()
	try {
		if (-not [GLSMACClassicUiDriver]::PrintWindow($process.MainWindowHandle, $deviceContext, 2)) {
			throw 'Win32 PrintWindow failed for the Classic UI step.'
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
		throw "Classic UI capture is effectively blank ($nonblack of $samples samples)."
	}
	$bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
	$graphics.Dispose()
	$bitmap.Dispose()
}

[pscustomobject]@{
	ProcessId = $process.Id
	Screenshot = $target
	Width = $width
	Height = $height
	NonblackSamples = $nonblack
	TotalSamples = $samples
}
