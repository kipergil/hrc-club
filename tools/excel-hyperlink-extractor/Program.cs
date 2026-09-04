using System.Text;
using ClosedXML.Excel;

namespace ExcelHyperlinkExtractor;

internal static class Program
{
    private static readonly TextWriter Chat = Console.Error;

    private static int Main(string[] args)
    {
        try
        {
            Console.OutputEncoding = Encoding.UTF8;
        }
        catch (Exception)
        {
            // An old console host that cannot switch code pages still prints ASCII fine.
        }

        try
        {
            var options = Options.Parse(args);

            if (options.ShowHelp)
            {
                Console.WriteLine(Options.HelpText);
                return 0;
            }

            if (options.MakeSamplePath is { } samplePath)
            {
                SampleWorkbook.Write(samplePath);
                Chat.WriteLine($"Wrote sample workbook to {Path.GetFullPath(samplePath)}");
                return 0;
            }

            return Run(options);
        }
        catch (OptionException ex)
        {
            Chat.WriteLine($"Error: {ex.Message}");
            return 2;
        }
        catch (PromptAbortedException)
        {
            Chat.WriteLine("Cancelled.");
            return 1;
        }
        catch (Exception ex)
        {
            Chat.WriteLine($"Error: {ex.Message}");
            return 1;
        }
    }

