# Spec Delta

## Purpose

Provide consistent release information when repository releases are tagged.

## ADDED Requirements

### Requirement: Categorized release notes
The system SHALL generate categorized release notes from eligible merged pull requests for every tagged release.

#### Scenario: Eligible changes exist
- **WHEN** a release is tagged with eligible merged pull requests
- **THEN** the release contains notes grouped by configured category

#### Scenario: No eligible changes exist
- **WHEN** a release is tagged without eligible merged pull requests
- **THEN** the release contains an explicit message that no eligible changes were found