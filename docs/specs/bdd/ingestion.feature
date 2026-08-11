@ingestion @feature-1 @feature-2
Feature: Document Ingestion & Categorization Routing
  As the Extraction Pipeline System
  I want to parse incoming documents and route them based on parsing status and category confidence
  So that invalid files are caught early at Gate 1 and unclassified documents are safely quarantined for human review

  @gate-1 @router-parser
  Scenario: Document passes Gate 1 parsing and routes to category agent
    Given a document is submitted to the ingestion pipeline
    When the parser attempts to extract structured content
    Then the parse status should be "SUCCESS"
    And Gate 1 parsing completion evaluation passes
    And the parser router should direct the payload to "category_agent"

  @gate-1 @router-parser @terminal
  Scenario: Document fails Gate 1 parsing and terminates execution
    Given a malformed or unreadable document is submitted to the pipeline
    When the parser attempts to extract structured content
    Then the parse status should be "FAILED"
    And Gate 1 parsing completion evaluation fails
    And the parser router should direct the payload to "END"
    And the final pipeline terminal status should be "FAILED_PARSING"

  @router-category
  Scenario Outline: Category router directs payload based on confidence threshold
    Given a document has been successfully categorized with a confidence score of <confidence>
    When the category router evaluates the document state
    Then the payload should be routed to "<expected_target>"
    And the terminal status should be "<terminal_status>"

    Examples:
      | confidence | expected_target  | terminal_status            |
      | 0.85       | extractor_agent  | N/A                        |
      | 0.60       | extractor_agent  | N/A                        |
      | 0.59       | END              | UNCLASSIFIED_HUMAN_REVIEW  |
      | 0.45       | END              | UNCLASSIFIED_HUMAN_REVIEW  |