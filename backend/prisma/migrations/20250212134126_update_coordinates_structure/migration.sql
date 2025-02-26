/*
  Warnings:

  - You are about to drop the column `latitude` on the `Building` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `Building` table. All the data in the column will be lost.
  - You are about to drop the column `length` on the `BuildingSize` table. All the data in the column will be lost.
  - You are about to drop the column `width` on the `BuildingSize` table. All the data in the column will be lost.
  - You are about to drop the column `latitude` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `length` on the `RoomSize` table. All the data in the column will be lost.
  - You are about to drop the column `width` on the `RoomSize` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Building" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "location" TEXT
);
INSERT INTO "new_Building" ("id", "location", "name") SELECT "id", "location", "name" FROM "Building";
DROP TABLE "Building";
ALTER TABLE "new_Building" RENAME TO "Building";
CREATE TABLE "new_BuildingSize" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "buildingId" INTEGER NOT NULL,
    "height" REAL NOT NULL,
    "coordinates" JSONB,
    CONSTRAINT "BuildingSize_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_BuildingSize" ("buildingId", "height", "id") SELECT "buildingId", "height", "id" FROM "BuildingSize";
DROP TABLE "BuildingSize";
ALTER TABLE "new_BuildingSize" RENAME TO "BuildingSize";
CREATE UNIQUE INDEX "BuildingSize_buildingId_key" ON "BuildingSize"("buildingId");
CREATE TABLE "new_Room" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "floorId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    CONSTRAINT "Room_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Room" ("floorId", "id", "name", "type") SELECT "floorId", "id", "name", "type" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
CREATE TABLE "new_RoomSize" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "height" REAL NOT NULL,
    "coordinates" JSONB,
    CONSTRAINT "RoomSize_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RoomSize" ("height", "id", "roomId") SELECT "height", "id", "roomId" FROM "RoomSize";
DROP TABLE "RoomSize";
ALTER TABLE "new_RoomSize" RENAME TO "RoomSize";
CREATE UNIQUE INDEX "RoomSize_roomId_key" ON "RoomSize"("roomId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
