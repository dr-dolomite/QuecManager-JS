# Version Matching Logic

## Overview
The release notes display uses conditional version normalization based on package type (BETA vs STABLE) to correctly match installed versions with GitHub release tags.

## Package Types

### BETA Packages
- **Installed Version Format**: `2.3.3`
- **GitHub Tag Format**: `v2.3-beta.3`
- **Normalization**: Converts dots to dash-beta format
  - `2.3.3` → `2.3-beta.3`
  - `v2.3-beta.3` → `2.3-beta.3`
- **Match**: ✅ Both normalize to `2.3-beta.3`

### STABLE Packages
- **Installed Version Format**: `2.3.3`
- **GitHub Tag Format**: `v2.3.3`
- **Normalization**: No beta conversion
  - `2.3.3` → `2.3.3`
  - `v2.3.3` → `2.3.3`
- **Match**: ✅ Both normalize to `2.3.3`

## Implementation

### Component Props
```typescript
interface UpdateReleaseNotesProps {
  releases: GitHubRelease[];
  isLoading: boolean;
  installedVersion: string | undefined;
  packageType: "stable" | "beta" | undefined;  // 👈 New prop
}
```

### Normalization Function
```typescript
const normalizeVersion = (version: string) => {
  let normalized = version
    .replace(/^v/, "")    // Remove v prefix
    .trim()
    .toLowerCase();
  
  // Only convert to beta format for BETA packages
  if (packageType === "beta" && !normalized.includes("-beta")) {
    normalized = normalized.replace(/\.(\d+)$/, "-beta.$1");
  }
  
  return normalized;
};
```

## Examples

### BETA Package Scenario
```
Package Type: beta
Installed: 2.3.3
GitHub Tags: ["v2.3-beta.4", "v2.3-beta.3", "v2.3-beta.2"]

Normalization:
- 2.3.3 → 2.3-beta.3
- v2.3-beta.3 → 2.3-beta.3

✅ Match found: v2.3-beta.3
Releases shown:
1. v2.3-beta.4 (Latest)
2. v2.3-beta.3 (Installed)
```

### STABLE Package Scenario
```
Package Type: stable
Installed: 2.3.3
GitHub Tags: ["v2.3.4", "v2.3.3", "v2.3.2"]

Normalization:
- 2.3.3 → 2.3.3 (no beta conversion)
- v2.3.3 → 2.3.3

✅ Match found: v2.3.3
Releases shown:
1. v2.3.4 (Latest)
2. v2.3.3 (Installed)
```

## Debug Logging
The component logs version matching details to browser console:
```javascript
[UpdateReleaseNotes] Package type: beta
[UpdateReleaseNotes] Raw installed version: 2.3.3
[UpdateReleaseNotes] Normalized installed: 2.3-beta.3
[UpdateReleaseNotes] Available releases: [
  { tag: "v2.3-beta.4", normalized: "2.3-beta.4" },
  { tag: "v2.3-beta.3", normalized: "2.3-beta.3" }
]
[UpdateReleaseNotes] ✅ Match found: { ... }
[UpdateReleaseNotes] Current release: v2.3-beta.3
[UpdateReleaseNotes] Releases to show: ["v2.3-beta.4", "v2.3-beta.3"]
```

## Related Files
- `components/settings/update-release-notes.tsx` - Version normalization logic
- `components/settings/quecmanager-update.tsx` - Package info and props passing
- `scripts/cgi-bin/quecmanager/settings/check_package_info.sh` - Package type detection
