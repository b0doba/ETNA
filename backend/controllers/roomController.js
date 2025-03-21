const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function getRooms (req, res) {
    try {
      const rooms = await prisma.room.findMany({
        include: { floor: { include: { building: true } } },
      });
  
      const geoJsonData = {
        type: "FeatureCollection",
        features: rooms.map((room) => ({
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: room.coordinates
            ? [JSON.parse(room.coordinates)] // JSON-string konvertálása tömbbé
            : []
          },
          properties: {
            id: room.id,
            name: room.name,
            floor: room.floor.number,
            floorId: room.floor.id,
            type: room.type,
            building: room.floor.building.name,
            category: "room",
          },
        })),
      };
  
      res.json(geoJsonData);
    } catch (error) {
      console.error("🚨 Hiba történt:", error);
      res.status(500).json({ error: "Hiba a termek lekérdezésekor" });
    }
  }

  async function updateRooms(req, res) {
    try {
      const updatedRooms = req.body;
      console.log("🔄 Frissített szobák:", JSON.stringify(updatedRooms, null, 2));
  
      for (const room of updatedRooms.features) {
        console.log(`🛠 Frissítés alatt: Room ID = ${room.properties.id}`);
  
        const existingRoom = await prisma.room.findUnique({
          where: { id: room.properties.id }
        });
  
        if (!existingRoom) {
          console.warn(`⚠️ Kihagyott frissítés: Room ID=${room.properties.id} nem létezik.`);
          continue;
        }
  
        const cleanedCoordinates = room.geometry.coordinates.length === 1
          ? room.geometry.coordinates[0]
          : room.geometry.coordinates;
  
        const roomName = room.properties.name || existingRoom.name; // Ha nincs name, akkor használjuk a meglévőt
        const roomType = room.properties.type || existingRoom.type || "Unknown";
  
        console.log("📌 Mentendő adatok:", {
          id: room.properties.id,
          name: roomName,
          type: roomType,
          coordinates: cleanedCoordinates,
        });
  
        await prisma.room.upsert({
          where: { id: room.properties.id },
          update: {
            name: room.properties.name || roomName,
            type: room.properties.type || roomType,
            coordinates: JSON.stringify(cleanedCoordinates),
          },
          create: {
            id: room.properties.id,
            name: roomName,
            type: roomType,
            coordinates: JSON.stringify(cleanedCoordinates),
            floorId: existingRoom.floorId
          },
        });
      }
  
      res.json({ success: true, message: "Szobák frissítve!" });
    } catch (error) {
      console.error("🚨 Hiba az szobák frissítésekor:", error);
      res.status(500).json({ error: "Nem sikerült frissíteni az szobákat." });
    }
  }

  async function createRooms (req, res) {
    try {
      const { floorId, name, type, coordinates } = req.body;
  
      if (!floorId || !name || !type) {
        return res.status(400).json({ error: "Minden mező kitöltése kötelező!" });
      }
  
      const newRoom = await prisma.room.create({
        data: {
          floorId,
          name,
          type,
          coordinates: coordinates ? JSON.stringify(coordinates) : [],
        },
      });
  
      res.status(201).json({ success: true, message: "Terem sikeresen létrehozva!", room: newRoom });
    } catch (error) {
      console.error("🚨 Hiba a terem létrehozásakor:", error);
      res.status(500).json({ error: "Nem sikerült létrehozni a termet." });
    }
  }

  async function deleteRoom (req, res) {
    try {
      const { id } = req.params;
  
      if (!id) {
        return res.status(400).json({ error: "A szoba ID megadása kötelező!" });
      }
  
      const roomId = parseInt(id, 10);
  
      // Ellenőrizzük, hogy létezik-e a szoba
      const room = await prisma.room.findUnique({
        where: { id: roomId },
      });
  
      if (!room) {
        return res.status(404).json({ error: "A szoba nem található!" });
      }
  
      // Szoba törlése
      await prisma.room.delete({ where: { id: roomId } });
  
      res.status(200).json({ success: true, message: "Szoba sikeresen törölve!" });
    } catch (error) {
      console.error("🚨 Hiba a szoba törlésekor:", error);
      res.status(500).json({ error: "Nem sikerült törölni a szobát." });
    }
  }

  module.exports = { getRooms, updateRooms, createRooms, deleteRoom};
