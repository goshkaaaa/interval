import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("timer pauses, resumes, and survives reload", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Start session" }).click();
  await page.clock.fastForward(65000);
  await expect(page.getByRole("timer")).toHaveText("23:55");
  await page.getByRole("button", { name: "Pause session" }).click();
  await page.clock.fastForward(10000);
  await expect(page.getByRole("timer")).toHaveText("23:55");
  await page.reload();
  await expect(page.getByRole("timer")).toHaveText("23:55");
  await page.getByRole("button", { name: "Resume session" }).click();
  await page.clock.fastForward(55000);
  await expect(page.getByRole("timer")).toHaveText("23:00");
});

test("completion records exactly one session and waits for the next start", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Start session" }).click();
  await page.clock.fastForward(1501000);
  await expect(
    page.getByRole("button", { name: "Short break", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("timer")).toHaveText("05:00");
  await expect(page.locator(".stat-value").first()).toContainText("25");
  await page.clock.fastForward(300000);
  await expect(page.getByRole("timer")).toHaveText("05:00");
  await page.reload();
  await expect(page.locator(".stat-value").first()).toContainText("25");
});

test("tasks persist and preferences reset the session", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "New task" })
    .fill("Ship the small thing");
  await page.getByRole("button", { name: "Add task" }).click();
  await page
    .getByRole("button", { name: "Ship the small thing", exact: true })
    .click();
  await expect(page.locator(".currently p")).toHaveText("Ship the small thing");
  await page
    .getByRole("checkbox", { name: "Complete Ship the small thing" })
    .check();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Complete Ship the small thing" }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Preferences", exact: true }).click();
  await page.getByLabel("Deep work", { exact: true }).fill("15");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("timer")).toHaveText("15:00");
});

test("layout fits and controls meet accessibility checks", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) => animation.effect.getTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished),
    );
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((node) => ({
        target: node.target,
        summary: node.failureSummary,
      })),
    })),
  ).toEqual([]);
});
