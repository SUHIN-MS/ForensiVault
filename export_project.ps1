# === CONFIG ===
$outputFile = "project_dump.txt"

# File extensions to include (edit as needed)
$includeExtensions = @(
    "*.py","*.js","*.ts","*.jsx","*.tsx","*.html","*.css","*.scss",
    "*.json","*.java","*.cpp","*.c","*.h","*.cs","*.go","*.rs",
    "*.yaml","*.yml","*.toml","*.sql","*.sh","*.bat","*.md",
    "*.txt","*.cfg","*.ini","*.env.example","*.xml","*.swift",
    "*.kt","*.rb","*.php","*.vue","*.svelte","*.astro",
    "*.prisma","*.graphql","*.proto","*.dockerfile","Dockerfile",
    "*.tf","*.makefile","Makefile","*.gradle"
)

# Directories to exclude
$excludeDirs = @(
    'node_modules', '.git', 'dist', 'build', '__pycache__',
    '.next', 'venv', '.venv', 'env', '.env', 'vendor',
    'target', 'bin', 'obj', '.idea', '.vs', '.output',
    'coverage', '.nyc_output', '.cache', 'tmp', '.tmp'
)

$excludePattern = ($excludeDirs | ForEach-Object { [regex]::Escape($_) }) -join '|'

# === GENERATE TREE ===
"PROJECT STRUCTURE:" | Out-File $outputFile -Encoding UTF8
"==================" | Out-File $outputFile -Append -Encoding UTF8
# Simple tree using Get-ChildItem
Get-ChildItem -Recurse -File -Include $includeExtensions |
    Where-Object { $_.FullName -notmatch $excludePattern } |
    ForEach-Object {
        $relativePath = $_.FullName.Replace((Get-Location).Path + "\", "")
        "  $relativePath"
    } | Out-File $outputFile -Append -Encoding UTF8

"`n`n" | Out-File $outputFile -Append -Encoding UTF8

# === DUMP FILE CONTENTS ===
Get-ChildItem -Recurse -File -Include $includeExtensions |
    Where-Object { $_.FullName -notmatch $excludePattern } |
    ForEach-Object {
        $relativePath = $_.FullName.Replace((Get-Location).Path + "\", "")
        $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue

        if ($content) {
            $separator = "=" * 60
            "$separator"
            "FILE: $relativePath"
            "$separator"
            $content
            "`n"
        }
    } | Out-File $outputFile -Append -Encoding UTF8

# === SUMMARY ===
$fileCount = (Get-ChildItem -Recurse -File -Include $includeExtensions |
    Where-Object { $_.FullName -notmatch $excludePattern }).Count
$fileSize = (Get-Item $outputFile).Length / 1KB

Write-Host "Done! Exported $fileCount files to '$outputFile' ($([math]::Round($fileSize, 1)) KB)" -ForegroundColor Green

# Warn if too large for chat
if ($fileSize -gt 500) {
    Write-Host "WARNING: File is large (>500KB). Consider splitting or excluding some files." -ForegroundColor Yellow
}