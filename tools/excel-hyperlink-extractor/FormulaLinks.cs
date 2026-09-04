using System.Text;
using System.Text.RegularExpressions;
using ClosedXML.Excel;

namespace ExcelHyperlinkExtractor;

/// <summary>The unevaluated arguments of a =HYPERLINK(...) call.</summary>
internal sealed record HyperlinkCall(string Target, string? Label);

/// <summary>
/// Excel offers "Open Hyperlink" but no "Edit Hyperlink" on a cell whose link comes from a
/// formula: the target is computed, not stored on the cell. It is often not a literal either,
/// but a reference or a concatenation, so the argument has to be evaluated.
/// </summary>
internal static class FormulaLinks
{
    private static readonly Regex CellReference = new(@"^\$?[A-Za-z]{1,3}\$?[0-9]{1,7}$", RegexOptions.Compiled);
    private static readonly Regex Number = new(@"^-?[0-9]+(\.[0-9]+)?$", RegexOptions.Compiled);
    private static readonly Regex FunctionCall = new(@"^([A-Za-z_][A-Za-z0-9_.]*)\s*\((.*)\)$", RegexOptions.Compiled | RegexOptions.Singleline);

    /// <summary>Finds the =HYPERLINK(...) call in a formula, wherever it sits.</summary>
    public static HyperlinkCall? FindCall(string? formula)
    {
        if (string.IsNullOrWhiteSpace(formula))
        {
            return null;
        }

        var upper = formula.ToUpperInvariant();
        var open = -1;

        for (var at = upper.IndexOf("HYPERLINK(", StringComparison.Ordinal); at >= 0;
             at = upper.IndexOf("HYPERLINK(", at + 1, StringComparison.Ordinal))
        {
            // A leading "." is fine: that is _xlfn.HYPERLINK.
            var before = at > 0 ? upper[at - 1] : ' ';
            if (!char.IsLetterOrDigit(before) && before != '_')
            {
                open = at;
                break;
            }
        }

        if (open < 0)
        {
            return null;
        }

        var start = open + "HYPERLINK(".Length;
        var depth = 1;
        var quoted = false;
        var end = -1;

        for (var i = start; i < formula.Length; i++)
        {
            var ch = formula[i];
            if (quoted)
            {
                if (ch == '"')
                {
                    if (i + 1 < formula.Length && formula[i + 1] == '"') i++;
                    else quoted = false;
                }
                continue;
            }

            if (ch == '"') quoted = true;
            else if (ch == '(') depth++;
            else if (ch == ')' && --depth == 0) { end = i; break; }
        }

        if (end < 0)
        {
            return null;
        }

        var args = SplitTop(formula[start..end], ',');
        var target = args[0].Trim();
        return target.Length == 0 ? null : new HyperlinkCall(target, args.Count > 1 ? args[1].Trim() : null);
    }

    /// <summary>
    /// Evaluates the slice of the formula language that link targets are built from: text,
    /// numbers, cell references, &amp; and CONCAT/CONCATENATE. Anything else returns null;
    /// <see cref="EvaluateWithEngine"/> is the fallback for those.
    /// </summary>
    public static string? Evaluate(IXLWorksheet sheet, string expression)
    {
        var result = new StringBuilder();

        foreach (var part in SplitTop(expression, '&'))
        {
            var value = EvaluateTerm(sheet, part.Trim());
            if (value is null)
            {
                return null;
            }

            result.Append(value);
        }

        return result.ToString();
    }

    /// <summary>
    /// ClosedXML's formula engine, for targets the restricted evaluator above will not touch —
    /// a lookup, a condition. It can fail on anything it does not implement, which is reported
    /// as an unresolved target rather than a guess.
    /// </summary>
    public static string? EvaluateWithEngine(IXLWorksheet sheet, string expression, string cellAddress)
    {
        try
        {
            var value = sheet.Evaluate("=" + expression, cellAddress);
            if (value.IsError || value.IsBlank)
            {
                return null;
            }

            var text = value.ToString();
            return string.IsNullOrWhiteSpace(text) ? null : text.Trim();
        }
        catch (Exception)
        {
            return null;
        }
    }

    private static string? EvaluateTerm(IXLWorksheet sheet, string term)
    {
        if (term.Length == 0)
        {
            return null;
        }

        if (term[0] == '"')
        {
            return StringLiteral(term);
        }

        if (Number.IsMatch(term))
        {
            return term;
        }

        var call = FunctionCall.Match(term);
        if (call.Success)
        {
            var name = call.Groups[1].Value.ToUpperInvariant();
            if (name.StartsWith("_XLFN.", StringComparison.Ordinal))
            {
                name = name["_XLFN.".Length..];
            }

            if (name is not ("CONCATENATE" or "CONCAT"))
            {
                return null;
            }

            var joined = new StringBuilder();
            foreach (var argument in SplitTop(call.Groups[2].Value, ','))
            {
                var value = Evaluate(sheet, argument.Trim());
                if (value is null)
                {
                    return null;
                }

                joined.Append(value);
            }

            return joined.ToString();
        }

        if (term[0] == '(' && term[^1] == ')')
        {
            return Evaluate(sheet, term[1..^1]);
        }

        return ReferenceText(sheet, term);
    }

    /// <summary>A1, $A$1, Sheet2!A1, 'Another sheet'!A1 — one cell, on any sheet of the workbook.</summary>
    private static string? ReferenceText(IXLWorksheet sheet, string term)
    {
        var reference = term;
        var bang = term.LastIndexOf('!');

        if (bang >= 0)
        {
            var name = term[..bang];
            reference = term[(bang + 1)..];

            if (name.Length > 1 && name[0] == '\'' && name[^1] == '\'')
            {
                name = name[1..^1].Replace("''", "'");
            }

            if (!sheet.Workbook.TryGetWorksheet(name, out sheet!))
            {
                return null;
            }
        }

        if (!CellReference.IsMatch(reference))
        {
            return null;
        }

        return HyperlinkExtractor.GetDisplayText(sheet.Cell(reference.Replace("$", string.Empty).ToUpperInvariant()));
    }

    private static string? StringLiteral(string term)
    {
        var value = new StringBuilder();

        for (var i = 1; i < term.Length; i++)
        {
            if (term[i] == '"')
            {
                if (i + 1 < term.Length && term[i + 1] == '"')
                {
                    value.Append('"');
                    i++;
                    continue;
                }

                // The whole term has to be the one literal.
                return i == term.Length - 1 ? value.ToString() : null;
            }

            value.Append(term[i]);
        }

        return null;
    }

    /// <summary>Splits on a separator that sits outside quotes and brackets.</summary>
    private static List<string> SplitTop(string text, char separator)
    {
        var parts = new List<string>();
        var depth = 0;
        var quoted = false;
        var start = 0;

        for (var i = 0; i < text.Length; i++)
        {
            var ch = text[i];

            if (quoted)
            {
                if (ch == '"')
                {
                    if (i + 1 < text.Length && text[i + 1] == '"') i++;
                    else quoted = false;
                }
                continue;
            }

            if (ch == '"') quoted = true;
            else if (ch is '(' or '[') depth++;
            else if (ch is ')' or ']') depth--;
            else if (ch == separator && depth == 0)
            {
                parts.Add(text[start..i]);
                start = i + 1;
            }
        }

        parts.Add(text[start..]);
        return parts;
    }
}
