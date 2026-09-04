using System.Text;

namespace ExcelHyperlinkExtractor;

internal sealed record ReportContext(
    string FilePath,
    string SheetName,
    int HeaderRow,
    ColumnRef? IdColumn,
    IReadOnlyList<ColumnRef> LinkColumns,
    int RowsInRange,
    int FirstDataRow,
    int LastRow,
    bool LinksOnly);

internal static class ReportWriter
{
    public static string Build(ReportContext context, IReadOnlyList<RowResult> rows, OutputFormat format) => format switch
    {
        OutputFormat.Tsv => BuildDelimited(context, rows, "\t", quote: false),
        OutputFormat.Csv => BuildDelimited(context, rows, ",", quote: true),
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
        report.AppendLine($"Rows   : {RowsLine(context, rows.Count)}");
        report.AppendLine();

        if (rows.Count == 0)
        {
            report.AppendLine(context.LinksOnly
                ? "No row in this sheet has a link in the chosen columns. Drop --links-only to list them all."
                : "This sheet has no data rows.");
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
                report.AppendLine(entry.Link.Source != LinkSource.None
                    ? $"{indent}link: {entry.Link.Address}{Note(entry.Link)}"
                    : entry.Link.UnresolvedTarget is { } expression
                        ? $"{indent}link: (not computed) =HYPERLINK({Shorten(expression)}, …)"
                        : $"{indent}link: (none)");
            }

            report.AppendLine();
        }

        return report.ToString();
    }

    /// <summary>
    /// One line per worksheet row, with a text/link pair per chosen column, so the export stays
    /// row-for-row with the sheet and can be pasted back beside it.
    /// </summary>
    private static string BuildDelimited(ReportContext context, IReadOnlyList<RowResult> rows, string separator, bool quote)
    {
        var report = new StringBuilder();

        var header = new List<string> { "Row", "Id" };
        foreach (var column in context.LinkColumns)
        {
            var name = column.Header is { Length: > 0 } h ? h : column.Letter;
            header.Add($"{name} text");
            header.Add($"{name} link");
        }

        report.AppendLine(string.Join(separator, header.Select(h => Field(h, separator, quote))));

        foreach (var row in rows)
        {
            var fields = new List<string> { row.RowNumber.ToString(), row.Id };
            foreach (var entry in row.Entries)
            {
                fields.Add(entry.Link.Text);
                fields.Add(entry.Link.Address ?? string.Empty);
            }

            report.AppendLine(string.Join(separator, fields.Select(f => Field(f, separator, quote))));
        }

        return report.ToString();
    }

    private static string RowsLine(ReportContext context, int listed)
    {
        var span = $"rows {context.FirstDataRow}–{context.LastRow}";
        return listed == context.RowsInRange
            ? $"{listed} — every row of {span}"
            : $"{listed} of {context.RowsInRange} ({span}), the rows that have a link";
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

    private static string Shorten(string text) => text.Length > 60 ? text[..57] + "…" : text;

    private static string Note(CellLink link) =>
        link.Source == LinkSource.Embedded ? string.Empty : $"  [{link.SourceLabel}]";
}
