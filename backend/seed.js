const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const building = await prisma.building.create({
    data: {
      name: "Főépület",
      coordinates: JSON.stringify([
        [17.6265, 47.6925],
        [17.6275, 47.6925],
        [17.6275, 47.6935],
        [17.6265, 47.6935],
        [17.6265, 47.6925]
      ]),
      floors: {
        create: [
          {
            number: 0,
            height: 0,
            coordinates: JSON.stringify([
              [17.6265, 47.6925],
              [17.6275, 47.6925],
              [17.6275, 47.6935],
              [17.6265, 47.6935],
              [17.6265, 47.6925]
            ]),
            rooms: {
              create: [
                {
                  name: "Aula",
                  type: "Terem",
                  coordinates: JSON.stringify([
                    [17.6267, 47.6927],
                    [17.6273, 47.6927],
                    [17.6273, 47.6931],
                    [17.6267, 47.6931],
                    [17.6267, 47.6927]
                  ])
                },
                {
                  name: "101-es terem",
                  type: "Terem",
                  coordinates: JSON.stringify([
                    [17.6268, 47.6928],
                    [17.6272, 47.6928],
                    [17.6272, 47.6930],
                    [17.6268, 47.6930],
                    [17.6268, 47.6928]
                  ])
                }
              ]
            }
          },
          {
            number: 1,
            height: 3.5,
            coordinates: JSON.stringify([
              [17.6265, 47.6925],
              [17.6275, 47.6925],
              [17.6275, 47.6935],
              [17.6265, 47.6935],
              [17.6265, 47.6925]
            ]),
            rooms: {
              create: [
                {
                  name: "Előadóterem 101",
                  type: "Terem",
                  coordinates: JSON.stringify([
                    [17.6269, 47.6929],
                    [17.6271, 47.6929],
                    [17.6271, 47.6931],
                    [17.6269, 47.6931],
                    [17.6269, 47.6929]
                  ])
                }
              ]
            }
          }
        ]
      }
    }
  });

  console.log("✅ Épület, szintek és szobák sikeresen feltöltve:", building);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
