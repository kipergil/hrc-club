using System.Text;

namespace ExcelHyperlinkExtractor;

internal sealed record ReportContext(
    string FilePath,
    string SheetName,
    int HeaderRow,
    ColumnRef? IdColumn,
    IReadOnlyList<ColumnRef> LinkColumns,
    int RowsScanned);

internal static class ReportWriter
{
    public static string Build(ReportContext context, IReadOnlyList<RowResult> rows, OutputFormat format) => format switch
    {
        OutputFormat.Tsv => BuildDelimited(rows, "\t", quote: false),
        OutputFormat.Csv => BuildDelimited(rows, ",", quote: true),
        _ => BuildText(context, rows),
    };

    private static string BuildText(ReportContext context, IReadOnlyList<RowResult> rows)
    {
        var report = new StringBuilder();
        report.AppendLine("Excel hyperlinks");
        report.AppendLine($"File   : {context.FilePath}");
        report.AppendLine($"Sheet  : {context.SheetName}");
        report.AppendLine($"Id     : {(context.IdColumn is null ? "row number" : context.IdColumn.Label)}");
        report.AppendLine($"Links  : {string.Join(", ", context.LinkColumns.Select(c => c.Label))}");
        report.AppendLine($"Rows   : {rows.Count} listed of {context.RowsScanned} with data");
        report.AppendLine();

        if (rows.Count == 0)
        {
            report.AppendLine("No hyperlinks found. Re-run with --all to list the rows anyway.");
            return report.ToString();
        }

        var single = context.LinkColumns.Count == 1;
        foreach (var row in rows)
        {
            var id = string.IsNullOrWhiteSpace(row.Id) ? "(no id)" : row.Id;
            report.AppendLine($"[row {row.RowNumber}] {id}");

            foreach (var entry in row.Entries)
            {
                var indent = single ? "  " : "    ";
                if (!single)
                {
                    report.AppendLine($"  {entry.Column.Label}");
                }

                report.AppendLine($"{indent}text: {Show(entry.Link.Text)}");
                report.AppendLine(entry.Link.Source == LinkSource.None
                    ? $"{indent}link: (none)"
                    : $"{indent}link: {entry.Link.Address}{Note(entry.Link)}");
            }

            report.AppendLine();
        }

        return report.ToString();
    }

    private static string BuildDelimited(IReadOnlyList<RowResult> rows, string separator, bool quote)
    {
        var report = new StringBuilder();
        var header = new[] { "Row", "Id", "Column", "Cell", "Text", "Link", "Source" };
        report.AppendLine(string.Join(separator, header.Select(h => Field(h, separator, quote))));

        foreach (var row in rows)
        {
            foreach (var entry in row.Entries)
            {
                var fields = new[]
                {
                    row.RowNumber.ToString(),
                    row.Id,
                    entry.Column.Header is { Length: > 0 } h ? h : entry.Column.Letter,
                    entry.CellAddress,
                    entry.Link.Text,
                    entry.Link.Address ?? string.Empty,
                    entry.Link.Source == LinkSource.None ? string.Empty : entry.Link.SourceLabel,
                };
                report.AppendLine(string.Join(separator, fields.Select(f => Field(f, separator, quote))));
            }
        }

        return report.ToString();
    }

    private static string Field(string value, string separator, bool quote)
    {
        // Newlines and tabs would break one record across several lines either way.
        var flat = value.Replace("\r\n", " ").Replace('\r', ' ').Replace('\n', ' ').Replace('\t', ' ');
        if (!quote)
        {
            return flat;
        }

        return flat.Contains(separator) || flat.Contains('"')
            ? $"\"{flat.Replace("\"", "\"\"")}\""
            : flat;
    }

    private static string Show(string text) => string.IsNullOrWhiteSpace(text) ? "(empty)" : text;

    private static string Note(CellLink link) =>
        link.Source == LinkSource.Embedded ? string.Empty : $"  [{link.SourceLabel}]";
}
