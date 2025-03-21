const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function search(req, res) {
    try {
      const query = req.query.q;
      if (!query) {
        return res.status(400).json({ error: "A keresési lekérdezés szükséges." });
      }
  
      // Keresés épületekre
      const buildings = await prisma.building.findMany({
        where: {
          OR: [
            { name: { contains: query} },
            { shortName: { contains: query } }
          ]
        }
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
  };

  module.exports = { search };