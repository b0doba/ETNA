/*
  Warnings:

  - You are about to drop the column `height` on the `Room` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "BuildingSize" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "buildingId" INTEGER NOT NULL,
    "height" REAL NOT NULL,
    "width" REAL NOT NULL,
    "length" REAL NOT NULL,
    CONSTRAINT "BuildingSize_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoomSize" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "height" REAL NOT NULL,
    "width" REAL NOT NULL,
    "length" REAL NOT NULL,
    CONSTRAINT "RoomSize_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Building" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "longitude" REAL NOT NULL,
    "latitude" REAL NOT NULL
);
INSERT INTO "new_Building" ("id", "latitude", "location", "longitude", "name") SELECT "id", "latitude", "location", "longitude", "name" FROM "Building";
DROP TABLE "Building";
ALTER TABLE "new_Building" RENAME TO "Building";
CREATE TABLE "new_Room" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "floorId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "longitude" REAL NOT NULL,
    "latitude" REAL NOT NULL,
    CONSTRAINT "Room_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Room" ("floorId", "id", "latitude", "longitude", "name", "type") SELECT "floorId", "id", "latitude", "longitude", "name", "type" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BuildingSize_buildingId_key" ON "BuildingSize"("buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomSize_roomId_key" ON "RoomSize"("roomId");
