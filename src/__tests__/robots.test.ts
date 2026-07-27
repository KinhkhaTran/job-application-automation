import { parseRobotsTxt } from "@/lib/scrapers/robots";

describe("parseRobotsTxt", () => {
  test("parses disallow rules for wildcard user-agent", () => {
    const text = `
User-agent: *
Disallow: /private/
Disallow: /admin/
`;
    const rules = parseRobotsTxt(text);
    expect(rules.disallowed).toContain("/private/");
    expect(rules.disallowed).toContain("/admin/");
  });

  test("parses crawl-delay (converts seconds to ms)", () => {
    const text = `
User-agent: *
Crawl-delay: 2
`;
    const rules = parseRobotsTxt(text);
    expect(rules.crawlDelayMs).toBe(2000);
  });

  test("ignores comment lines", () => {
    const text = `
# This is a comment
User-agent: *
# Another comment
Disallow: /blocked/
`;
    const rules = parseRobotsTxt(text);
    expect(rules.disallowed).toContain("/blocked/");
    expect(rules.disallowed).toHaveLength(1);
  });

  test("returns empty rules for an empty robots.txt", () => {
    const rules = parseRobotsTxt("");
    expect(rules.disallowed).toHaveLength(0);
    expect(rules.crawlDelayMs).toBeNull();
  });

  test("ignores rules for unrelated user-agents", () => {
    const text = `
User-agent: Googlebot
Disallow: /no-google/

User-agent: *
Disallow: /blocked/
`;
    const rules = parseRobotsTxt(text);
    expect(rules.disallowed).toContain("/blocked/");
    // Googlebot-specific rule should not bleed into the wildcard section result
    expect(rules.disallowed).not.toContain("/no-google/");
  });

  test("handles inline comments after directive values", () => {
    const text = `
User-agent: * # all bots
Disallow: /secret/ # keep out
`;
    const rules = parseRobotsTxt(text);
    // The "#" splits the line; the value before "#" is " * " which trims to "*"
    expect(rules.disallowed).toContain("/secret/");
  });

  test("handles CRLF line endings", () => {
    const text = "User-agent: *\r\nDisallow: /admin/\r\n";
    const rules = parseRobotsTxt(text);
    expect(rules.disallowed).toContain("/admin/");
  });

  test("does not apply rules when no matching user-agent section found", () => {
    const text = `
User-agent: Googlebot
Disallow: /private/
`;
    const rules = parseRobotsTxt(text);
    // Our bot and * are not listed, so no rules apply
    expect(rules.disallowed).toHaveLength(0);
  });
});
