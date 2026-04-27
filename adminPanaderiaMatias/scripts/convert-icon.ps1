# Convert logo PNG to ICO format using .NET
# Generates a multi-size ICO (16, 32, 48, 64, 128, 256px)

Add-Type -AssemblyName System.Drawing

$sourcePath = "$PSScriptRoot\..\src\renderer\assets\logo.png"
$outputPath = "$PSScriptRoot\..\assets\icon.ico"

# Create assets directory if it doesn't exist
$outputDir = Split-Path $outputPath
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

function CreateIco($sourcePng, $destIco) {
    $sizes = @(16, 32, 48, 64, 128, 256)
    $bitmaps = @()
    
    $original = [System.Drawing.Image]::FromFile((Resolve-Path $sourcePng).Path)
    
    foreach ($size in $sizes) {
        $bmp = New-Object System.Drawing.Bitmap($size, $size)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($original, 0, 0, $size, $size)
        $g.Dispose()
        $bitmaps += $bmp
    }
    
    $original.Dispose()
    
    # Write ICO file manually
    $stream = [System.IO.File]::Create($destIco)
    $writer = New-Object System.IO.BinaryWriter($stream)
    
    # ICO header
    $writer.Write([uint16]0)  # Reserved
    $writer.Write([uint16]1)  # Type: ICO
    $writer.Write([uint16]$bitmaps.Count)  # Count
    
    $offset = 6 + ($bitmaps.Count * 16)
    $pngDataList = @()
    
    foreach ($bmp in $bitmaps) {
        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngData = $ms.ToArray()
        $ms.Dispose()
        $pngDataList += ,$pngData
        
        $w = if ($bmp.Width -eq 256) { 0 } else { $bmp.Width }
        $h = if ($bmp.Height -eq 256) { 0 } else { $bmp.Height }
        
        $writer.Write([byte]$w)
        $writer.Write([byte]$h)
        $writer.Write([byte]0)   # Color count
        $writer.Write([byte]0)   # Reserved
        $writer.Write([uint16]1) # Color planes
        $writer.Write([uint16]32) # Bits per pixel
        $writer.Write([uint32]$pngData.Length)
        $writer.Write([uint32]$offset)
        
        $offset += $pngData.Length
        $bmp.Dispose()
    }
    
    foreach ($pngData in $pngDataList) {
        $writer.Write($pngData)
    }
    
    $writer.Dispose()
    $stream.Dispose()
    
    Write-Host "ICO generated at: $destIco"
}

CreateIco $sourcePath $outputPath
