const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const building = await prisma.building.create({
    data: {
      name: "Parkoló 3",
      shortName: "P3",
      group:"Parkolók",
      coordinates: JSON.stringify([
        [17.6265, 47.6925],
        [17.6275, 47.6925],
        [17.6275, 47.6935],
        [17.6265, 47.6935],
        [17.6265, 47.6925]
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
