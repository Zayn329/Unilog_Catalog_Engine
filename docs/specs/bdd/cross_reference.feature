@cross-referencing @feature-8 @security
Feature: Gate 8 Human Lock Integrity & Provenance Cross-Referencing
  As the Safety & Governance Engine
  I want to detect and prevent unauthorized agent modifications to human-verified attributes
  So that human edits remain immutable while allowing provenance tracing across evidence types

  @gate-8 @human-lock
  Scenario: Agent mutation on human-locked value triggers Gate 8 failure
    Given a human reviewer locked attribute "dimensions" with value "0.5 IN"
    And the system recorded an initial locked-state hash snapshot
    When an autonomous agent attempts to mutate the attribute value to "0.75 IN"
    And the system recomputes the locked-state hash snapshot for the mutated attribute
    Then the recomputed hash should not match the initial locked-state hash snapshot
    And Gate 8 human lock integrity evaluation must fail
    And the system must hard block the execution
    And the human-locked value "0.5 IN" must be preserved without applying agent mutation

  @provenance-cross-reference
  Scenario Outline: Validate complete provenance chain for cross-referenced attributes
    Given an attribute "<attr_id>" is cross-referenced during review
    Then the evidence schema must contain valid metadata for "<evidence_type>"

    Examples:
      | attr_id  | evidence_type |
      | attr_101 | SOURCE        |
      | attr_102 | RULE          |
      | attr_103 | DERIVED       |