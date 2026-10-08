// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Router } from "wouter";
import { STAT_CHARTS } from "@/lib/stat-charts";
import { matchNights, singlesOf } from "@/lib/player-stats";
import { STATISTICS } from "@/lib/player-stats.fixture";
import { StatChart } from "./player-stats";

const context = {
  data: STATISTICS,
  name: "Derek Balding",
  nights: matchNights(STATISTICS.rubbers),
  singles: singlesOf(STATISTICS.rubbers),
  rubbers: STATISTICS.rubbers,
  cardSeason: "2026-27",
};

describe("every chart in the catalogue", () => {
  for (const chart of STAT_CHARTS) {
    it(`draws "${chart.title}"`, () => {
      const { container } = render(
        <Router>
          <StatChart id={chart.id} context={context} />
        </Router>,
      );
      // A catalogue entry with no drawing renders nothing at all.
      const figure = container.querySelector("figure");
      expect(figure, `no figure for ${chart.id}`).not.toBeNull();
      expect(within(figure!).getByRole("heading", { name: chart.title })).toBeTruthy();
      // A chart is a picture with a name, or a list or table a reader can read.
      const drawn = figure!.querySelector("svg[role=img][aria-label], ul, table");
      expect(drawn, `nothing drawn for ${chart.id}`).not.toBeNull();
    });
  }

  it("offers the numbers behind a chart as a table", () => {
    render(
      <Router>
        <StatChart id="form" context={context} />
      </Router>,
    );
    const toggle = screen.getByRole("button", { name: "Show the numbers" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(4); // a header and three nights
  });
});

describe("the info button on every chart", () => {
  const draw = (id: string) =>
    render(
      <Router>
        <StatChart id={id} context={context} />
      </Router>,
    );

  it("is there for every chart, closed until asked", () => {
    for (const chart of STAT_CHARTS) {
      const { unmount } = draw(chart.id);
      const button = screen.getByRole("button", { name: `About this chart: ${chart.title}` });
      expect(button.getAttribute("aria-expanded")).toBe("false");
      expect(screen.getByText(chart.about).closest("[hidden]")).not.toBeNull();
      unmount();
    }
  });

  it("opens on a tap, and closes on Escape and on a tap elsewhere", () => {
    const chart = STAT_CHARTS.find((one) => one.id === "season-placing")!;
    draw(chart.id);
    const button = screen.getByRole("button", { name: `About this chart: ${chart.title}` });

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(chart.about).closest("[hidden]")).toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText(chart.about).closest("[hidden]")).not.toBeNull();

    fireEvent.click(button);
    fireEvent.pointerDown(document.body);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("the division, season by season", () => {
  it("names each season's division under it on the axis", () => {
    const { container } = render(
      <Router>
        <StatChart id="season-rate" context={context} />
      </Router>,
    );
    const axis = [...container.querySelectorAll("svg text")].map((node) => node.textContent);
    expect(axis).toContain("Div 1");
    expect(axis).toContain("Premier");
  });

  it("carries it into the numbers table", () => {
    render(
      <Router>
        <StatChart id="season-placing" context={context} />
      </Router>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show the numbers" }));
    const rows = within(screen.getByRole("table")).getAllByRole("row").map((row) => row.textContent);
    expect(rows[0]).toContain("Division");
    expect(rows[1]).toContain("Division 1");
    expect(rows[2]).toContain("Premier Division");
  });
});
