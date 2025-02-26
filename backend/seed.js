const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    // Példa épület létrehozása
    const building = await prisma.building.create({
        data: {
            name: "Főépület",
            coordinates: JSON.stringify(
                [
                    [17.6265, 47.6925],
                    [17.6275, 47.6925],
                    [17.6275, 47.6935],
                    [17.6265, 47.6935],
                    [17.6265, 47.6925]
                ]
            ), // 🔹 Már nem tartalmaz "Polygon"-t, csak koordinátákat!
            floors: {
                create: [
                    {
                        number: 0,
                        height: 0,
                        rooms: {
                            create: [
                                {
                                    name: "Aula",
                                    type: "Előadó",
                                    coordinates: JSON.stringify(
                                        [
                                            [17.6267, 47.6927],
                                            [17.6273, 47.6927],
                                            [17.6273, 47.6931],
                                            [17.6267, 47.6931],
                                            [17.6267, 47.6927]
                                        ]
                                    )
                                },
                                {
                                    name: "101-es terem",
                                    type: "Tanterm",
                                    coordinates: JSON.stringify(
                                        [
                                            [17.6268, 47.6928],
                                            [17.6272, 47.6928],
                                            [17.6272, 47.6930],
                                            [17.6268, 47.6930],
                                            [17.6268, 47.6928]
                                        ]
                                    )
                                }
                            ]
                        }
                    },
                    {
                        number: 1,
                        height: 3.5,
                        rooms: {
                            create: [
                                {
                                    name: "201-es terem",
                                    type: "Tanterm",
                                    coordinates: JSON.stringify(
                                        [
                                            [17.6269, 47.6929],
                                            [17.6271, 47.6929],
                                            [17.6271, 47.6931],
                                            [17.6269, 47.6931],
                                            [17.6269, 47.6929]
                                        ]
                                    )
                                }
                            ]
                        }
                    }
                ]
            }
        }
    });

    console.log(`✅ Épület létrehozva: ${building.name}`);
    console.log('✅ Database seeding completed!');
}

main()
    .catch(e => {
        console.error('🚨 Hiba:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
