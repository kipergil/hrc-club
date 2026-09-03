using ClosedXML.Excel;

namespace ExcelHyperlinkExtractor;

/// <summary>
/// The used area of a worksheet plus its header row, so columns can be referred
/// to by the name the user sees in Excel rather than by index.
/// </summary>
internal sealed class SheetLayout
{
    private SheetLayout(IXLWorksheet sheet, int headerRow, int firstColumn, int lastColumn, int firstDataRow, int lastRow, IReadOnlyList<ColumnRef> columns)
    {
        Sheet = sheet;
        HeaderRow = headerRow;
        FirstColumn = firstColumn;
        LastColumn = lastColumn;
        FirstDataRow = firstDataRow;
        LastRow = lastRow;
        Columns = columns;
    }

    public IXLWorksheet Sheet { get; }
    public int HeaderRow { get; }
    public int FirstColumn { get; }
    public int LastColumn { get; }
    public int FirstDataRow { get; }
    public int LastRow { get; }

    /// <summary>Every column in the used range, with its header text when there is one.</summary>
    public IReadOnlyList<ColumnRef> Columns { get; }

    public bool IsEmpty => Columns.Count == 0 || LastRow < FirstDataRow;

    public static SheetLayout Build(IXLWorksheet sheet, int headerRow)
    {
        var used = sheet.RangeUsed();
        if (used is null)
        {
            return new SheetLayout(sheet, headerRow, 1, 1, headerRow + 1, 0, Array.Empty<ColumnRef>());
        }

        var firstColumn = used.RangeAddress.FirstAddress.ColumnNumber;
        var lastColumn = used.RangeAddress.LastAddress.ColumnNumber;
        var lastRow = used.RangeAddress.LastAddress.RowNumber;
        var firstUsedRow = used.RangeAddress.FirstAddress.RowNumber;

        var columns = new List<ColumnRef>(lastColumn - firstColumn + 1);
        for (var column = firstColumn; column <= lastColumn; column++)
        {
            var header = headerRow > 0
                ? HyperlinkExtractor.GetDisplayText(sheet.Cell(headerRow, column))
                : string.Empty;
            columns.Add(new ColumnRef(column, header));
        }

        var firstDataRow = headerRow > 0 ? headerRow + 1 : Math.Max(firstUsedRow, 1);
        return new SheetLayout(sheet, headerRow, firstColumn, lastColumn, firstDataRow, lastRow, columns);
    }

    /// <summary>
    /// Resolves what the user typed for a column: the header text first
    /// (case-insensitive, exact then prefix), then a column letter.
    /// </summary>
    public ColumnRef Resolve(string input)
    {
        var value = input.Trim();
        if (value.Length == 0)
        {
            throw new OptionException("Empty column reference.");
        }

        var exact = Columns
            .Where(c => !string.IsNullOrEmpty(c.Header) && string.Equals(c.Header, value, StringComparison.OrdinalIgnoreCase))
            .ToList();
        if (exact.Count == 1)
        {
            return exact[0];
        }

        if (exact.Count > 1)
        {
            throw new OptionException(
                $"'{value}' matches more than one column ({string.Join(", ", exact.Select(c => c.Letter))}). Use the column letter instead.");
        }

        if (TryResolveLetter(value, out var byLetter))
        {
            return byLetter;
        }

        var prefix = Columns
            .Where(c => !string.IsNullOrEmpty(c.Header) && c.Header!.StartsWith(value, StringComparison.OrdinalIgnoreCase))
            .ToList();
        if (prefix.Count == 1)
        {
            return prefix[0];
        }

        if (prefix.Count > 1)
        {
            throw new OptionException(
                $"'{value}' matches several columns ({string.Join(", ", prefix.Select(c => c.Label))}). Be more specific or use the column letter.");
        }

        throw new OptionException($"No column matches '{value}'. Expected a header name or a column letter such as B.");
    }

    private bool TryResolveLetter(string value, out ColumnRef column)
    {
        column = null!;
        if (value.Length is < 1 or > 3 || !value.All(char.IsAsciiLetter))
        {
            return false;
        }

        int number;
        try
        {
            number = XLHelper.GetColumnNumberFromLetter(value.ToUpperInvariant());
        }
        catch (Exception)
        {
            return false;
        }

        if (number < 1)
        {
            return false;
        }

        // Outside the used range is still a legal column, just an empty one.
        column = Columns.FirstOrDefault(c => c.Number == number)
                 ?? new ColumnRef(number, null);
        return true;
    }
}
