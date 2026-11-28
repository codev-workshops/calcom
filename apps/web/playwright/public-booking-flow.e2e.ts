import { BookingStatus } from "@calcom/prisma/enums";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import type { Fixtures } from "./lib/fixtures";
import { test } from "./lib/fixtures";
import { confirmBooking } from "./lib/testUtils";

/**
 * End-to-end coverage of the public booking flow, step by step, as an anonymous attendee:
 * public profile page -> event type booking page -> pick a date and time slot ->
 * fill in attendee details -> confirm -> booking success page (and the booking persisted in the DB).
 */

const eventType = {
  title: "E2E Intro Call",
  slug: "e2e-intro-call",
  length: 30,
};
// A profile with a single event type redirects straight to it, so give the host a second one
// to make sure the attendee actually picks the event type from the public profile page.
const otherEventType = {
  title: "E2E Deep Dive",
  slug: "e2e-deep-dive",
  length: 60,
};

type Attendee = { name: string; email: string; notes: string };

/** Picks the first available slot of the first available day next month and returns its start time. */
async function selectFirstAvailableSlotNextMonth(page: Page): Promise<Date> {
  await page.getByTestId("incrementMonth").click();
  await page.locator('[data-testid="day"][data-disabled="false"]').first().click();

  const firstSlot = page.locator('[data-testid="time"][data-disabled="false"]').first();
  await expect(firstSlot).toBeVisible();
  const slotStart = await firstSlot.getAttribute("data-time");
  expect(slotStart).toBeTruthy();
  await firstSlot.click();
  await expect(page.locator('[name="name"]')).toBeVisible();
  return new Date(slotStart ?? "");
}

async function expectSuccessPageToShow(page: Page, attendee: Attendee): Promise<void> {
  await expect(page.getByTestId("success-page")).toBeVisible();
  await expect(page.getByTestId("booking-title")).toContainText(eventType.title);
  await expect(page.getByTestId(`attendee-name-${attendee.name}`)).toHaveText(attendee.name);
  await expect(page.getByTestId(`attendee-email-${attendee.email}`)).toHaveText(attendee.email);
  await expect(page.getByText(attendee.notes)).toBeVisible();
}

async function expectBookingToBePersisted({
  prisma,
  bookingUid,
  hostId,
  startTime,
  attendee,
}: {
  prisma: Fixtures["prisma"];
  bookingUid: string;
  hostId: number;
  startTime: Date;
  attendee: Attendee;
}): Promise<void> {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { uid: bookingUid },
    select: {
      status: true,
      startTime: true,
      endTime: true,
      description: true,
      userId: true,
      attendees: { select: { name: true, email: true } },
    },
  });

  expect(booking.status).toBe(BookingStatus.ACCEPTED);
  expect(booking.userId).toBe(hostId);
  expect(booking.startTime.toISOString()).toBe(startTime.toISOString());
  expect(booking.endTime.getTime() - booking.startTime.getTime()).toBe(eventType.length * 60 * 1000);
  expect(booking.description).toBe(attendee.notes);
  expect(booking.attendees).toEqual([{ name: attendee.name, email: attendee.email }]);
}

test.describe.configure({ mode: "parallel" });
// Always record the flow so the run can be reviewed visually (videos/screenshots land in test-results).
test.use({ video: "on", screenshot: "on" });

test.afterEach(async ({ users }) => {
  await users.deleteAll();
});

test("public booking flow: an attendee can book a time slot from the public booking page", async ({
  page,
  users,
  prisma,
}) => {
  const host = await users.create({
    name: "Booking Flow Host",
    overrideDefaultEventTypes: true,
    eventTypes: [eventType, otherEventType],
  });
  const attendee: Attendee = {
    name: "Jane Attendee",
    email: users.trackEmail({ username: "jane-attendee", domain: "example.com" }),
    notes: "Looking forward to our intro call!",
  };

  await test.step("open the host's public profile page and pick the event type", async () => {
    await page.goto(`/${host.username}`);
    const eventTypeLinks = page.getByTestId("event-type-link");
    await expect(eventTypeLinks.filter({ hasText: otherEventType.title })).toBeVisible();
    await eventTypeLinks.filter({ hasText: eventType.title }).click();
  });

  await test.step("land on the public booking page of the event type", async () => {
    await page.waitForURL((url) => url.pathname === `/${host.username}/${eventType.slug}`);
    await expect(page.getByTestId("event-title")).toHaveText(eventType.title);
  });

  const startTime = await test.step("select a date and time slot", () =>
    selectFirstAvailableSlotNextMonth(page));

  await test.step("fill in the attendee details", async () => {
    await page.locator('[name="name"]').fill(attendee.name);
    await page.locator('[name="email"]').fill(attendee.email);
    await page.locator('[name="notes"]').fill(attendee.notes);
  });

  await test.step("confirm the booking", async () => {
    await confirmBooking(page);
    await page.waitForURL((url) => url.pathname.startsWith("/booking/"));
  });

  await test.step("see the booking confirmation with the attendee details", () =>
    expectSuccessPageToShow(page, attendee));

  await test.step("booking is persisted for the host with the selected slot", async () => {
    const bookingUid = new URL(page.url()).pathname.split("/").pop() ?? "";
    expect(bookingUid).not.toBe("");
    await expectBookingToBePersisted({ prisma, bookingUid, hostId: host.id, startTime, attendee });
  });
});

test("public booking flow: an attendee cannot confirm a booking without valid attendee details", async ({
  page,
  users,
  prisma,
}) => {
  const host = await users.create({
    overrideDefaultEventTypes: true,
    eventTypes: [eventType],
  });

  await page.goto(`/${host.username}/${eventType.slug}`);
  await selectFirstAvailableSlotNextMonth(page);

  const bookingRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/book/event")) bookingRequests.push(request.url());
  });
  const confirmButton = page.getByTestId("confirm-book-button");

  await test.step("empty form shows a required error for the name", async () => {
    await confirmButton.click();
    await expect(page.getByTestId("error-message-name")).toBeVisible();
  });

  await test.step("an invalid email shows an email error", async () => {
    await page.locator('[name="name"]').fill("Jane Attendee");
    await page.locator('[name="email"]').fill("not-an-email");
    await confirmButton.click();
    await expect(page.getByTestId("error-message-email")).toBeVisible();
  });

  await test.step("no booking is created", async () => {
    expect(bookingRequests).toEqual([]);
    await expect(page.getByTestId("success-page")).toHaveCount(0);
    await expect(page).toHaveURL((url) => url.pathname === `/${host.username}/${eventType.slug}`);
    expect(await prisma.booking.count({ where: { userId: host.id } })).toBe(0);
  });
});
