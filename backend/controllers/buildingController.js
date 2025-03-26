const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function getBuildings(req, res) {
    try {
      const buildings = await prisma.building.findMany({
        include: { floors: true },
      });
  
      const geoJsonData = {
        type: "FeatureCollection",
        features: buildings.map((building) => ({
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: building.coordinates
            ? [JSON.parse(building.coordinates)] // JSON-string konvertálása tömbbé
            : []
          },
          properties: {
            id: building.id,
            name: building.name,
            shortName: building.shortName ?? null,
            group: building.group ?? null,
            coordinates: building.coordinates ? JSON.parse(building.coordinates) : null,
            category: "building",
          },
        })),
      };
  
      res.json(geoJsonData);
    } catch (error) {
      console.error("🚨 Hiba történt:", error);
      res.status(500).json({ error: "Nem sikerült lekérni az épületeket." });
    }
  }

  async function updateBuildings(req, res) {
    try {
      const updatedBuildings = req.body;
      console.log("🔄 Frissített épületek:", JSON.stringify(updatedBuildings, null, 2));
  
      for (const building of updatedBuildings.features) {
        console.log(`🛠 Frissítés alatt: Build ID = ${building.properties.id}`);
  
        const existingBuilding = await prisma.building.findUnique({
          where: { id: building.properties.id }
        });
  
        if (!existingBuilding) {
          console.warn(`⚠️ Kihagyott frissítés: Building ID=${building.properties.id} nem létezik.`);
          continue;
        }
  
        const cleanedCoordinates = building.geometry.coordinates.length === 1
          ? building.geometry.coordinates[0]
          : building.geometry.coordinates;
  
        const buildingName = building.properties.name || existingBuilding.name; // Ha nincs name, akkor használjuk a meglévőt
  
        console.log("📌 Mentendő adatok:", {
          id: building.properties.id,
          name: buildingName,
          coordinates: cleanedCoordinates,
        });
  
        await prisma.building.upsert({
          where: { id: building.properties.id },
          update: {
            name: building.properties.name || buildingName,
            shortName: building.properties.shortName || existingBuilding.shortName,
            group: building.properties.group || existingBuilding.group,
            coordinates: JSON.stringify(cleanedCoordinates),
          },
          create: {
            id: building.properties.id,
            name: buildingName,
            shortName: building.properties.shortName || "",
            group: building.properties.group || "",
            coordinates: JSON.stringify(cleanedCoordinates),
          },
        });
      }
  
      res.json({ success: true, message: "Épületek frissítve!" });
    } catch (error) {
      console.error("🚨 Hiba az épületek frissítésekor:", error);
      res.status(500).json({ error: "Nem sikerült frissíteni az épületeket." });
    }
  }

  async function createBuildings (req, res) {
    try {
      const { name, shortName, group, coordinates, numberOfFloors} = req.body;
  
      if (!name || !coordinates) {
        return res.status(400).json({ error: "Név és koordináták szükségesek!" });
      }
  
      /*const totalFloors = Number.isInteger(numberOfFloors) ? numberOfFloors : null;
      const validFloorHeight = typeof floorHeight === "number" ? floorHeight : 3.0;*/
  
      const newBuilding = await prisma.building.create({
        data: {
          name,
          shortName: shortName || null,
          group: group || "",
          coordinates: coordinates ? JSON.stringify(coordinates) : [],
        },
      });
  
      if (Number.isInteger(numberOfFloors) && numberOfFloors > 0) {
        const validFloorHeight = 3.0;
  
        const floorsData = Array.from({ length: numberOfFloors  }, (_, index) => ({
          buildingId: newBuilding.id,
          number: index,
          height: validFloorHeight,
          coordinates: coordinates ? JSON.stringify(coordinates) : [],
        }));
      }
  
      await prisma.floor.createMany({
        data: floorsData,
      });
  
      res.status(201).json({
        success: true,
        message: `Épület sikeresen létrehozva ${numberOfFloors} emelettel!`,
        building: newBuilding,
      });
    } catch (error) {
      console.error("🚨 Hiba az épület létrehozásakor:", error);
      res.status(500).json({ error: "Nem sikerült létrehozni az épületet." });
    }
  }

 async function deleteBuilding (req, res) {
    try {
      const { id } = req.params;
  
      if (!id) {
        return res.status(400).json({ error: "Az épület ID megadása kötelező!" });
      }
  
      const buildingId = parseInt(id, 10);
  
      // Ellenőrizzük, hogy létezik-e az épület
      const building = await prisma.building.findUnique({
        where: { id: buildingId },
        include: { floors: { include: { rooms: true } } } // Betöltjük az emeleteket és szobákat is
      });
  
      if (!building) {
        return res.status(404).json({ error: "Az épület nem található!" });
      }
  
      // Törlés: Először szobákat, majd szinteket, végül az épületet töröljük
      for (const floor of building.floors) {
        await prisma.room.deleteMany({ where: { floorId: floor.id } }); // Szobák törlése
      }
      await prisma.floor.deleteMany({ where: { buildingId } }); // Szintek törlése
      await prisma.building.delete({ where: { id: buildingId } }); // Épület törlése
  
      res.status(200).json({ success: true, message: "Épület és összes emelete és terme törölve!" });
    } catch (error) {
      console.error("🚨 Hiba az épület törlésekor:", error);
      res.status(500).json({ error: "Nem sikerült törölni az épületet." });
    }
  }

  module.exports = { getBuildings, updateBuildings, createBuildings, deleteBuilding};
