const express = require("express");
const { getNodes, createNode, updateNode, deleteNode, getEdges, createEdge, updateEdge, splitEdgeAtNode, deleteEdge } = require("../controllers/graphController");

const router = express.Router();

router.get("/nodes", getNodes);
router.post("/nodes", createNode);
router.put("/nodes/:id", updateNode);
router.delete("/nodes/:id", deleteNode);

router.get("/edges", getEdges);
router.post("/edges", createEdge);
router.post("/edges/split-at-node", splitEdgeAtNode);
router.put("/edges/:id", updateEdge);
router.delete("/edges/:id", deleteEdge);

module.exports = router;
