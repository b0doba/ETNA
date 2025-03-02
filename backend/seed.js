const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const building = await prisma.building.create({
    data: {
      name: "Kollégium 1",
      shortName: "K1",
      group:"Kollégiumok",
      coordinates: JSON.stringify([
        [17.6265, 47.6925],
        [17.6275, 47.6925],
        [17.6275, 47.6935],
        [17.6265, 47.6935],
        [17.6265, 47.6925]
      ]),
    },
  });
  await prisma.building.create({
    data: {
      name: "Kollégium 2",
      shortName: "K2",
      group: "Kollégiumok",
      coordinates: JSON.stringify([
        [17.6280, 47.6920],
        [17.6290, 47.6920],
        [17.6290, 47.6930],
        [17.6280, 47.6930],
        [17.6280, 47.6920]
      ]),
    },
  });

  // Sportcsarnokok
  await prisma.building.create({
    data: {
      name: "Sportcsarnok 1",
      shortName: "S1",
      group: "Sportcsarnokok",
      coordinates: JSON.stringify([
        [17.6300, 47.6915],
        [17.6310, 47.6915],
        [17.6310, 47.6925],
        [17.6300, 47.6925],
        [17.6300, 47.6915]
      ]),
    },
  });
  await prisma.building.create({
    data: {
      name: "Sportcsarnok 2",
      shortName: "S2",
      group: "Sportcsarnokok",
      coordinates: JSON.stringify([
        [17.6300, 47.6915],
        [17.6310, 47.6915],
        [17.6310, 47.6925],
        [17.6300, 47.6925],
        [17.6300, 47.6915]
      ]),
    },
  });
  // Parkolók
  await prisma.building.create({
    data: {
      name: "Parkoló 1",
      shortName: "P1",
      group: "Parkolók",
      coordinates: JSON.stringify([
        [17.6320, 47.6930],
        [17.6330, 47.6930],
        [17.6330, 47.6940],
        [17.6320, 47.6940],
        [17.6320, 47.6930]
      ]),
    },
  });
  await prisma.building.create({
    data: {
      name: "Parkoló 2",
      shortName: "P2",
      group: "Parkolók",
      coordinates: JSON.stringify([
        [17.6320, 47.6930],
        [17.6330, 47.6930],
        [17.6330, 47.6940],
        [17.6320, 47.6940],
        [17.6320, 47.6930]
      ]),
    },
  });

  console.log("✅ Épület sikeresen feltöltve:", building);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
