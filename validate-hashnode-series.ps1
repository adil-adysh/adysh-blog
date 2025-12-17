param (
  [string]$SchemaPath = "hashnode-schema.graphql",
  [string]$PostsPath  = "posts"
)

Write-Host "🔍 Starting Hashnode final validation..." -ForegroundColor Cyan

# -------------------------
# Helpers
# -------------------------
function Fail($msg) {
  Write-Host "❌ $msg" -ForegroundColor Red
  exit 1
}

function Pass($msg) {
  Write-Host "✅ $msg" -ForegroundColor Green
}

# -------------------------
# 1️⃣ Validate schema exists
# -------------------------
if (-not (Test-Path $SchemaPath)) {
  Fail "Schema file not found: $SchemaPath"
}
Pass "Schema file found"

$raw = Get-Content $SchemaPath -Raw

# Try to parse introspection JSON, otherwise treat as raw text
$isJson = $false
try {
  $json = $raw | ConvertFrom-Json -ErrorAction Stop
  if ($json -and $json.__schema) { $isJson = $true }
} catch { $isJson = $false }

if ($isJson) {
  $schema = $json.__schema
} else {
  $schema = $raw
}

# -------------------------
# 2️⃣ Validate required mutations
# -------------------------
$requiredMutations = @(
  "createSeries",
  "updateSeries",
  "removeSeries",
  "publishPost",
  "updatePost",
  "removePost",
  "addPostToSeries"
)

if ($isJson) {
  $mutationType = $schema.types | Where-Object { $_.name -eq 'Mutation' }
  $mutationFields = @()
  if ($mutationType -and $mutationType.fields) {
    $mutationFields = $mutationType.fields | ForEach-Object { $_.name }
  }

  foreach ($m in $requiredMutations) {
    if ($mutationFields -notcontains $m) {
      Fail "Required mutation missing in schema: $m"
    }
  }
} else {
  foreach ($m in $requiredMutations) {
    if ($schema -notmatch "\b$m\b") {
      Fail "Required mutation missing in schema: $m"
    }
  }
}
Pass "All required mutations exist"

# -------------------------
# 3️⃣ Ensure NO reorder mutation exists
# -------------------------
if ($isJson) {
  $hasReorder = $false
  if ($mutationFields) { $hasReorder = ($mutationFields -contains 'reorderSeries') }
  if ($hasReorder) { Fail "Found reorderSeries mutation — design assumption violated" }
} else {
  if ($schema -match "reorderSeries") { Fail "Found reorderSeries mutation — design assumption violated" }
}
Pass "No reorder mutation (append-only ordering confirmed)"

# -------------------------
# 4️⃣ Validate CreateSeriesInput fields
# -------------------------
$expectedSeriesFields = @(
  "title:",
  "slug:",
  "description:",
  "coverImage:"
)

