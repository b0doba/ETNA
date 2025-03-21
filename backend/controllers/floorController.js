const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function getFloors (req, res) {
    try {
      const { building } = req.query; // Kinyerjük a query paramétert
  
      // Ellenőrizzük, hogy van-e megadott building név
      const whereCondition = building
        ? { building: { name: building } }
        : {};
  
      const floors = await prisma.floor.findMany({
        where: whereCondition, // Szűrés a megadott épületnév szerint
        include: {
          building: true,
          rooms: true,
        },
      });
  
      const geoJsonData = {
        type: "FeatureCollection",
        features: floors.map((floor) => ({
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: floor.coordinates
              ? [JSON.parse(floor.coordinates)]
              : [],
          },
          properties: {
            id: floor.id,
            number: floor.number,
            height: floor.height,
            building: floor.building.name,
            buildingId: floor.building.id,
            category: "floor",
          },
        })),
      };
  
      res.json(geoJsonData);
    } catch (error) {
      console.error("🚨 Hiba történt:", error);
      res.status(500).json({ error: "Nem sikerült lekérni a szinteket." });
    }
  }

  async function updateFloors (req, res) {
    try {
      const updatedFloors = req.body;
      console.log("🔄 Frissített szintek:", JSON.stringify(updatedFloors, null, 2));
  
      for (const floor of updatedFloors.features) {
        console.log(`🛠 Frissítés alatt: Floor ID = ${floor.properties.id}`);
  
        const existingFloor = await prisma.floor.findUnique({
          where: { id: floor.properties.id },
        });
  
        if (!existingFloor) {
          console.warn(`⚠️ Kihagyott frissítés: Floor ID=${floor.properties.id} nem létezik.`);
          continue;
        }
  
        const cleanedCoordinates =
          floor.geometry.coordinates.length === 1
            ? floor.geometry.coordinates[0]
            : floor.geometry.coordinates;
  
        console.log("📌 Mentendő adatok:", {
          id: floor.properties.id,
          coordinates: cleanedCoordinates,
        });
  
        await prisma.floor.upsert({
          where: { id: floor.properties.id },
          update: {
            number: floor.properties.number || existingFloor.number,
            height: floor.properties.height || existingFloor.height,
            coordinates: JSON.stringify(cleanedCoordinates), 
          },
          create: {
            id: floor.properties.id,
            number: existingFloor.number,
            height: existingFloor.height,
            buildingId: existingFloor.buildingId,
            coordinates: JSON.stringify(cleanedCoordinates),
          },
        });
      }
  
      res.json({ success: true, message: "Szintek frissítve!" });
    } catch (error) {
      console.error("🚨 Hiba a szintek frissítésekor:", error);
      res.status(500).json({ error: "Nem sikerült frissíteni a szinteket." });
    }
  }

  async function createFloors (req, res) {
    try {
      const { buildingId, number, height, coordinates } = req.body;
  
      if (!buildingId || number === undefined || height === undefined) {
        return res.status(400).json({ error: "Minden mező kitöltése kötelező!" });
      }
  
      const newFloor = await prisma.floor.create({
        data: {
          buildingId,
          number,
          height,
          coordinates: coordinates ? JSON.stringify(coordinates) : [],
        },
      });
  
      res.status(201).json({ success: true, message: "Emelet sikeresen létrehozva!", floor: newFloor });
    } catch (error) {
      console.error("🚨 Hiba az emelet létrehozásakor:", error);
      res.status(500).json({ error: "Nem sikerült létrehozni az emeletet." });
    }
  }

  async function deleteFloor (req, res) {
    try {
      const { id } = req.params;
  
      if (!id) {
        return res.status(400).json({ error: "Az emelet ID megadása kötelező!" });
      }
  
      const floorId = parseInt(id, 10);
  
      // Ellenőrizzük, hogy létezik-e az emelet
      const floor = await prisma.floor.findUnique({
        where: { id: floorId },
        include: { rooms: true } // Betöltjük a szobákat is
      });
  
      if (!floor) {
        return res.status(404).json({ error: "Az emelet nem található!" });
      }
  
      // Törlés: Először szobákat, majd az emeletet töröljük
      await prisma.room.deleteMany({ where: { floorId } }); // Szobák törlése
      await prisma.floor.delete({ where: { id: floorId } }); // Emelet törlése
  
      res.status(200).json({ success: true, message: "Emelet és összes terme törölve!" });
    } catch (error) {
      console.error("🚨 Hiba az emelet törlésekor:", error);
      res.status(500).json({ error: "Nem sikerült törölni az emeletet." });
    }
  }

  module.exports = { getFloors, updateFloors, createFloors, deleteFloor};