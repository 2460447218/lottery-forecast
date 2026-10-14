param(
    [string]$Source = (Split-Path -Parent $PSScriptRoot),
    [string]$ExpectedHead,
    [string[]]$Paths,
    [string[]]$DeletePaths = @(),
    [string]$Message = 'Update lottery research site'
)

$ErrorActionPreference = 'Stop'
if (-not $ExpectedHead -or -not $Paths.Count) { throw 'ExpectedHead and Paths are required.' }
$repoApi = 'https://api.github.com/repos/2460447218/lottery-forecast'
$credential = "protocol=https`nhost=github.com`n`n" | git -c credential.interactive=never credential fill
$passwordLine = $credential | Where-Object { $_ -like 'password=*' } | Select-Object -First 1
if (-not $passwordLine) { throw 'No saved GitHub credential is available.' }
$headers = @{
    Authorization = 'Bearer ' + $passwordLine.Substring(9)
    Accept = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
}
function Send-Gh([string]$Method, [string]$Path, $Body = $null) {
    $args = @{ Uri = "$repoApi$Path"; Method = $Method; Headers = $headers }
    if ($null -ne $Body) {
        $args.ContentType = 'application/json; charset=utf-8'
        $args.Body = [System.Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 20 -Compress))
    }
    Invoke-RestMethod @args
}

$ref = Send-Gh GET '/git/ref/heads/main'
if ($ref.object.sha -ne $ExpectedHead) {
    throw "GitHub main has changed since the last sync: $($ref.object.sha). Review it before publishing."
}
$head = Send-Gh GET "/git/commits/$ExpectedHead"
$tree = @()
foreach ($path in $Paths) {
    $file = Join-Path $Source ($path.Replace('/', [IO.Path]::DirectorySeparatorChar))
    $blob = Send-Gh POST '/git/blobs' @{
        content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($file))
        encoding = 'base64'
    }
    $tree += @{ path = $path; mode = '100644'; type = 'blob'; sha = $blob.sha }
    Write-Output "Uploaded $path"
}
foreach ($path in $DeletePaths) {
    $tree += @{ path = $path; mode = '100644'; type = 'blob'; sha = $null }
    Write-Output "Removed $path"
}
$newTree = Send-Gh POST '/git/trees' @{ base_tree = $head.tree.sha; tree = $tree }
$commit = Send-Gh POST '/git/commits' @{ message = $Message; tree = $newTree.sha; parents = @($ExpectedHead) }
$updated = Send-Gh PATCH '/git/refs/heads/main' @{ sha = $commit.sha; force = $false }
Write-Output "Published main at $($updated.object.sha)"