if ($isJson) {
  $inputType = $schema.types | Where-Object { $_.name -eq 'CreateSeriesInput' -and $_.kind -like '*INPUT*' }
  if (-not $inputType) {
    Write-Host "Unable to find 'CreateSeriesInput' in schema. Listing candidate input types and their fields for diagnosis:`n" -ForegroundColor Yellow
    $candidates = $schema.types | Where-Object { $_.kind -match 'INPUT_OBJECT' } | Select-Object name,inputFields
    foreach ($c in $candidates) {
      Write-Host "- $($c.name)"
      if ($c.inputFields) {
        $names = $c.inputFields | ForEach-Object { $_.name } | Sort-Object
        Write-Host "    fields: $($names -join ', ')"
      }
    }
    Fail "CreateSeriesInput type not found in schema"
  }
  # Some introspection outputs put input fields under 'inputFields', others under 'fields'.
  $inputFieldNames = @()
  $inputFieldObjs = $null
  if ($inputType.PSObject.Properties.Name -contains 'inputFields') { $inputFieldObjs = $inputType.inputFields }
  if (-not $inputFieldObjs -and $inputType.PSObject.Properties.Name -contains 'fields') { $inputFieldObjs = $inputType.fields }

  if ($inputFieldObjs) {
    # Each field object typically has a 'name' property
    $inputFieldNames = $inputFieldObjs | ForEach-Object { $_.name } | Where-Object { $_ }
  }

  if (-not $inputFieldNames -or $inputFieldNames.Count -eq 0) {
    Write-Host "CreateSeriesInput exists but contains no discoverable input fields. Dumping the type object for diagnosis:" -ForegroundColor Yellow
    try {
      $jsonDump = $inputType | ConvertTo-Json -Depth 8
      Write-Host $jsonDump
    } catch {
      Write-Host "(failed to convert type object to JSON)" -ForegroundColor Yellow
    }
    Write-Host "Type object properties: $($inputType.PSObject.Properties.Name -join ', ')" -ForegroundColor Yellow
    Fail "CreateSeriesInput missing fields (no inputFields present)"
  }
  foreach ($field in $expectedSeriesFields) {
    $f = $field.TrimEnd(':')
    if ($inputFieldNames -notcontains $f) {
      Write-Host "Detected fields on CreateSeriesInput: $($inputFieldNames -join ', ')" -ForegroundColor Yellow
      Fail "CreateSeriesInput missing field: $f"
    }
  }
} else {
  $seriesInputBlock = ($schema | Select-String "input CreateSeriesInput" -Context 0,40).Context.PostContext
  foreach ($field in $expectedSeriesFields) {
    if ($seriesInputBlock -notmatch $field) {
      Fail "CreateSeriesInput missing field: $field"
    }
  }
}
Pass "CreateSeriesInput fields validated"

# -------------------------
# 5️⃣ Validate cover image field
# -------------------------
if ($isJson) {
  $coverFound = $false
  $coverType = $schema.types | Where-Object { $_.name -match 'CoverImageOptionsInput' -or $_.name -match 'CoverImageOptions' }
  if ($coverType -and $coverType.inputFields) {
    $coverFound = ($coverType.inputFields | ForEach-Object { $_.name }) -contains 'coverImageURL'
  }
  if (-not $coverFound) { Fail "coverImageURL not found in CoverImageOptionsInput" }
} else {
  if ($schema -notmatch "coverImageURL") { Fail "coverImageURL not found in CoverImageOptionsInput" }
}
Pass "Cover image field verified (coverImageURL)"

# -------------------------
# 6️⃣ Validate posts folder exists
# -------------------------
if (-not (Test-Path $PostsPath)) {
  Fail "Posts folder not found: $PostsPath"
}
Pass "Posts folder found"

# -------------------------
# 7️⃣ Validate series folders
# -------------------------
# Normalize posts path for cross-platform
$postsPersonal = Join-Path -Path $PostsPath -ChildPath 'personal'
$seriesFolders = Get-ChildItem $postsPersonal -Directory |
  Where-Object { Test-Path (Join-Path $_.FullName '_series.md') }

foreach ($folder in $seriesFolders) {
  Pass "Series detected: $($folder.Name)"

  $seriesFile = "$($folder.FullName)\_series.md"
  $content = Get-Content $seriesFile -Raw

  foreach ($required in @("title:", "slug:")) {
    if ($content -notmatch $required) {
      Fail "_series.md missing '$required' in $($folder.Name)"
    }
  }

  # Validate numeric ordering
  $files = Get-ChildItem $folder.FullName -Filter "*.md" |
    Where-Object { $_.Name -ne "_series.md" } |
    Select-Object -ExpandProperty Name

  $ordered = $files | Sort-Object
  if ($files -ne $ordered) {
    Fail "Files not ordered numerically in series: $($folder.Name)"
  }

  Pass "Series structure valid: $($folder.Name)"
}

# -------------------------
# 8️⃣ Final notice about display order
# -------------------------
Write-Host ""
Write-Host "ℹ️  Reminder:" -ForegroundColor Yellow
Write-Host "   Series display order (oldest/newest first) is UI-only."
Write-Host "   Ensure it is set correctly in Hashnode UI."
Write-Host ""

# -------------------------
# ✅ Done
# -------------------------
Write-Host "🎉 Final validation PASSED. Safe to sync with Hashnode." -ForegroundColor Cyan
