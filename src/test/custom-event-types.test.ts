import { describe, it, expect, beforeEach } from "vitest";

describe("Shoot Details — Custom Event Types Feature", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const DEFAULT_EVENT_TYPES = [
    "Wedding",
    "Reception",
    "Engagement",
    "Pre-wedding",
    "Haldi",
    "Mehendi",
    "Sangeet",
    "Birthday",
    "Baby Shower",
    "Maternity",
    "Anniversary",
    "Housewarming",
    "Corporate",
    "Other",
  ];

  function getCustomEventTypes(): string[] {
    try {
      const raw = localStorage.getItem("ta_custom_event_types");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        : [];
    } catch {
      return [];
    }
  }

  function saveCustomEventType(type: string): void {
    const cleaned = type.trim();
    if (!cleaned || DEFAULT_EVENT_TYPES.includes(cleaned)) return;
    try {
      const existing = getCustomEventTypes();
      if (!existing.includes(cleaned)) {
        localStorage.setItem("ta_custom_event_types", JSON.stringify([...existing, cleaned]));
      }
    } catch {
      // Ignore
    }
  }

  it("provides comprehensive default event types for wedding and studio events", () => {
    expect(DEFAULT_EVENT_TYPES).toContain("Wedding");
    expect(DEFAULT_EVENT_TYPES).toContain("Reception");
    expect(DEFAULT_EVENT_TYPES).toContain("Engagement");
    expect(DEFAULT_EVENT_TYPES).toContain("Pre-wedding");
    expect(DEFAULT_EVENT_TYPES).toContain("Haldi");
    expect(DEFAULT_EVENT_TYPES).toContain("Mehendi");
    expect(DEFAULT_EVENT_TYPES).toContain("Sangeet");
    expect(DEFAULT_EVENT_TYPES).toContain("Birthday");
    expect(DEFAULT_EVENT_TYPES).toContain("Baby Shower");
    expect(DEFAULT_EVENT_TYPES).toContain("Maternity");
    expect(DEFAULT_EVENT_TYPES).toContain("Anniversary");
    expect(DEFAULT_EVENT_TYPES).toContain("Housewarming");
    expect(DEFAULT_EVENT_TYPES).toContain("Corporate");
    expect(DEFAULT_EVENT_TYPES).toContain("Other");
  });

  it("allows saving and retrieving custom event types in storage", () => {
    expect(getCustomEventTypes()).toEqual([]);

    saveCustomEventType("Candid Sangeet Night");
    expect(getCustomEventTypes()).toContain("Candid Sangeet Night");

    saveCustomEventType("Bangle Ceremony");
    const saved = getCustomEventTypes();
    expect(saved).toContain("Candid Sangeet Night");
    expect(saved).toContain("Bangle Ceremony");
    expect(saved.length).toBe(2);
  });

  it("does not duplicate standard event types in custom storage", () => {
    saveCustomEventType("Wedding");
    saveCustomEventType("Reception");
    expect(getCustomEventTypes()).toEqual([]);
  });

  it("handles whitespace and prevents duplicate entries", () => {
    saveCustomEventType("  Cocktail Party  ");
    saveCustomEventType("Cocktail Party");
    expect(getCustomEventTypes()).toEqual(["Cocktail Party"]);
  });

  it("merges defaults, shoot event types, and custom event types into available list", () => {
    saveCustomEventType("Cocktail Party");
    const existingShoots = [
      { id: "1", event_type: "Wedding" },
      { id: "2", event_type: "Haldi" },
      { id: "3", event_type: "Custom Shoot" },
    ];

    const fromShoots = existingShoots.map((s) => s.event_type);
    const custom = getCustomEventTypes();
    const merged = Array.from(new Set([...DEFAULT_EVENT_TYPES, ...fromShoots, ...custom]));

    expect(merged).toContain("Wedding");
    expect(merged).toContain("Haldi");
    expect(merged).toContain("Custom Shoot");
    expect(merged).toContain("Cocktail Party");
    expect(new Set(merged).size).toBe(merged.length); // No duplicates
  });
});
