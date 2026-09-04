# xlhyperlinks — Excel hyperlink extractor

Reads an Excel workbook and prints, as plain text, the hyperlinks hiding inside cells:
the cell's visible text next to the URL it actually points at, keyed by an id column you
choose.

Two front ends over the same rules, producing byte-identical reports:

- **`xlhyperlinks`** — the C# console app in this folder. Interactive, or scriptable.
- **[`web/index.html`](web/index.html)** — the same thing as a page. Open the file in a
  browser, drop a workbook on it, pick the columns. It parses the file in the browser
  with [SheetJS](https://sheetjs.com); nothing is uploaded and there is no server.

The console app asks for whatever you don't pass on the command line, so running it with
no arguments walks you through the whole thing.

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

## The web version

`web/index.html` is one self-contained page — open it from disk, or serve it from
anywhere; there is no build step and no back end. It loads with the same demo workbook
`--make-sample` writes (embedded as base64) so it opens on a working example, and reading
a real file never leaves the browser.

### Running it with no network

Opening the file is all it takes, but the page fetches SheetJS from cdnjs on load, so the
first open needs a connection (offline, it says so instead of hanging). To make it fully
self-contained, save the library beside the page and point the tag at it:

```bash
cd tools/excel-hyperlink-extractor/web
curl -O https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
```

then in `index.html` change

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
```

to

```html
<script src="xlsx.full.min.js"></script>
```

The two files together then work with no network at all. Keep the CDN URL if you publish
the page anywhere that needs the single-file version.

### Large workbooks

Measured in Chromium on two generated workbooks of 1.2 million cells each:

| Workbook | Open it | Switch format |
| --- | --- | --- |
| 20,000 rows × 60 columns (14 MB) | ~6s | ~0.1s |
| 100,000 rows × 12 columns (26 MB) | ~9s | ~0.1s |

Most of that is SheetJS parsing the file; the extraction itself is a fraction of a second.
The page says what it is doing while it works rather than sitting frozen.

Three things make that hold up, and they are worth knowing about:

- **The report on screen stops at 400 rows**, with a note saying how many were left out.
  The count beside the buttons is always the true total, and **Copy** and **Download**
  build the whole report — a 20k-row extract is a 10 MB text file, which is fine to copy
  and slow to render. 
- **Links are counted by walking the cells the sheet actually holds**, not every
  row × column coordinate in its used range. On a wide sheet most of that rectangle is
  empty, and looking each one up costs more than the whole rest of the pass.
- **Merges are indexed by row when the file is opened.** Checking a cell against every
  merge in the sheet turns a few thousand merges into millions of comparisons.

Very large files are still bounded by browser memory: the workbook, the parsed cells and
the report all live in the tab at once. A sheet in the millions of rows is better handled
by the console app, which is not competing with a renderer for the same address space.

### Differences from the console app

Two, both forced by the browser:

- SheetJS reads the workbook as saved, so a `=HYPERLINK()` cell that was never
  recalculated has no cached text. The label argument of the formula is used instead,
  which is what Excel would be showing.
- **Download** saves the report when the page can reach a save surface — served on its
  own, that is the browser; embedded in a viewer, the host handles it. **Copy** always
  works.

To refresh the embedded sample after changing `SampleWorkbook.cs`, regenerate the
workbook and swap the base64 in `SAMPLE_B64`:

```bash
dotnet run -- --make-sample sample.xlsx && base64 -w0 sample.xlsx
```

## Layout

| File | |
| --- | --- |
| `Program.cs` | Flow and the interactive prompts. |
| `Options.cs` | Command-line parsing and help text. |
| `SheetLayout.cs` | Used range, headers, and turning what you typed into a column. |
| `HyperlinkExtractor.cs` | Reading the link out of a cell. |
| `ReportWriter.cs` | The text, TSV and CSV renderings. |
| `SampleWorkbook.cs` | The `--make-sample` demo file. |
| `web/index.html` | The browser version — the same rules in one page. |
