using ClosedXML.Excel;

namespace ExcelHyperlinkExtractor;

/// <summary>
/// Writes a small workbook covering the shapes a link can take, so the tool can be
/// tried out (and tested) without hunting for a real file.
/// </summary>
internal static class SampleWorkbook
{
    public static void Write(string path)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet("Parts");

        sheet.Cell("A1").Value = "Item ID";
        sheet.Cell("B1").Value = "Name";
        sheet.Cell("C1").Value = "Datasheet";
        sheet.Cell("D1").Value = "Drawing";

        // A hyperlink embedded in the cell, the Ctrl+K case.
        sheet.Cell("A2").Value = "P-1001";
        sheet.Cell("B2").Value = "Widget A";
        sheet.Cell("C2").Value = "Acme datasheet";
        sheet.Cell("C2").SetHyperlink(new XLHyperlink("https://example.com/docs/acme-datasheet.pdf"));
        sheet.Cell("D2").FormulaA1 = "HYPERLINK(\"https://example.com/dwg/1001.dwg\",\"DWG-1001\")";

        // A bare URL typed into the cell, plus a mail link.
        sheet.Cell("A3").Value = "P-1002";
        sheet.Cell("B3").Value = "Widget B";
        sheet.Cell("C3").Value = "https://example.com/docs/widget-b.pdf";
        sheet.Cell("D3").Value = "Ask engineering";
        sheet.Cell("D3").SetHyperlink(new XLHyperlink("mailto:engineering@example.com"));

        // Nothing to extract.
        sheet.Cell("A4").Value = "P-1003";
        sheet.Cell("B4").Value = "Widget C";
        sheet.Cell("C4").Value = "pending";

        // A link on a merged cell, stored against the top-left cell.
        sheet.Cell("A5").Value = "P-1004";
        sheet.Cell("B5").Value = "Widget D";
        sheet.Cell("C5").Value = "Combined pack";
        sheet.Cell("C5").SetHyperlink(new XLHyperlink("https://example.com/docs/pack.zip"));
        sheet.Range("C5:D5").Merge();

        sheet.Columns().AdjustToContents();
        workbook.SaveAs(path);
    }
}
