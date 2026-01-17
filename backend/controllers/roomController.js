const haversine = require("haversine-distance");
const { splitEdgeLogic } = require("./graphController");

function projectPointToSegment(p, a, b) {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;

  const dx = bx - ax;
  const dy = by - ay;

  if (dx === 0 && dy === 0) return a;

  const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  const clampedT = Math.max(0, Math.min(1, t));

  return [ax + clampedT * dx, ay + clampedT * dy];
}

function getDistance(p1, p2) {
  return haversine({ lat: p1[1], lng: p1[0] }, { lat: p2[1], lng: p2[0] });
}

async function getNearestProjection(point, buildingId, floorId, prisma) {
  const edges = await prisma.edge.findMany({
    where: { type: "hallway" },
    include: {
      fromNode: true,
      toNode: true,
    },
  });

  let minDistance = Infinity;
  let bestPoint = null;

  for (const edge of edges) {
    
    if (!edge.fromNode || !edge.toNode) {
      console.warn(`⛔ Hiányzó kapcsolódó node az edge ${edge.id} esetén.`);
      continue;
    }
    
    const waypoints = edge.waypoints;
    if (!waypoints || waypoints.length < 2) continue;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i];
      const b = waypoints[i + 1];

      const projected = projectPointToSegment(point, a, b);
      const dist = getDistance(point, projected);

      if (dist < minDistance) {
        minDistance = dist;
        bestPoint = projected;
      }
    }
  }
  return bestPoint;
}



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
            category: room.category || "room",
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

        let center = null;
        if (cleanedCoordinates && cleanedCoordinates.length > 0) {
          let minLng = cleanedCoordinates[0][0], maxLng = cleanedCoordinates[0][0];
          let minLat = cleanedCoordinates[0][1], maxLat = cleanedCoordinates[0][1];

          for (const [lng, lat] of cleanedCoordinates) {
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          }

          const centerLng = (minLng + maxLng) / 2;
          const centerLat = (minLat + maxLat) / 2;
          center = [[centerLng, centerLat]];
        }
  
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
            category: room.properties.category || existingRoom.category || "room",
            coordinates: JSON.stringify(cleanedCoordinates),
          },
          create: {
            id: room.properties.id,
            name: roomName,
            type: roomType,
            category: room.properties.category || "room",
            coordinates: JSON.stringify(cleanedCoordinates),
            floorId: existingRoom.floorId
          },
        });

        if (center && existingRoom.category === "room") {
          const nodeName = `${roomName}_node`;
  
          const existingNode = await prisma.node.findFirst({
            where: {
              name: nodeName,
              type: "terem",
              floorId: existingRoom.floorId,
            },
          });
          //ieglenes kikapcsolás
          // const projected = await getNearestProjection(center[0], existingRoom.floorId, existingRoom.buildingId, prisma);
          // const finalCoord = projected ? [projected] : center;
          const finalCoord = center;
  
          if (existingNode) {
            await prisma.node.update({
              where: { id: existingNode.id },
              data: {
                coordinates: JSON.stringify(finalCoord),
              },
            });
  
            console.log(`📍 Node "${nodeName}" pozíció frissítve.`);
            // if (projected) {
            //   const hallwayEdges = await prisma.edge.findMany({
            //     where: { type: "hallway" },
            //     include: {
            //       fromNode: true,
            //       toNode: true,
            //     },
            //   });
    
            //   for (const edge of hallwayEdges) {
            //     const waypoints = edge.waypoints;
            //     if (!waypoints || waypoints.length < 2) {
            //       console.warn(`⚠️ Edge ${edge.id} kihagyva, mert nem érvényes (waypoints < 2)`);
            //       continue;
            //     }
            //     const isOnWaypoint = waypoints.some(
            //       wp => getDistance(wp, projected) < 0.2
            //     );
            //     if (isOnWaypoint) {
            //       console.log(`🔁 A node projectionja már egy waypointon ül (edgeId=${edge.id}), split kihagyva.`);
            //       continue;
            //     }

            //     for (let i = 0; i < waypoints.length - 1; i++) {
            //       const a = waypoints[i];
            //       const b = waypoints[i + 1];
            //       const [px, py] = projected;
    
            //       const distAB = Math.hypot(b[0] - a[0], b[1] - a[1]);
            //       const distToLine = Math.abs(
            //         (b[0] - a[0]) * (a[1] - py) - (a[0] - px) * (b[1] - a[1])
            //       ) / distAB;
    
            //       if (distToLine < 0.0001) {
            //         const alreadyExists = await prisma.edge.findFirst({
            //           where: {
            //             type: "hallway",
            //             OR: [
            //               {
            //                 fromNodeId: existingNode.id,
            //                 toNodeId: edge.fromNodeId,
            //               },
            //               {
            //                 fromNodeId: edge.fromNodeId,
            //                 toNodeId: existingNode.id,
            //               },
            //             ],
            //           },
            //         });
            
            //         if (!alreadyExists) {
            //           await splitEdgeLogic({
            //             edgeId: edge.id,
            //             nodeId: existingNode.id,
            //             projectionPoint: projected,
            //           });
            //         } else {
            //           console.log(`⛔ Már létezik hallway edge a node-hoz (${existingNode.id}), kihagyva a splitet.`);
            //         }                    
            //           break;
            //       }
            //       console.log(`📐 distToLine számítás: ${distToLine} (edgeId=${edge.id})`);
            //     }
            //   }
            // }
          }
        }
      }
  
      res.json({ success: true, message: "Szobák frissítve!" });
    } catch (error) {
      console.error("🚨 Hiba az szobák frissítésekor:", error);
      res.status(500).json({ error: "Nem sikerült frissíteni az szobákat." });
    }
  }

  async function createRooms (req, res) {
    try {
      const { floorId, name, type, category, coordinates } = req.body;
  
      if (!floorId || !name || !type) {
        return res.status(400).json({ error: "Minden mező kitöltése kötelező!" });
      }

      if ((category || "room") === "room" && !name) {
        return res.status(400).json({ error: "Terem esetén a név kötelező!" });
      }
  
      const newRoom = await prisma.room.create({
        data: {
          floorId,
          name,
          type,
          category: category || "room", 
          coordinates: coordinates ? JSON.stringify(coordinates) : [],
        },
        include: {
          floor: true,
        }
      });

      let center = null;

      let rawPoints = [];

      if (Array.isArray(coordinates)) {
        if (Array.isArray(coordinates[0][0])) {
          // GeoJSON style: [[[lng, lat], ...]]
          rawPoints = coordinates[0];
        } else {
          // Már csak a polygon pontjai: [[lng, lat], ...]
          rawPoints = coordinates;
        }
      }

      if (rawPoints.length > 0) {
        let minLng = rawPoints[0][0], maxLng = rawPoints[0][0];
        let minLat = rawPoints[0][1], maxLat = rawPoints[0][1];

        for (const [lng, lat] of rawPoints) {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }

        const centerLng = (minLng + maxLng) / 2;
        const centerLat = (minLat + maxLat) / 2;
        center = [[centerLng, centerLat]];
      }

      // Node létrehozása
      if (center && newRoom.category === "room") {
        //const projected = await getNearestProjection(center[0], newRoom.floorId, prisma);
        const finalCoord = center;
        await prisma.node.create({
          data: {
            name: `${newRoom.name}_node`,
            type: "terem",
            floorId: newRoom.floorId,
            buildingId: newRoom.floor.buildingId,
            coordinates: JSON.stringify(finalCoord),
            iconUrl: "",
          },
        });
      }
  
      res.status(201).json({ success: true, message: "Terem és node sikeresen létrehozva!", room: newRoom });
    } catch (error) {
      console.error("🚨 Hiba a terem vagy node létrehozásakor:", error);
      res.status(500).json({ error: "Nem sikerült létrehozni a termet vagy node-ot." });
    }
  }

  async function deleteRoom(req, res) {
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
  
      // Node törlése, ha van ilyen nevű node
      const nodeName = `${room.name}_node`;
      if (room.category !== "room") {
        await prisma.room.delete({ where: { id: roomId } });
        return res.status(200).json({
          success: true,
          message: "Terület sikeresen törölve!",
        });
      }
      const node = await prisma.node.findFirst({
        where: {
          name: nodeName,
          floorId: room.floorId,
          type: "terem",
        },
      });
  
      if (node) {
        await prisma.node.delete({
          where: { id: node.id },
        });
        console.log(`🗑️ Node "${nodeName}" törölve (ID: ${node.id})`);
      } else {
        console.log(`⚠️ Node "${nodeName}" nem található, nem történt törlés.`);
      }
  
      // Szoba törlése
      await prisma.room.delete({ where: { id: roomId } });
  
      res.status(200).json({ success: true, message: "Szoba és node sikeresen törölve!" });
    } catch (error) {
      console.error("🚨 Hiba a szoba törlésekor:", error);
      res.status(500).json({ error: "Nem sikerült törölni a szobát." });
    }
  }

  async function copyRoom(req, res) {
  try {
    const roomId = parseInt(req.params.id, 10);

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { floor: true },
    });

    if (!room) {
      return res.status(404).json({ error: "A terem nem található" });
    }

    const newRoomName = `${room.name}_masolt`;

    // 🔁 terem másolása
    const newRoom = await prisma.room.create({
      data: {
        name: newRoomName,
        type: room.type,
        floorId: room.floorId,
        category: room.category || "room",
        coordinates: room.coordinates, // 👈 alakzat 1:1 másolva
      },
    });

    // 📍 node másolása (új név!)
    const originalNode = await prisma.node.findFirst({
      where: {
        name: `${room.name}_node`,
        floorId: room.floorId,
        type: "terem",
      },
    });

    if (room.category === "room" && originalNode) {
      await prisma.node.create({
        data: {
          name: `${newRoomName}_node`,
          type: "terem",
          floorId: originalNode.floorId,
          buildingId: originalNode.buildingId,
          coordinates: originalNode.coordinates,
          iconUrl: originalNode.iconUrl || "",
        },
      });
    }

    res.status(201).json({
      success: true,
      message: "Terem sikeresen lemásolva",
      room: newRoom,
    });
  } catch (error) {
    console.error("🚨 Hiba a terem másolásakor:", error);
    res.status(500).json({ error: "Nem sikerült a terem másolása" });
  }
}


module.exports = { getRooms, updateRooms, createRooms, deleteRoom, copyRoom};
