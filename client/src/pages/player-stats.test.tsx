// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { STAT_CHARTS, evidenceFromStatistics, type Evidence } from "@/lib/stat-charts";
import { matchNights, singlesOf } from "@/lib/player-stats";
import { STATISTICS } from "@/lib/player-stats.fixture";
import { StatPicker } from "@/components/stat-picker";
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

describe("the chart picker", () => {
  const partial: Evidence = {
    ...evidenceFromStatistics(STATISTICS),
    seasons: 1,
    doubles: 0,
  };

  it("will not tick a chart the player has nothing for, and says why", () => {
    render(
      <Router>
        <StatPicker slug="derek-balding" evidence={partial} initial={["season-rate", "form"]} />
      </Router>,
    );
    const seasons = screen.getByRole("checkbox", { name: /Win rate each season/ }) as HTMLInputElement;
    expect(seasons.disabled).toBe(true);
    expect(seasons.checked).toBe(false);
    expect(screen.getAllByText(/Not yet: needs two seasons on record/).length).toBeGreaterThan(0);
    expect((screen.getByRole("checkbox", { name: /Doubles, by partner/ }) as HTMLInputElement).disabled).toBe(true);
  });

  it("links to the statistics page with the ticked charts", () => {
    render(
      <Router>
        <StatPicker slug="derek-balding" evidence={partial} initial={["form"]} />
      </Router>,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /Head to head/ }));
    const link = screen.getByRole("link", { name: "Show 2 charts" });
    expect(link.getAttribute("href")).toBe("/players/derek-balding/stats?charts=form,head-to-head");
  });

  it("applies in place on the statistics page", () => {
    const onApply = vi.fn();
    render(
      <Router>
        <StatPicker slug="derek-balding" evidence={partial} initial={["form"]} onApply={onApply} />
      </Router>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Tick all/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Show \d+ charts$/ }));
    const ids = onApply.mock.calls[0]![0] as string[];
    expect(ids).toContain("head-to-head");
    expect(ids).not.toContain("season-rate");
  });
});
