# AI Roadmap

AI should make parent curation easier. It should not independently decide what a
child sees.

## Near-Term AI Uses

Useful AI-assisted workflows:

- review a config file for mistakes
- explain why a channel ID is invalid
- summarize what a proposed code change affects
- generate tests for feed policy
- draft parent-facing release notes
- propose safer wording for child-facing status messages
- identify YouTube API quota risks in a design

## Parent Curation Assistant

Future AI features could help parents:

- summarize a channel's themes
- flag possible age concerns
- suggest categories and tags
- suggest videos to pin
- suggest videos to block
- explain why a channel may not fit the child's profile
- create draft config changes

All changes should require parent review before affecting the child viewer.

## Recommendation Engine Direction

If recommendations are added later, prefer this model:

1. AI suggests content to the parent.
2. Parent approves, rejects, pins, blocks, or tags suggestions.
3. Approved config changes are versioned.
4. The child app consumes only approved config.

Avoid:

- direct recommendations to the child
- black-box scoring with no parent explanation
- using sensitive child profiling without an explicit privacy design
- collecting more child viewing data than needed

## Technical Building Blocks

Potential future components:

- content metadata cache
- channel review queue
- parent approval workflow
- config version history
- audit log
- YouTube quota manager
- AI explanation records
- policy test suite for recommendation rules

Do not build these components until there is an explicit implementation request
and a PRD for that phase.

## Evaluation Questions

Before shipping any AI feature, answer:

- What decision is AI making or assisting?
- Can the parent override it?
- Is the explanation understandable?
- What data is stored?
- How long is the data retained?
- Could the child see unapproved content because of this feature?
- Does it comply with YouTube policies and child privacy expectations?
