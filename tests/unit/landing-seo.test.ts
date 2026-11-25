import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const html = readFileSync(resolve("landing/dist/index.html"), "utf8");

describe("landing search console", () => {
  it("includes the Google site verification tag on the built home page", () => {
    expect(html).toContain(
      '<meta name="google-site-verification" content="RkGWnbZxC9w3-dIwWLB4A6HHcSN9P08bu9cPAR-fz1A"',
    );
  });

  it("includes the standard GA4 snippet with the measurement id in plain text", () => {
    expect(html).toContain('src="https://www.googletagmanager.com/gtag/js?id=G-SM0WR8CEW8"');
    expect(html).toContain("window.dataLayer = window.dataLayer || []");
    expect(html).toContain("function gtag(){dataLayer.push(arguments);}");
    expect(html).toContain("gtag('js', new Date());");
    expect(html).toContain("gtag('config', 'G-SM0WR8CEW8');");
  });
});
