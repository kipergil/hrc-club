# xlhyperlinks — Excel hyperlink extractor

Reads an Excel workbook and prints, as plain text, the hyperlinks hiding inside cells:
the cell's visible text next to the URL it actually points at, keyed by an id column you
choose.

Two front ends over the same rules, producing byte-identical reports (with one
documented exception — see [Links built by a formula](#links-built-by-a-formula)):

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
Rows   : 4 — every row of rows 2–5

[row 2] P-1001
  C (Datasheet)
    text: Acme datasheet
    link: https://example.com/docs/acme-datasheet.pdf
  D (Drawing)
    text: DWG-1001
    link: https://example.com/dwg/1001.dwg  [HYPERLINK formula]

[row 3] P-1002
  ...
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
| `--links-only` | Leave out rows where no hyperlink was found. |
| `-y, --yes` | Never prompt; fail if something required is missing. |
| `--make-sample <path>` | Write a small demo workbook and exit. |

Columns are matched on header text first (case-insensitive, exact then unique
prefix), then as a column letter — `"Part No"`, `Datasheet` and `C` all work.

The report goes to stdout and the prompts and progress notes to stderr, so
`> links.tsv` captures the data and nothing else. With `--format tsv` (or `csv`)
you get one line per worksheet row — `Row, Id`, then a `text` and `link` pair per
chosen column — so it pastes back beside the original rows.

## What counts as a hyperlink

For each cell it takes the first of these that it finds, and says which one it
used when it isn't the obvious case:

1. **An embedded hyperlink** — what Ctrl+K creates, including one applied to a
   merged cell (stored against the merge's top-left cell).
2. **A `=HYPERLINK(target, label)` formula** — the cells Excel gives an *Open
   Hyperlink* but no *Edit Hyperlink* on, because the link is computed rather than
   stored. The target argument is evaluated, so a reference, a concatenation or a
   filled-down formula all resolve — see below.
3. **A URL sitting in the cell as plain text** — `https://`, `ftp://`, `mailto:`,
   `file://`, `www.` or a UNC path.

## Links built by a formula

A cell whose right-click menu offers *Open Hyperlink* but not *Edit Hyperlink* has no
link stored on it at all — a `=HYPERLINK()` formula computes one. The target is rarely a
plain string, so it is evaluated rather than just read:

| Formula | Target |
| --- | --- |
| `=HYPERLINK("https://x/1002.pdf","Doc")` | read straight out |
| `=HYPERLINK(B2,"Doc")` | the text of `B2` |
| `=HYPERLINK("https://x/"&B2&".pdf","Doc")` | concatenation, `&` |
| `=HYPERLINK(CONCATENATE("https://x/",A2),"Doc")` | `CONCATENATE()` and `CONCAT()` |
| `=HYPERLINK('Other sheet'!C7,"Doc")` | a reference to any sheet in the workbook |

A formula filled down a column is stored once and shared by the rest; both readers expand
that, so every row resolves to its own target.

**Where the two differ.** A target that needs the rest of the formula language —
`=HYPERLINK(VLOOKUP(A2,…),"Doc")`, an `IF`, an `INDEX/MATCH` — needs a formula engine.
The console app has one (ClosedXML's) and computes those; the browser has none and says
so rather than reporting no link:

```
  G (Lookup)
    text: Lookup 1002
    link: (not computed) =HYPERLINK(VLOOKUP(A2,$A$2:$B$5,2,FALSE), …)
```

The page also counts them above the report. This is the one case where the two front ends
give different answers — if a sheet leans on lookups for its links, use the console app.

## One record in, one record out

Every row of the sheet's data range is reported, in order, whether or not a link
was found in it — a row with nothing to show still appears, with `(none)` for the
link in the text report and empty fields in TSV and CSV. So the extract has
exactly as many records as the sheet has data rows, and lines up with it
row-for-row.

The header line says so outright: `Rows   : 20,000 — every row of rows 2–20001`.

Pass `--links-only` (or tick *Only rows that have a link* in the browser) when you
want just the rows that found something; the header line then reports both counts.

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
| 20,000 rows × 60 columns (14 MB) | 7.6–8.4s | ~0.1s |
| 100,000 rows × 12 columns (26 MB) | 9.3–10.2s | ~0.1s |

Ranges are three runs each; a single reading swings by a couple of seconds. Roughly half
of the earlier 16–22s, while reporting ~10% more rows than it used to. Most of what is
left is SheetJS parsing the file — the extraction itself is a fraction of a second. The
page says what it is doing while it works rather than sitting frozen.

Three things make that hold up, and they are worth knowing about:

- **The report on screen stops at 400 rows**, with a note saying how many were left out.
  The count beside the buttons is always the true total, and **Copy** and **Download**
  build the whole report — every row, a 10 MB text file for a 20k-row sheet, which is
  fine to copy and slow to render. The cap is a display limit, never a filter.
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
- A link target that needs a formula engine — a lookup, a condition — is reported as not
  computed rather than resolved. The console app resolves those.
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
