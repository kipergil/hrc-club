using System.Text.RegularExpressions;
using ClosedXML.Excel;

namespace ExcelHyperlinkExtractor;

/// <summary>Where the link for a cell came from.</summary>
internal enum LinkSource
{
    /// <summary>No link at all.</summary>
    None,

    /// <summary>A hyperlink embedded in the cell (what Ctrl+K creates).</summary>
    Embedded,

    /// <summary>A =HYPERLINK("...") formula.</summary>
    Formula,

    /// <summary>The cell has no link, but its text is itself a URL.</summary>
    PlainText,
}

internal sealed record CellLink(string Text, string? Address, LinkSource Source)
{
    public static readonly CellLink Empty = new(string.Empty, null, LinkSource.None);

    public string SourceLabel => Source switch
    {
        LinkSource.Embedded => "embedded hyperlink",
        LinkSource.Formula => "HYPERLINK formula",
        LinkSource.PlainText => "url in cell text",
        _ => "none",
    };
}

/// <summary>One hyperlink column of one row.</summary>
internal sealed record LinkEntry(ColumnRef Column, string CellAddress, CellLink Link);

/// <summary>One worksheet row: its id plus the hyperlink columns read from it.</summary>
internal sealed record RowResult(int RowNumber, string Id, IReadOnlyList<LinkEntry> Entries)
{
    public bool HasAnyLink => Entries.Any(e => e.Link.Source != LinkSource.None);
}

/// <summary>A column the user picked, remembered by number so headers stay readable.</summary>
internal sealed record ColumnRef(int Number, string? Header)
{
    public string Letter => XLHelper.GetColumnLetterFromNumber(Number);

    public string Label => string.IsNullOrWhiteSpace(Header) ? Letter : $"{Letter} ({Header})";
}

internal static class HyperlinkExtractor
{
    private static readonly Regex UrlLike = new(
        @"^\s*(https?://|ftp://|mailto:|file://|\\\\|www\.)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>Reads every data row, pairing the id cell with the hyperlink cells.</summary>
    public static List<RowResult> Extract(
        IXLWorksheet sheet,
        int firstDataRow,
        int lastRow,
        ColumnRef? idColumn,
        IReadOnlyList<ColumnRef> linkColumns)
    {
        var results = new List<RowResult>();

        for (var row = firstDataRow; row <= lastRow; row++)
        {
            var id = idColumn is null
                ? row.ToString()
                : GetDisplayText(sheet.Cell(row, idColumn.Number));

            var entries = new List<LinkEntry>(linkColumns.Count);
            foreach (var column in linkColumns)
            {
                var cell = sheet.Cell(row, column.Number);
                entries.Add(new LinkEntry(column, cell.Address.ToStringRelative(), ReadLink(cell)));
            }

            // Every row in the data range is reported, whether or not anything was found in
            // it, so the output lines up with the sheet it came from.
            results.Add(new RowResult(row, id, entries));
        }

        return results;
    }

    /// <summary>Pulls the link out of a single cell, whichever way it was authored.</summary>
    public static CellLink ReadLink(IXLCell cell)
    {
        var text = GetDisplayText(cell);

        var hyperlink = GetEmbeddedHyperlink(cell);
        if (hyperlink is not null)
        {
            var address = hyperlink.IsExternal
                ? hyperlink.ExternalAddress?.ToString()
                : hyperlink.InternalAddress;

            if (!string.IsNullOrWhiteSpace(address))
            {
                return new CellLink(text, address, LinkSource.Embedded);
            }
        }

        if (cell.HasFormula && TryReadHyperlinkFormula(cell.FormulaA1, out var formulaAddress))
        {
            return new CellLink(text, formulaAddress, LinkSource.Formula);
        }

        if (UrlLike.IsMatch(text))
        {
            return new CellLink(text, text.Trim(), LinkSource.PlainText);
        }

        return CellLink.Empty with { Text = text };
    }

    private static XLHyperlink? GetEmbeddedHyperlink(IXLCell cell)
    {
        if (cell.HasHyperlink)
        {
            return cell.GetHyperlink();
        }

        // A link dropped on a merged cell is stored against the merge's top-left cell.
        if (cell.IsMerged())
        {
            var anchor = cell.MergedRange().FirstCell();
            if (anchor.HasHyperlink)
            {
                return anchor.GetHyperlink();
            }
        }

        return null;
    }

    /// <summary>
    /// Reads the target out of =HYPERLINK("target", "text"). Only literal targets can be
    /// recovered; a computed one (a cell reference, a concatenation) needs the workbook
    /// recalculated, so it is reported as "no link" rather than guessed at.
    /// </summary>
    internal static bool TryReadHyperlinkFormula(string? formula, out string? address)
    {
        address = null;
        if (string.IsNullOrWhiteSpace(formula))
        {
            return false;
        }

        var open = formula.IndexOf("HYPERLINK(", StringComparison.OrdinalIgnoreCase);
        if (open < 0)
        {
            return false;
        }

        var i = open + "HYPERLINK(".Length;
        while (i < formula.Length && char.IsWhiteSpace(formula[i]))
        {
            i++;
        }

        if (i >= formula.Length || formula[i] != '"')
        {
            return false;
        }

        i++;
        var value = new System.Text.StringBuilder();
        while (i < formula.Length)
        {
            if (formula[i] == '"')
            {
                // "" is an escaped quote inside the literal; a lone quote ends it.
                if (i + 1 < formula.Length && formula[i + 1] == '"')
                {
                    value.Append('"');
                    i += 2;
                    continue;
                }

                address = value.ToString();
                return address.Length > 0;
            }

            value.Append(formula[i]);
            i++;
        }

        return false;
    }

    /// <summary>The text as Excel shows it, so dates and numbers do not come out as serials.</summary>
    public static string GetDisplayText(IXLCell cell)
    {
        try
        {
            return cell.GetFormattedString().Trim();
        }
        catch (Exception)
        {
            return cell.GetString().Trim();
        }
    }
}
