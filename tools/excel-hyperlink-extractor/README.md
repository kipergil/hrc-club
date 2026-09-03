# xlhyperlinks — Excel hyperlink extractor

A small C# console app that reads an Excel workbook and prints, as plain text, the
hyperlinks hiding inside cells: the cell's visible text next to the URL it actually
points at, keyed by an id column you choose.

It asks for whatever you don't pass on the command line, so running it with no
arguments walks you through the whole thing.

## Requirements

[.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) (or newer — bump
`TargetFramework` in the `.csproj` if you only have a later one).

## Run it

```bash
cd tools/excel-hyperlink-extractor
dotnet run
```

```
Excel file path: parts.xlsx
Header row [1, or 0 for none]:

Sheet 'Parts': rows 2-5, header row 1
  A   Item ID
  B   Name
  C   Datasheet  <- has hyperlinks
  D   Drawing  <- has hyperlinks

Id column (blank = use the row number): Item ID
Hyperlink column(s), comma separated [C,D]:
```

and out comes:

```
Excel hyperlinks
File   : /home/me/parts.xlsx
Sheet  : Parts
Id     : A (Item ID)
Links  : C (Datasheet), D (Drawing)
Rows   : 3 listed of 4 with data

[row 2] P-1001
  C (Datasheet)
    text: Acme datasheet
    link: https://example.com/docs/acme-datasheet.pdf
  D (Drawing)
    text: DWG-1001
    link: https://example.com/dwg/1001.dwg  [HYPERLINK formula]
```

Want a file to try it on first?

```bash
dotnet run -- --make-sample sample.xlsx
```

## Non-interactive

Every prompt has a matching option, and `-y` turns prompting off entirely:

```bash
dotnet run -- parts.xlsx -i "Part No" -l "Datasheet,Drawing" -o links.txt
dotnet run -- parts.xlsx -i A -l C,D --format tsv -y > links.tsv
```

| Option | What it does |
| --- | --- |
| `-f, --file <path>` | Workbook to read (`.xlsx` / `.xlsm`). Also accepted as a bare argument. |
| `-s, --sheet <name\|n>` | Worksheet by name or 1-based index. Defaults to the first. |
| `--header-row <n>` | Row holding the headers. Default `1`; `0` means no header row. |
| `-i, --id-column <col>` | Column reported as the id. Leave empty to use the row number. |
| `-l, --link-columns <c,c>` | Columns to pull hyperlinks from. Repeatable and comma-separated. |
| `-o, --out <path>` | Also write the report to a UTF-8 file. |
| `--format <fmt>` | `text` (default), `tsv` or `csv`. |
| `--all` | Include rows where no hyperlink was found. |
| `-y, --yes` | Never prompt; fail if something required is missing. |
| `--make-sample <path>` | Write a small demo workbook and exit. |

Columns are matched on header text first (case-insensitive, exact then unique
prefix), then as a column letter — `"Part No"`, `Datasheet` and `C` all work.

The report goes to stdout and the prompts and progress notes to stderr, so
`> links.tsv` captures the data and nothing else. With `--format tsv` (or `csv`)
each row is one line per hyperlink column: `Row, Id, Column, Cell, Text, Link,
Source` — paste straight back into a spreadsheet.

## What counts as a hyperlink

For each cell it takes the first of these that it finds, and says which one it
used when it isn't the obvious case:

1. **An embedded hyperlink** — what Ctrl+K creates, including one applied to a
   merged cell (stored against the merge's top-left cell).
2. **A `=HYPERLINK("target", "text")` formula** — the literal target is read
   straight out of the formula. A computed target (a cell reference, a
   concatenation) would need the workbook recalculated, so it is reported as no
   link rather than guessed at.
3. **A URL sitting in the cell as plain text** — `https://`, `ftp://`, `mailto:`,
   `file://`, `www.` or a UNC path.

Rows with no hyperlink in any chosen column are left out unless you pass `--all`.

Reading is done with [ClosedXML](https://github.com/ClosedXML/ClosedXML), so
`.xlsx` and `.xlsm` work; a legacy `.xls` has to be re-saved as `.xlsx` first.

## Layout

| File | |
| --- | --- |
| `Program.cs` | Flow and the interactive prompts. |
| `Options.cs` | Command-line parsing and help text. |
| `SheetLayout.cs` | Used range, headers, and turning what you typed into a column. |
| `HyperlinkExtractor.cs` | Reading the link out of a cell. |
| `ReportWriter.cs` | The text, TSV and CSV renderings. |
| `SampleWorkbook.cs` | The `--make-sample` demo file. |
