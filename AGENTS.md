# Instructions for coding agents

Read **[`CONVENTIONS.md`](CONVENTIONS.md)** before writing any code in this repository, and follow it.

It defines language, naming, the domain glossary, testing requirements, and the project-specific rules. It takes precedence over your default style and over any provider-specific defaults.

Two rules worth knowing before you touch anything:

1. **Never add data files to git.** No `.parquet`, `.csv`, or `.xlsx`, on any path. The competition rules forbid redistributing the dataset.
2. **Never display a number that has no run behind it.** Every figure in the UI, deck, or report traces to an MLflow run or to `analysis/evidence.py`.

Project context lives in [`docs/`](docs/) — start with `00-PRODUCTO.md`.
