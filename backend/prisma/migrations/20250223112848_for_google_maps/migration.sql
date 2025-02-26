/*
  Warnings:

  - You are about to drop the `BuildingSize` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RoomSize` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `location` on the `Building` table. All the data in the column will be lost.
  - Added the required column `coordinates` to the `Building` table without a default value. This is not possible if the table is not empty.
  - Added the required column `height` to the `Floor` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "BuildingSize_buildingId_key";

-- DropIndex
DROP INDEX "RoomSize_roomId_key";

-- AlterTable
ALTER TABLE "Room" ADD COLUMN "coordinates" JSONB;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "BuildingSize";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "RoomSize";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Building" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "coordinates" JSONB NOT NULL
);
INSERT INTO "new_Building" ("id", "name") SELECT "id", "name" FROM "Building";
DROP TABLE "Building";
ALTER TABLE "new_Building" RENAME TO "Building";
CREATE TABLE "new_Floor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "buildingId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "height" REAL NOT NULL,
    CONSTRAINT "Floor_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Floor" ("buildingId", "id", "number") SELECT "buildingId", "id", "number" FROM "Floor";
DROP TABLE "Floor";
ALTER TABLE "new_Floor" RENAME TO "Floor";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