    private static int Run(Options options)
    {
        var path = ResolveFile(options);
        using var workbook = OpenWorkbook(path);

        var sheet = ResolveSheet(workbook, options);
        var headerRow = ResolveHeaderRow(options);
        var layout = SheetLayout.Build(sheet, headerRow);

        if (layout.IsEmpty)
        {
            Chat.WriteLine($"Worksheet '{sheet.Name}' has no data below row {headerRow}.");
            return 1;
        }

        var linkyColumns = DetectLinkColumns(layout);
        DescribeColumns(layout, linkyColumns);

        var idColumn = ResolveIdColumn(layout, options);
        var linkColumns = ResolveLinkColumns(layout, options, linkyColumns);

        var rows = HyperlinkExtractor.Extract(sheet, layout.FirstDataRow, layout.LastRow, idColumn, linkColumns);
        var rowsInRange = rows.Count;
        if (options.LinksOnly)
        {
            rows = rows.Where(r => r.HasAnyLink).ToList();
        }

        var context = new ReportContext(
            Path.GetFullPath(path), sheet.Name, headerRow, idColumn, linkColumns,
            rowsInRange, layout.FirstDataRow, layout.LastRow, options.LinksOnly);
        var report = ReportWriter.Build(context, rows, options.Format);

        Console.Out.Write(report);

        if (options.OutPath is { } outPath)
        {
            File.WriteAllText(outPath, report, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
            Chat.WriteLine($"Saved {rows.Count} row(s) to {Path.GetFullPath(outPath)}");
        }

        return 0;
    }

    private static string ResolveFile(Options options)
    {
        var path = options.File;

        while (true)
        {
            if (string.IsNullOrWhiteSpace(path))
            {
                path = Ask(options, "Excel file path", required: true);
            }

            path = CleanPath(path!);

            if (File.Exists(path))
            {
                return path;
            }

            var message = $"File not found: {path}";
            if (options.NonInteractive || !CanPrompt)
            {
                throw new OptionException(message);
            }

            Chat.WriteLine(message);
            path = null;
        }
    }

    /// <summary>Strips the quotes a shell or a drag-and-drop leaves behind, and expands ~.</summary>
    private static string CleanPath(string path)
    {
        var value = path.Trim();
        if (value.Length > 1 &&
            ((value[0] == '"' && value[^1] == '"') || (value[0] == '\'' && value[^1] == '\'')))
        {
            value = value[1..^1];
        }

        if (value == "~" || value.StartsWith("~/", StringComparison.Ordinal))
        {
            var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            value = Path.Combine(home, value.Length > 1 ? value[2..] : string.Empty);
        }

        return value;
    }

    private static XLWorkbook OpenWorkbook(string path)
    {
        try
        {
            return new XLWorkbook(path);
        }
        catch (Exception ex)
        {
            var extension = Path.GetExtension(path).ToLowerInvariant();
            var hint = extension is ".xls" or ".csv"
                ? $" Only .xlsx and .xlsm are supported, and this is {extension}. Re-save it as .xlsx from Excel."
                : string.Empty;
            throw new OptionException($"Could not open '{path}'.{hint} ({ex.Message})");
        }
    }

    private static IXLWorksheet ResolveSheet(XLWorkbook workbook, Options options)
    {
        var sheets = workbook.Worksheets.ToList();
        if (sheets.Count == 0)
        {
            throw new OptionException("The workbook has no worksheets.");
        }

        if (options.Sheet is { } requested)
        {
            return FindSheet(sheets, requested);
        }

        if (sheets.Count == 1 || options.NonInteractive || !CanPrompt)
        {
            return sheets[0];
        }

        Chat.WriteLine("Worksheets:");
        for (var i = 0; i < sheets.Count; i++)
        {
            Chat.WriteLine($"  {i + 1}. {sheets[i].Name}");
        }

        while (true)
        {
            var answer = Ask(options, $"Worksheet [{sheets[0].Name}]", required: false);
            if (string.IsNullOrWhiteSpace(answer))
            {
                return sheets[0];
            }

            try
            {
                return FindSheet(sheets, answer);
            }
            catch (OptionException ex)
            {
                Chat.WriteLine(ex.Message);
            }
        }
    }

    private static IXLWorksheet FindSheet(List<IXLWorksheet> sheets, string requested)
    {
        var value = requested.Trim();

        var byName = sheets.FirstOrDefault(s => string.Equals(s.Name, value, StringComparison.OrdinalIgnoreCase));
        if (byName is not null)
        {
            return byName;
        }

        if (int.TryParse(value, out var index) && index >= 1 && index <= sheets.Count)
        {
            return sheets[index - 1];
        }

        throw new OptionException(
            $"No worksheet named '{value}'. Available: {string.Join(", ", sheets.Select(s => s.Name))}.");
    }

    private static int ResolveHeaderRow(Options options)
    {
        if (options.HeaderRow is { } row)
        {
            return row;
        }

        if (options.NonInteractive || !CanPrompt)
        {
            return 1;
        }

        while (true)
        {
            var answer = Ask(options, "Header row [1, or 0 for none]", required: false);
            if (string.IsNullOrWhiteSpace(answer))
            {
                return 1;
            }

            if (int.TryParse(answer.Trim(), out var value) && value >= 0)
            {
                return value;
            }

            Chat.WriteLine("Enter a row number, or 0 if the sheet has no header row.");
        }
    }

    /// <summary>Columns holding at least one link, so the prompts can suggest them.</summary>
    private static HashSet<int> DetectLinkColumns(SheetLayout layout)
    {
        const int sampleRows = 200;
        var found = new HashSet<int>();
        var lastSampled = Math.Min(layout.LastRow, layout.FirstDataRow + sampleRows - 1);

        for (var row = layout.FirstDataRow; row <= lastSampled; row++)
        {
            foreach (var column in layout.Columns)
            {
                if (found.Contains(column.Number))
                {
                    continue;
                }

                if (HyperlinkExtractor.ReadLink(layout.Sheet.Cell(row, column.Number)).Source != LinkSource.None)
                {
                    found.Add(column.Number);
                }
            }
        }

        return found;
    }

    private static void DescribeColumns(SheetLayout layout, HashSet<int> linkyColumns)
    {
        Chat.WriteLine();
        Chat.WriteLine($"Sheet '{layout.Sheet.Name}': rows {layout.FirstDataRow}-{layout.LastRow}, "
                       + $"header row {(layout.HeaderRow > 0 ? layout.HeaderRow.ToString() : "none")}");
        foreach (var column in layout.Columns)
        {
            var header = string.IsNullOrWhiteSpace(column.Header) ? "(no header)" : column.Header;
            var marker = linkyColumns.Contains(column.Number) ? "  <- has hyperlinks" : string.Empty;
            Chat.WriteLine($"  {column.Letter,-3} {header}{marker}");
        }

        Chat.WriteLine();
    }

    private static ColumnRef? ResolveIdColumn(SheetLayout layout, Options options)
    {
        if (options.IdColumn is { } requested)
        {
            return string.IsNullOrWhiteSpace(requested) ? null : layout.Resolve(requested);
        }

        if (options.NonInteractive || !CanPrompt)
        {
            return null;
        }

        while (true)
        {
            var answer = Ask(options, "Id column (blank = use the row number)", required: false);
            if (string.IsNullOrWhiteSpace(answer))
            {
                return null;
            }

            try
            {
                return layout.Resolve(answer);
            }
            catch (OptionException ex)
            {
                Chat.WriteLine(ex.Message);
            }
        }
    }

    private static List<ColumnRef> ResolveLinkColumns(SheetLayout layout, Options options, HashSet<int> linkyColumns)
    {
        if (options.LinkColumns.Count > 0)
        {
            return Dedupe(options.LinkColumns.Select(layout.Resolve));
        }

        var suggested = layout.Columns.Where(c => linkyColumns.Contains(c.Number)).ToList();

        if (options.NonInteractive || !CanPrompt)
        {
            if (suggested.Count > 0)
            {
                Chat.WriteLine($"Using the columns that contain hyperlinks: {string.Join(", ", suggested.Select(c => c.Label))}");
                return suggested;
            }

            throw new OptionException("No hyperlink columns given and none were detected. Pass --link-columns.");
        }

        var hint = suggested.Count > 0 ? $" [{string.Join(",", suggested.Select(c => c.Letter))}]" : string.Empty;

        while (true)
        {
            var answer = Ask(options, $"Hyperlink column(s), comma separated{hint}", required: false);
            if (string.IsNullOrWhiteSpace(answer))
            {
                if (suggested.Count > 0)
                {
                    return suggested;
                }

                Chat.WriteLine("Name at least one column.");
                continue;
            }

            try
            {
                return Dedupe(Options.SplitList(answer).Select(layout.Resolve));
            }
            catch (OptionException ex)
            {
                Chat.WriteLine(ex.Message);
            }
        }
    }

    private static List<ColumnRef> Dedupe(IEnumerable<ColumnRef> columns)
    {
        var result = new List<ColumnRef>();
        foreach (var column in columns)
        {
            if (result.All(c => c.Number != column.Number))
            {
                result.Add(column);
            }
        }

        if (result.Count == 0)
        {
            throw new OptionException("No hyperlink columns were given.");
        }

        return result;
    }

    private static bool CanPrompt => !Console.IsInputRedirected;

    private static string? Ask(Options options, string question, bool required)
    {
        if (options.NonInteractive || !CanPrompt)
        {
            throw new OptionException($"{question} is required when running non-interactively.");
        }

        while (true)
        {
            Chat.Write($"{question}: ");
            var answer = Console.ReadLine();
            if (answer is null)
            {
                throw new PromptAbortedException();
            }

            if (!required || !string.IsNullOrWhiteSpace(answer))
            {
                return answer;
            }
        }
    }
}

internal sealed class PromptAbortedException : Exception
{
}
