/*
  Warnings:

  - You are about to drop the `BuildingConnection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BuildingPath` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Path` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "BuildingConnection";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "BuildingPath";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Path";
PRAGMA foreign_keys=on;
