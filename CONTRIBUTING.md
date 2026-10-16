# Contributing

## Parser tests

Each diagram type has its own parser. We test these against Mermaid's parser specs and with differential fuzzing.

The tests compare accepted syntax and parsed diagram data. Find parser specs in `tests/compat/<type>/` and reasons for skipped cases in each directory's `SKIPPED.md`.

Run the library tests with `npm test`. Run `npm run test:website` after installing the website dependencies to check the playground.
