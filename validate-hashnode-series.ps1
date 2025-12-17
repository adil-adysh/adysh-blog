param (
  [string]$SchemaPath = "hashnode-schema.graphql",
  [string]$PostsPath = "posts"
)

Write-Host "🔍 Starting Hashnode API contract validation..." -ForegroundColor Cyan

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

function Dump-Type($type, $label) {
  Write-Host "`n🧯 DEBUG DUMP: $label" -ForegroundColor Yellow
  try {
    $type | ConvertTo-Json -Depth 10 | Write-Host
  }
  catch {
    Write-Host "(Failed to dump type as JSON)"
    Write-Host "Properties: $($type.PSObject.Properties.Name -join ', ')"
  }
}

# -------------------------
# 1️⃣ Load & parse schema
# -------------------------
if (-not (Test-Path $SchemaPath)) {
  Fail "Schema file not found: $SchemaPath"
}

$raw = Get-Content $SchemaPath -Raw
try {
  $json = $raw | ConvertFrom-Json -ErrorAction Stop
}
catch {
  Fail "Schema is not valid JSON (expected GraphQL introspection result)"
}

if (-not $json.__schema) {
  Fail "JSON does not contain __schema root"
}

$schema = $json.__schema
Pass "Schema loaded and parsed"

# -------------------------
# 2️⃣ Mutation validation
# -------------------------
$mutationType = $schema.types | Where-Object { $_.name -eq "Mutation" }
if (-not $mutationType) {
  Fail "Mutation type not found in schema"
}

$mutationNames = $mutationType.fields | ForEach-Object { $_.name }

$requiredMutations = @(
  "createSeries",
  "updateSeries",
  "removeSeries",
  "publishPost",
  "updatePost",
  "removePost",
  "addPostToSeries"
)

foreach ($m in $requiredMutations) {
  if ($mutationNames -notcontains $m) {
    Write-Host "Available mutations: $($mutationNames -join ', ')" -ForegroundColor Yellow
    Fail "Required mutation missing: $m"
  }
}

if ($mutationNames -match "^reorderSeries") {
  Fail "Forbidden reorderSeries mutation detected"
}

Pass "Mutations validated"

# -------------------------
# 3️⃣ Input validation helper
# -------------------------
function Validate-InputContract {
  param (
    [string]$TypeName,
    [string[]]$Required,
    [string[]]$Allowed
  )

  $type = $schema.types | Where-Object { $_.name -eq $TypeName -and $_.kind -eq "INPUT_OBJECT" }
  if (-not $type) {
    Fail "Input type not found: $TypeName"
  }

  $fields = $type.inputFields | ForEach-Object { $_.name }

  if (-not $fields -or $fields.Count -eq 0) {
    Dump-Type $type "$TypeName (no inputFields)"
    Fail "$TypeName has no input fields"
  }

  foreach ($r in $Required) {
    if ($fields -notcontains $r) {
      Write-Host "Detected fields: $($fields -join ', ')" -ForegroundColor Yellow
      Dump-Type $type "$TypeName (missing required field)"
      Fail "$TypeName missing required field: $r"
    }
  }

  $unexpected = $fields | Where-Object { $Allowed -notcontains $_ }
  if ($unexpected.Count -gt 0) {
    Write-Host "⚠️ Extra fields on $TypeName (allowed by API): $($unexpected -join ', ')" -ForegroundColor Yellow
  }

  Pass "$TypeName validated"
}

# -------------------------
# 4️⃣ Input contracts
# -------------------------
Validate-InputContract `
  -TypeName "CreateSeriesInput" `
  -Required @("name", "slug", "publicationId") `
  -Allowed  @("name", "slug", "publicationId", "descriptionMarkdown", "coverImage", "sortOrder")

Validate-InputContract `
  -TypeName "PublishPostInput" `
  -Required @("publicationId", "title", "contentMarkdown") `
  -Allowed  @("publicationId", "title", "contentMarkdown", "slug", "tags", "coverImageOptions", "seriesId", "settings")

Validate-InputContract `
  -TypeName "UpdatePostInput" `
  -Required @("id") `
  -Allowed  @("id", "title", "contentMarkdown", "slug", "tags", "coverImageOptions", "seriesId", "settings")

Validate-InputContract `
  -TypeName "RemovePostInput" `
  -Required @("id") `
  -Allowed  @("id")

Validate-InputContract `
  -TypeName "AddPostToSeriesInput" `
  -Required @("postId", "seriesId") `
  -Allowed  @("postId", "seriesId")

# -------------------------
# 4️⃣b Validate enum values
# -------------------------
function Validate-Enum {
  param (
    [string]$EnumName,
    [string[]]$RequiredValues
  )

  $enum = $schema.types | Where-Object { $_.name -eq $EnumName -and $_.kind -eq "ENUM" }
  if (-not $enum) {
    Fail "Enum not found: $EnumName"
  }

  $values = @()
  if ($enum.enumValues) {
    $values = $enum.enumValues | ForEach-Object { $_.name }
  }

  if (-not $values -or $values.Count -eq 0) {
    Dump-Type $enum "$EnumName (no enumValues)"
    Fail "$EnumName has no enum values"
  }

  foreach ($v in $RequiredValues) {
    if ($values -notcontains $v) {
      Write-Host "Detected enum values for ${EnumName}: $($values -join ', ')" -ForegroundColor Yellow
      Dump-Type $enum "$EnumName (missing required enum value)"
      Fail "$EnumName missing required value: $v"
    }
  }

  Pass "$EnumName enum validated"
}

Validate-Enum `
  -EnumName "SeriesSortOrder" `
  -RequiredValues @("OLDEST_FIRST", "NEWEST_FIRST")

# -------------------------
# 5️⃣ Cover image support
# -------------------------
$coverType = $schema.types | Where-Object { $_.name -eq "CoverImageOptionsInput" }
if (-not $coverType) {
  Fail "CoverImageOptionsInput not found"
}

$coverFields = $coverType.inputFields | ForEach-Object { $_.name }
if ($coverFields -notcontains "coverImageURL") {
  Dump-Type $coverType "CoverImageOptionsInput"
  Fail "coverImageURL missing in CoverImageOptionsInput"
}

Pass "Cover image contract validated"

# -------------------------
# 6️⃣ Repo structure validation
# -------------------------
$postsPersonal = Join-Path $PostsPath "personal"
if (-not (Test-Path $postsPersonal)) {
  Fail "posts/personal folder not found"
}

$seriesFolders = Get-ChildItem $postsPersonal -Directory |
Where-Object { Test-Path (Join-Path $_.FullName "_series.md") }

foreach ($folder in $seriesFolders) {
  Pass "Series detected: $($folder.Name)"

  $seriesFile = Join-Path $folder.FullName "_series.md"
  $content = Get-Content $seriesFile -Raw

  foreach ($required in @("name:", "slug:")) {
    if ($content -notmatch $required) {
      Fail "_series.md missing '$required' in $($folder.Name)"
    }
  }

  $posts = Get-ChildItem $folder.FullName -Filter "*.md" |
  Where-Object { $_.Name -ne "_series.md" } |
  Select-Object -ExpandProperty Name

  $sorted = $posts | Sort-Object
  if ($posts -ne $sorted) {
    Fail "Posts not numerically ordered in series: $($folder.Name)"
  }

  Pass "Series structure valid: $($folder.Name)"
}

# -------------------------
# ✅ Done
# -------------------------
Write-Host ""
Write-Host "🎉 Hashnode API contract VALIDATED." -ForegroundColor Green
Write-Host "   Safe to sync content." -ForegroundColor Green
