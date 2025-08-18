const express = require("express");
const {
  getFloors,
  updateFloors,
  createFloors,
  deleteFloor
} = require("../controllers/floorController");

const router = express.Router();

router.get("/floors", getFloors);
router.post("/updateFloors", updateFloors);
router.post("/createFloors", createFloors);
router.delete("/deleteFloor/:id", deleteFloor);

module.exports = router;
