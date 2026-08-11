@validation @feature-4 @feature-5
Feature: Attribute Validation, Provenance Gates, and Retry Iteration
  As the Validation Engine
  I want to verify provenance coverage (Gate 2), derived attribute integrity (Gate 3), and manage enrichment and critique loops
  So that unverified or invalid extractions are either corrected via iteration or flagged for review

  Background:
    Given a document has successfully completed extraction and category agent evaluation

  @gate-2
  Scenario Outline: Verify Gate 2 provenance coverage for extracted attributes
    Given an extracted attribute "<attribute_id>" has evidence type "<evidence_type>"
    When Gate 2 provenance coverage is evaluated
    Then the gate result should be "<gate_result>"

    Examples:
      | attribute_id | evidence_type | gate_result |
      | attr_001     | SOURCE        | PASS        |
      | attr_002     | RULE          | PASS        |
      | attr_003     | DERIVED       | PASS        |
      | attr_004     | NONE          | FAIL        |

  @gate-3
  Scenario: Verify Gate 3 derived attribute integrity
    Given a derived attribute "attr_derived_01" has a valid rule ID "RULE_UNIT_CONVERSION"
    And all associated validation reports for "attr_derived_01" have passed
    When Gate 3 derived attribute integrity is evaluated
    Then Gate 3 evaluation passes

  @router-validator @critic-loop
  Scenario: Critical validation failure routes payload to critic agent and increments retry counter
    Given an attribute set exhibits critical validation failures
    And the current "retry_count" is 1
    When the validator router processes the failure
    Then the payload should be routed to "critic_agent"
    And the critic agent should increment "retry_count" from 1 to 2

  @router-validator @enrichment-loop
  Scenario: High-confidence validated document triggers enrichment re-validation loop
    Given a document has no critical validation failures
    And the category confidence is 0.95
    And "has_been_enriched" is false
    When the validator router evaluates the payload state
    Then the payload should be routed to "enricher_agent"
    When the enricher agent completes processing and sets "has_been_enriched" to true
    Then the enricher router must route the payload back to "validator_agent" for mandatory re-validation