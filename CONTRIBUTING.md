# Contributing Plant Knowledge Data

Thank you for helping grow Jninty's built-in plant knowledge base! This guide covers how to contribute plant data via GitHub pull requests.

## How It Works

Built-in plant data lives in JSON files under `data/plants/`:

| File | Contents |
|------|----------|
| `data/plants/vegetables.json` | Vegetables |
| `data/plants/herbs.json` | Herbs |
| `data/plants/fruits.json` | Fruits & berries |
| `data/plants/flowers.json` | Flowers & ornamentals |

Each file contains an array of plant knowledge entries validated against a strict Zod schema at build time.

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `species` | string | Scientific/Latin name (e.g. `"Solanum lycopersicum"`) |
| `commonName` | string | Common name (e.g. `"Tomato"`) |
| `plantType` | enum | One of: `vegetable`, `herb`, `flower`, `ornamental`, `fruit_tree`, `berry`, `other` |
| `isPerennial` | boolean | `true` if the plant is perennial |
| `sunNeeds` | enum | One of: `full_sun`, `partial_shade`, `full_shade` |
| `waterNeeds` | enum | One of: `low`, `moderate`, `high` |

## Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `variety` | string | Cultivar or variety name |
| `soilPreference` | string | Preferred soil type |
| `growthRate` | enum | `slow`, `moderate`, or `fast` |
| `spacingInches` | integer | Plant spacing in inches |
| `matureHeightInches` | integer | Mature height in inches |
| `matureSpreadInches` | integer | Mature spread in inches |
| `indoorStartWeeksBeforeLastFrost` | integer | Weeks before last frost to start indoors |
| `transplantWeeksAfterLastFrost` | integer | Weeks after last frost to transplant |
| `directSowWeeksBeforeLastFrost` | integer | Weeks before last frost to direct sow |
| `directSowWeeksAfterLastFrost` | integer | Weeks after last frost to direct sow |
| `daysToGermination` | integer (>0) | Days to germination |
| `daysToMaturity` | integer (>0) | Days to maturity |
| `goodCompanions` | string[] | List of good companion plant common names |
| `badCompanions` | string[] | List of bad companion plant common names |
| `commonPests` | string[] | List of common pests |
| `commonDiseases` | string[] | List of common diseases |

## Example Entries

### Minimal entry

```json
{
  "species": "Ocimum basilicum",
  "commonName": "Basil",
  "plantType": "herb",
  "isPerennial": false,
  "sunNeeds": "full_sun",
  "waterNeeds": "moderate"
}
```

### Full entry

```json
{
  "species": "Solanum lycopersicum",
  "variety": "Roma",
  "commonName": "Roma Tomato",
  "plantType": "vegetable",
  "isPerennial": false,
  "sunNeeds": "full_sun",
  "waterNeeds": "moderate",
  "soilPreference": "Well-drained, slightly acidic (pH 6.0-6.8)",
  "growthRate": "moderate",
  "spacingInches": 24,
  "matureHeightInches": 48,
  "matureSpreadInches": 24,
  "indoorStartWeeksBeforeLastFrost": 6,
  "transplantWeeksAfterLastFrost": 2,
  "daysToGermination": 7,
  "daysToMaturity": 75,
  "goodCompanions": ["Basil", "Carrots", "Marigold", "Parsley"],
  "badCompanions": ["Brassicas", "Fennel", "Dill"],
  "commonPests": ["Aphids", "Tomato Hornworm", "Whiteflies"],
  "commonDiseases": ["Blight", "Fusarium Wilt", "Blossom End Rot"]
}
```

## Submitting a PR

1. Fork this repository
2. Add or update entries in the appropriate `data/plants/*.json` file
3. Run `npm run test` to verify your entries pass schema validation
4. Submit a pull request with a clear description of what was added/changed

## Guidelines

- Use accepted scientific names for the `species` field
- Use title case for `commonName` (e.g. "Cherry Tomato", not "cherry tomato")
- Companion plant names in `goodCompanions`/`badCompanions` should use common names matching other entries' `commonName` where possible
- Cite your data sources in the PR description (seed catalogs, university extension guides, etc.)
- Timing data (weeks before/after frost) should reflect general temperate-zone guidance
- One entry per species/variety combination — don't duplicate
