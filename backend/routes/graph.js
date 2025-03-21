const express = require("express");
const { getNodes, createNode, deleteNode, getEdges, createEdge } = require("../controllers/graphController");

const router = express.Router();

router.get("/nodes", getNodes);
router.post("/nodes", createNode);
router.delete("/nodes/:id", deleteNode);

router.get("/edges", getEdges);
router.post("/edges", createEdge);

module.exports = router;
