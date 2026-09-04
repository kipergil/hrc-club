namespace ExcelHyperlinkExtractor;

internal enum OutputFormat
{
    Text,
    Tsv,
    Csv,
}

/// <summary>
/// Command line options. Anything left unset is asked for interactively.
/// </summary>
internal sealed class Options
{
    public string? File { get; set; }
    public string? Sheet { get; set; }
    public int? HeaderRow { get; set; }
    public string? IdColumn { get; set; }
    public List<string> LinkColumns { get; } = new();
    public string? OutPath { get; set; }
    public OutputFormat Format { get; set; } = OutputFormat.Text;
    public bool LinksOnly { get; set; }
    public bool NonInteractive { get; set; }
    public bool ShowHelp { get; set; }
    public string? MakeSamplePath { get; set; }

    public static Options Parse(string[] args)
    {
        var options = new Options();

        for (var i = 0; i < args.Length; i++)
        {
            var arg = args[i];

            string NextValue()
            {
                if (i + 1 >= args.Length)
                {
                    throw new OptionException($"Option '{arg}' needs a value.");
                }

                return args[++i];
            }

            switch (arg)
            {
                case "-h":
                case "--help":
                    options.ShowHelp = true;
                    break;
                case "-f":
                case "--file":
                    options.File = NextValue();
                    break;
                case "-s":
                case "--sheet":
                    options.Sheet = NextValue();
                    break;
                case "--header-row":
                    var headerRowText = NextValue();
                    if (!int.TryParse(headerRowText, out var headerRow) || headerRow < 0)
                    {
                        throw new OptionException($"'{headerRowText}' is not a valid header row (use 0 for no header row).");
                    }

                    options.HeaderRow = headerRow;
                    break;
                case "-i":
                case "--id-column":
                    options.IdColumn = NextValue();
                    break;
                case "-l":
                case "--link-columns":
                    options.LinkColumns.AddRange(SplitList(NextValue()));
                    break;
                case "-o":
                case "--out":
                    options.OutPath = NextValue();
                    break;
                case "--format":
                    var formatText = NextValue();
                    options.Format = formatText.ToLowerInvariant() switch
                    {
                        "text" or "txt" => OutputFormat.Text,
                        "tsv" => OutputFormat.Tsv,
                        "csv" => OutputFormat.Csv,
                        _ => throw new OptionException($"Unknown format '{formatText}'. Use text, tsv or csv."),
                    };
                    break;
                case "--links-only":
                    options.LinksOnly = true;
                    break;
                case "-y":
                case "--yes":
                    options.NonInteractive = true;
                    break;
                case "--make-sample":
                    options.MakeSamplePath = NextValue();
                    break;
                default:
                    if (arg.StartsWith('-'))
                    {
                        throw new OptionException($"Unknown option '{arg}'. Run with --help to see the available options.");
                    }

                    if (options.File is not null)
                    {
                        throw new OptionException($"Unexpected argument '{arg}'. Only one workbook path is accepted.");
                    }

                    options.File = arg;
                    break;
            }
        }

        return options;
    }

    public static IEnumerable<string> SplitList(string value) =>
        value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    public const string HelpText = """
        xlhyperlinks - list the hyperlinks embedded in Excel cells as plain text.

        Usage:
          xlhyperlinks [workbook.xlsx] [options]

        Anything you leave out is asked for interactively, so plain
        `xlhyperlinks` walks you through it.

        Options:
          -f, --file <path>        Workbook to read (.xlsx / .xlsm).
          -s, --sheet <name|n>     Worksheet by name or 1-based index.
              --header-row <n>     Row holding the column headers (default 1, 0 = none).
          -i, --id-column <col>    Column to report as the id. A header name or a
                                   column letter; empty means "use the row number".
          -l, --link-columns <c,c> Columns to pull hyperlinks from. Repeatable and
                                   comma-separated, header names or column letters.
          -o, --out <path>         Also write the report to this file (UTF-8).
              --format <fmt>       text (default), tsv or csv.
              --links-only         Leave out rows where no hyperlink was found.
          -y, --yes                Never prompt; fail if something required is missing.
              --make-sample <path> Write a small demo workbook and exit.
          -h, --help               Show this help.

        Columns are matched against the header text first (case-insensitive), then
        as a column letter. Hyperlinks are read from real embedded links first,
        then HYPERLINK() formulas, then cells whose text is itself a URL. A
        formula target is evaluated, so references, concatenations and lookups
        all resolve to the link they build.

        Every row of the sheet's data range is reported, with empty values where a
        row has no link, so the output stays row-for-row with the sheet. TSV and CSV
        give one line per row: row, id, then a text and link pair per column.

        Examples:
          xlhyperlinks parts.xlsx
          xlhyperlinks parts.xlsx -i "Part No" -l "Datasheet,Drawing" -o links.txt
          xlhyperlinks parts.xlsx -i A -l C,D --format tsv -y > links.tsv
        """;
}

internal sealed class OptionException : Exception
{
    public OptionException(string message) : base(message)
    {
    }
}
