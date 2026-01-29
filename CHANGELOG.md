# Change Log

All notable changes to the "sql2es" extension will be documented in this file.

## [0.0.4] - 2026-01-29

### Added

- **History Record Management**: Added full-featured conversion history management
  - WebView-based history viewer with table display, search, type filter, and pagination
  - Support for copying SQL/Result, viewing in new tab, and deleting records
  - **Edit Functionality**: Allow manual correction of inaccurate AI conversion results

### Fixed

- Fixed command palette translation not working due to incorrect `l10n` configuration

## [0.0.3] - 2025-08-14

- Bugfix when AI model return ES DSL with ` ```json ``` ` wrapped

## [0.0.2] - 2025-08-13

- Bugfix & impove i18n translation

## [0.0.1] - 2025-08-13

- Initial release
- Added SQL to Elasticsearch conversion functionality
- Added support for command palette and context menu conversion
- Added configurable AI model settings
- Added formatted output for Elasticsearch queries
- Added multi-language support (English and Chinese)
