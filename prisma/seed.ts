import { PrismaClient, type LeadStatus, type PropertyType } from "@prisma/client";
import { hashPassword } from "../src/lib/password-hash";
import { PERMISSIONS, ROLE_PERMISSIONS, type Role } from "../src/lib/permissions";

const prisma = new PrismaClient();

const LOCAL_DEMO_PASSWORD = "Amalfi-Demo-2026!";

function demoPassword() {
  const fromEnv = process.env.SEED_ADMIN_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  const appEnv = process.env.APP_ENV ?? "development";
  if (appEnv === "staging" || appEnv === "production") {
    throw new Error("Set SEED_ADMIN_PASSWORD before seeding staging or production.");
  }
  return LOCAL_DEMO_PASSWORD;
}

async function upsertUser(input: { email: string; name: string; role: Role; password: string }) {
  const password = await hashPassword(input.password);
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { name: input.name, role: input.role, emailVerified: true, disabledAt: null },
      })
    : await prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          role: input.role,
          emailVerified: true,
          twoFactorEnabled: false,
        },
      });
  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: user.id } },
    create: {
      providerId: "credential",
      accountId: user.id,
      userId: user.id,
      password,
    },
    update: { password },
  });
  return user;
}

async function main() {
  const password = demoPassword();

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      create: permission,
      update: { description: permission.description },
    });
  }
  for (const role of Object.keys(ROLE_PERMISSIONS) as Role[]) {
    await prisma.rolePermission.deleteMany({ where: { role } });
    await prisma.rolePermission.createMany({
      data: ROLE_PERMISSIONS[role].map((permissionKey) => ({ role, permissionKey })),
    });
  }

  const admin = await upsertUser({
    email: "eathen@amalfimedia.xyz",
    name: "Eathen",
    role: "ADMIN",
    password,
  });
  const staff = await upsertUser({
    email: "staff.demo@amalfimedia.xyz",
    name: "Avery Cole",
    role: "STAFF",
    password,
  });
  const clientUser = await upsertUser({
    email: "client.demo@amalfimedia.xyz",
    name: "Jordan Hale",
    role: "CLIENT",
    password,
  });

  const business = {
    name: "Amalfi Media",
    phone: "321-246-6018",
    email: "eathen@amalfimedia.xyz",
    city: "Orlando",
    state: "FL",
    region: "Central Florida",
    timezone: "America/New_York",
  };
  await prisma.appSetting.upsert({
    where: { key: "business" },
    create: { key: "business", value: business },
    update: {},
  });

  const lakeside = await prisma.brokerage.upsert({
    where: { nameKey: "lakeside-realty" },
    create: { name: "Lakeside Realty", nameKey: "lakeside-realty", city: "Orlando", phone: "407-555-0142" },
    update: { name: "Lakeside Realty", city: "Orlando" },
  });
  const orange = await prisma.brokerage.upsert({
    where: { nameKey: "orange-blossom-homes" },
    create: { name: "Orange Blossom Homes", nameKey: "orange-blossom-homes", city: "Winter Park" },
    update: { city: "Winter Park" },
  });
  const collective = await prisma.brokerage.upsert({
    where: { nameKey: "central-florida-collective" },
    create: { name: "Central Florida Collective", nameKey: "central-florida-collective", city: "Kissimmee" },
    update: { city: "Kissimmee" },
  });

  const sources = await Promise.all(
    ["Website", "Referral", "Grok outreach", "Repeat client"].map((name) =>
      prisma.leadSource.upsert({ where: { name }, create: { name }, update: {} }),
    ),
  );
  const sourceByName = Object.fromEntries(sources.map((source) => [source.name, source]));

  const photo = await prisma.service.upsert({
    where: { slug: "listing-photography" },
    create: {
      name: "Listing photography",
      slug: "listing-photography",
      kind: "PHOTO",
      pricingMode: "FIXED",
      priceCents: 12000,
      durationMin: 60,
      isAddOn: false,
      active: true,
      sortOrder: 1,
    },
    update: { name: "Listing photography", priceCents: 12000, active: true },
  });
  const addOns = [
    { name: "Drone stills", slug: "drone-stills", kind: "DRONE" as const, sortOrder: 2 },
    { name: "Walkthrough video", slug: "walkthrough-video", kind: "VIDEO" as const, sortOrder: 3 },
    { name: "Short-form clip", slug: "short-form-clip", kind: "SHORT_FORM" as const, sortOrder: 4 },
    { name: "Twilight exterior", slug: "twilight-exterior", kind: "TWILIGHT" as const, sortOrder: 5 },
    { name: "Floor plan", slug: "floor-plan", kind: "FLOOR_PLAN" as const, sortOrder: 6 },
  ];
  const addOnRows = [];
  for (const addOn of addOns) {
    addOnRows.push(
      await prisma.service.upsert({
        where: { slug: addOn.slug },
        create: {
          ...addOn,
          pricingMode: "QUOTE",
          priceCents: null,
          isAddOn: true,
          active: true,
          durationMin: 30,
        },
        update: { name: addOn.name, pricingMode: "QUOTE", isAddOn: true },
      }),
    );
  }

  const intro = await prisma.package.upsert({
    where: { slug: "intro-photo" },
    create: {
      name: "Introductory photography",
      slug: "intro-photo",
      description: "Introductory listing photography package.",
      priceCents: 12000,
      durationMin: 60,
      active: true,
      sortOrder: 1,
    },
    update: {
      name: "Introductory photography",
      priceCents: 12000,
      active: true,
      description: "Introductory listing photography package.",
    },
  });
  await prisma.package.upsert({
    where: { slug: "signature-photo" },
    create: {
      name: "Signature photography",
      slug: "signature-photo",
      description: "Price not set. Configure this package before offering it.",
      priceCents: 0,
      durationMin: 90,
      active: false,
      sortOrder: 2,
    },
    update: {},
  });
  await prisma.package.upsert({
    where: { slug: "twilight-package" },
    create: {
      name: "Twilight package",
      slug: "twilight-package",
      description: "Price not set. Configure this package before offering it.",
      priceCents: 0,
      durationMin: 45,
      active: false,
      sortOrder: 3,
    },
    update: {},
  });
  await prisma.packageService.upsert({
    where: { packageId_serviceId: { packageId: intro.id, serviceId: photo.id } },
    create: { packageId: intro.id, serviceId: photo.id, quantity: 1 },
    update: {},
  });
  for (const addOn of addOnRows) {
    await prisma.packageAddOn.upsert({
      where: { packageId_serviceId: { packageId: intro.id, serviceId: addOn.id } },
      create: { packageId: intro.id, serviceId: addOn.id },
      update: {},
    });
  }

  await prisma.serviceArea.upsert({
    where: { id: "seed-orlando-core" },
    create: {
      id: "seed-orlando-core",
      name: "Orlando core",
      zipCodes: ["32801", "32803", "32804", "32806"],
      travelFeeCents: 0,
      active: true,
    },
    update: { name: "Orlando core", zipCodes: ["32801", "32803", "32804", "32806"] },
  });
  await prisma.serviceArea.upsert({
    where: { id: "seed-central-florida" },
    create: {
      id: "seed-central-florida",
      name: "Greater Central Florida",
      zipCodes: [],
      travelFeeCents: 0,
      active: true,
    },
    update: { name: "Greater Central Florida" },
  });

  for (const weekday of [1, 2, 3, 4, 5]) {
    const id = `seed-hours-${weekday}`;
    await prisma.availabilityRule.upsert({
      where: { id },
      create: { id, weekday, startMin: 9 * 60, endMin: 17 * 60 },
      update: { startMin: 9 * 60, endMin: 17 * 60 },
    });
  }

  const leads: Array<{
    ref: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    city: string;
    status: LeadStatus;
    brokerageId: string;
    source: string;
    followUp?: Date;
    ownerId: string;
  }> = [
    {
      ref: "seed:maya-ellison",
      firstName: "Maya",
      lastName: "Ellison",
      email: "maya.ellison@example.com",
      phone: "321-555-0198",
      city: "Orlando",
      status: "ENGAGED",
      brokerageId: lakeside.id,
      source: "Referral",
      followUp: new Date(Date.now() - 86400000),
      ownerId: admin.id,
    },
    {
      ref: "seed:luis-ortega",
      firstName: "Luis",
      lastName: "Ortega",
      email: "luis.ortega@example.com",
      phone: "407-555-0177",
      city: "Winter Park",
      status: "NEW",
      brokerageId: orange.id,
      source: "Website",
      followUp: new Date(Date.now() + 2 * 86400000),
      ownerId: staff.id,
    },
    {
      ref: "seed:priya-shah",
      firstName: "Priya",
      lastName: "Shah",
      email: "priya.shah@example.com",
      phone: "689-555-0114",
      city: "Kissimmee",
      status: "CONTACTED",
      brokerageId: collective.id,
      source: "Grok outreach",
      ownerId: staff.id,
    },
    {
      ref: "seed:owen-brooks",
      firstName: "Owen",
      lastName: "Brooks",
      email: "owen.brooks@example.com",
      phone: "321-555-0160",
      city: "Orlando",
      status: "QUALIFIED",
      brokerageId: lakeside.id,
      source: "Repeat client",
      ownerId: admin.id,
    },
    {
      ref: "seed:nina-cho",
      firstName: "Nina",
      lastName: "Cho",
      email: "nina.cho@example.com",
      phone: "407-555-0188",
      city: "Maitland",
      status: "NURTURE",
      brokerageId: orange.id,
      source: "Website",
      ownerId: staff.id,
    },
  ];

  for (const lead of leads) {
    const saved = await prisma.lead.upsert({
      where: { externalRef: lead.ref },
      create: {
        externalRef: lead.ref,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        emailNormalized: lead.email,
        phone: lead.phone,
        phoneE164: `+1${lead.phone.replace(/\D/g, "")}`,
        city: lead.city,
        status: lead.status,
        brokerageId: lead.brokerageId,
        sourceId: sourceByName[lead.source]?.id,
        ownerId: lead.ownerId,
        nextFollowUpAt: lead.followUp,
        tags: ["central-florida"],
      },
      update: {
        status: lead.status,
        nextFollowUpAt: lead.followUp,
        ownerId: lead.ownerId,
      },
    });
    const note = await prisma.leadActivity.findFirst({ where: { leadId: saved.id, summary: "Introduced from the seed data." } });
    if (!note) {
      await prisma.leadActivity.create({
        data: {
          leadId: saved.id,
          actorId: admin.id,
          type: "NOTE",
          summary: "Introduced from the seed data.",
        },
      });
    }
  }

  const client = await prisma.client.upsert({
    where: { userId: clientUser.id },
    create: {
      userId: clientUser.id,
      brokerageId: lakeside.id,
      firstName: "Jordan",
      lastName: "Hale",
      email: clientUser.email,
      phone: "321-555-0108",
      allowUnpaidDownloads: false,
    },
    update: { allowUnpaidDownloads: false, brokerageId: lakeside.id },
  });

  const property = await prisma.property.upsert({
    where: { id: "seed-property-hale" },
    create: {
      id: "seed-property-hale",
      clientId: client.id,
      addressLine1: "1842 Lake Conway Shore",
      city: "Orlando",
      state: "FL",
      zip: "32806",
      propertyType: "SINGLE_FAMILY" satisfies PropertyType,
      sqft: 2140,
      beds: 4,
      bathsHalf: 5,
    },
    update: { clientId: client.id },
  });

  let order = await prisma.order.findFirst({ where: { internalNotes: "seed:intro-order" } });
  if (!order) {
    order = await prisma.order.create({
      data: {
        clientId: client.id,
        propertyId: property.id,
        status: "DELIVERED",
        subtotalCents: 12000,
        totalCents: 12000,
        internalNotes: "seed:intro-order",
        items: {
          create: { packageId: intro.id, label: "Introductory photography", quantity: 1, unitPriceCents: 12000 },
        },
        history: { create: { toStatus: "DELIVERED", actorId: admin.id, note: "Seeded delivered order" } },
      },
    });
  }
  const invoice = await prisma.invoice.upsert({
    where: { number: "INV-2026-0001" },
    create: {
      number: "INV-2026-0001",
      clientId: client.id,
      orderId: order.id,
      status: "PAID",
      subtotalCents: 12000,
      totalCents: 12000,
      amountPaidCents: 12000,
      paidAt: new Date(),
      issuedAt: new Date(),
      lineItems: { create: { description: "Introductory photography", quantity: 1, unitPriceCents: 12000, totalCents: 12000 } },
    },
    update: { status: "PAID", amountPaidCents: 12000 },
  });
  await prisma.payment.upsert({
    where: { id: "seed-payment-intro" },
    create: {
      id: "seed-payment-intro",
      invoiceId: invoice.id,
      status: "SUCCEEDED",
      amountCents: 12000,
      method: "card",
    },
    update: { status: "SUCCEEDED" },
  });
  await prisma.gallery.upsert({
    where: { id: "seed-gallery-hale" },
    create: {
      id: "seed-gallery-hale",
      orderId: order.id,
      clientId: client.id,
      propertyId: property.id,
      title: "1842 Lake Conway Shore",
      status: "DRAFT",
      requirePaid: true,
    },
    update: { requirePaid: true },
  });

  const requested = await prisma.order.findFirst({ where: { internalNotes: "seed:requested-order" } });
  if (!requested) {
    await prisma.order.create({
      data: {
        clientId: client.id,
        propertyId: property.id,
        status: "REQUESTED",
        subtotalCents: 0,
        totalCents: 0,
        internalNotes: "seed:requested-order",
        items: { create: { label: "Quote pending", quantity: 1, unitPriceCents: null } },
      },
    });
  }

  console.log("Seeded Amalfi Media demo data.");
  console.log(`Admin ${admin.email}`);
  console.log(`Staff ${staff.email}`);
  console.log(`Client ${clientUser.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
