const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();

app.use(express.json());
app.use(cors());

// API az épületek lekérésére
app.get("/api/buildings", async (req, res) => {
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
          category: "building",
        },
      })),
    };

    res.json(geoJsonData);
  } catch (error) {
    console.error("🚨 Hiba történt:", error);
    res.status(500).json({ error: "Nem sikerült lekérni az épületeket." });
  }
});

// **API a termek lekérésére**
app.get("/api/rooms", async (req, res) => {
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
});

// API a szintek (floors) lekérésére
app.get("/api/floors", async (req, res) => {
  try {
    const floors = await prisma.floor.findMany({
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
          category: "floor",
        },
      })),
    };

    res.json(geoJsonData);
  } catch (error) {
    console.error("🚨 Hiba történt:", error);
    res.status(500).json({ error: "Nem sikerült lekérni a szinteket." });
  }
});

app.post('/api/updateBuildings', async (req, res) => {
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
        update: { coordinates: JSON.stringify(cleanedCoordinates) },
        create: {
          id: building.properties.id,
          name: buildingName, 
          coordinates: JSON.stringify(cleanedCoordinates),
        },
      });
    }

    res.json({ success: true, message: "Épületek frissítve!" });
  } catch (error) {
    console.error("🚨 Hiba az épületek frissítésekor:", error);
    res.status(500).json({ error: "Nem sikerült frissíteni az épületeket." });
  }
});


app.post('/api/updateRooms', async (req, res) => {
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
        update: { coordinates: JSON.stringify(cleanedCoordinates) },
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
});

app.post('/api/updateFloors', async (req, res) => {
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
        update: { coordinates: JSON.stringify(cleanedCoordinates) },
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
});

// Backend - Keresési API
app.get("/api/search", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: "A keresési lekérdezés szükséges." });
    }

    // Keresés épületekre
    const buildings = await prisma.building.findMany({
      where: { name: { contains: query} },
    });

    // Keresés termekre (és hozzákapcsoljuk a szintjüket is!)
    const rooms = await prisma.room.findMany({
      where: { name: { contains: query } },
      include: { floor: { include: { building: true } } },
    });

    res.json({ buildings, rooms });
  } catch (error) {
    console.error("🚨 Hiba a keresés során:", error);
    res.status(500).json({ error: "Hiba történt a keresés során." });
  }
});


// Szerver indítása
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Szerver fut a http://localhost:${PORT} címen`);
});
