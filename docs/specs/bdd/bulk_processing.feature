@bulk-processing @feature-7 @workbench
Feature: Review Workbench Operations & Publication Authority
  As a Human Reviewer on the HITL Workbench
  I want to save drafts and submit reviewed items
  So that draft persistence is decoupled from publication routing and validation errors block publication while keeping items in my queue

  @workbench @draft-save
  Scenario: Save draft persists record without invoking confidence routers
    Given a reviewer edits an item on the workbench
    When the reviewer executes the "SAVE_DRAFT" action
    Then the record payload should be saved to "Review Service / PostgreSQL"
    And the confidence router must NOT be invoked
    And no publication event should be emitted

  @workbench @submit-success
  Scenario: Successful review submission passes validation and publishes item
    Given a reviewer completes edits on an item
    And there are no critical validation errors
    And all mandatory publication gates pass
    When the reviewer executes the "ACCEPT_AND_SUBMIT" action
    Then the payload should pass through the validator agent
    And the confidence router should assign final status "PUBLISHED"

  @workbench @submit-failure
  Scenario: Review submission with validation failure retains item in review queue
    Given a reviewer submits edits on an item that triggers a critical validation error
    When the reviewer executes the "ACCEPT_AND_SUBMIT" action
    Then the validator agent detects the failure
    And the assigned status must remain "REVIEW_REQUIRED"
    And active validation error messages must be displayed on screen for immediate correction