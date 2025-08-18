const express = require("express");
const {
  getBuildings,
  updateBuildings,
  createBuildings,
  deleteBuilding
} = require("../controllers/buildingController");

const router = express.Router();

router.get("/buildings", getBuildings);
router.post("/updateBuildings", updateBuildings);
router.post("/createBuildings", createBuildings);
router.delete("/deleteBuilding/:id", deleteBuilding);

module.exports = router;