import { describe, it, expect } from "vitest";

describe("Shoots Check Constraint Resolution & Overnight Timing", () => {
  it("normalizes shoots with legacy constraint fallback notes for planned crew and end time", () => {
    const rawShoot = {
      id: "shoot-1",
      couple_name: "Farhan & Samira",
      "shoot name": "Farhan & Samira",
      event_type: "Reception",
      event_date: "2026-11-20",
      start_time: "19:00:00",
      end_time: null,
      planned_team_size: 7, // database stored 7 to satisfy legacy constraint
      notes: "VIP reception [Planned Crew: 5] [End Time: 01:30]",
    };

    let plannedCrew = rawShoot.planned_team_size;
    if (rawShoot.notes) {
      const matchCrew = rawShoot.notes.match(/\[Planned Crew:\s*(\d+)\]/);
      if (matchCrew && matchCrew[1]) plannedCrew = parseInt(matchCrew[1], 10);
    }
    let endTime = rawShoot.end_time;
    if (!endTime && rawShoot.notes) {
      const matchTime = rawShoot.notes.match(/\[End Time:\s*([^\]]+)\]/);
      if (matchTime && matchTime[1]) endTime = matchTime[1].trim();
    }

    expect(plannedCrew).toBe(5);
    expect(endTime).toBe("01:30");
  });

  it("cleans fallback tags when editing notes in the UI", () => {
    const notesWithTags = "VIP reception. Please bring wide lens. [Event Type: Sangeet] [Planned Crew: 5] [End Time: 02:00]";
    const cleaned = notesWithTags
      .replace(/\s*\[Event Type:\s*[^\]]+\]/g, "")
      .replace(/\s*\[Planned Crew:\s*[^\]]+\]/g, "")
      .replace(/\s*\[End Time:\s*[^\]]+\]/g, "")
      .trim();

    expect(cleaned).toBe("VIP reception. Please bring wide lens.");
  });

  it("detects overnight timings crossing midnight correctly", () => {
    const startTime = "20:00";
    const endTime = "02:00";
    const isOvernight = endTime < startTime;

    expect(isOvernight).toBe(true);
  });

  it("identifies identical start and end times for validation", () => {
    const startTime = "10:00";
    const endTime = "10:00";
    const isIdentical = endTime.slice(0, 5) === startTime.slice(0, 5);

    expect(isIdentical).toBe(true);
  });
});

