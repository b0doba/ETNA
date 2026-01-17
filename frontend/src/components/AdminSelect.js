import React from "react";
import "../AdminLook.css";

const BUILDING_GROUPS = [
  "Kollégiumok",
  "Sportcsarnokok",
  "Parkolók",
  "Tanulmányi épületek",
  "Rendezvények",
];

const EDGE_TYPES = ["hallway", "stairs", "path", "outdoor"];
const NODE_TYPES = ["exit", "hallway", "stairs", "terem", "outdoor"];

const AdminSelect = ({ selectedData, setSelectedData, buildings, floors, handleSave, saveUpdatedFeature, showEdgeForm, nodes, onCancelCreation,
  onDeleteSelected, creationMode, onSyncFloorsToBuilding }) => {
  
  if (!selectedData) return null;

  return (
    <div className="info-box">
      <button className="info-box-close"
        onClick={() => { onCancelCreation && onCancelCreation(); }}
        title="Mégse / Bezárás"
      >
        ✕
      </button>
      {!selectedData.id && (
        <>
        {creationMode === "polygon" && (
        <div className="info-fields">
          <label>Kategória:</label>
          <select onChange={(e) => setSelectedData({ ...selectedData, category: e.target.value })}>
            <option value="">Válassz</option>
            <option value="building">Épület</option>
            <option value="floor">Emelet</option>
            <option value="room">Terem</option>
          </select>
        </div>
        )}
        </>
      )}

      {selectedData.category === "building" && (
        <div className="info-fields">
          <label>Név:</label>
          <input
            type="text"
            value={selectedData.name || ""}
            onChange={(e) => setSelectedData({ ...selectedData, name: e.target.value })}
          />
          <label>Rövid név:</label>
          <input
            type="text"
            value={selectedData.shortName || ""}
            onChange={(e) => setSelectedData({ ...selectedData, shortName: e.target.value })}
          />
          <label>Csoport:</label>
          <select
            value={selectedData.group || ""}
            onChange={(e) => setSelectedData({ ...selectedData, group: e.target.value })}
          >
            <option value="">Válassz csoportot</option>
            {BUILDING_GROUPS.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
            {/* Ha régebbi adatban egyedi csoportnév volt, jelenítsük meg, hogy ne vesszen el */}
            {selectedData.group && !BUILDING_GROUPS.includes(selectedData.group) && (
              <option value={selectedData.group}>{selectedData.group} (egyedi)</option>
            )}
          </select>
          <label>Kapcsolat:</label>
          <input
            type="text"
            value={selectedData.gather || ""}
            onChange={(e) => setSelectedData({ ...selectedData, gather: e.target.value })}
          />
          {!selectedData.id && (
            <>
              <label>Szintek száma:</label>
              <input
                type="number"
                value={selectedData.numberOfFloors || ""}
                onChange={(e) =>
                  setSelectedData({ ...selectedData, numberOfFloors: e.target.value !== "" ? parseInt(e.target.value, 10) : null })
                }
              />
            </>
          )}
          {selectedData.category === "building" && selectedData.id && (
            <button
              className="info-box-copy"
              style={{ marginTop: "8px" }}
              onClick={async () => {
                if (!window.confirm("Az épület alakját rá akarod húzni az ÖSSZES szintjére?")) return;
                await onSyncFloorsToBuilding(selectedData.id);
              }}
            >
              Szintek igazítása az épülethez
            </button>
          )}
        </div>        
      )}

      {selectedData.category === "floor" && (
        <div className="info-fields">
          {!selectedData.id && (
            <>
              <label>Épület:</label>
              <select
                onChange={(e) => setSelectedData({ ...selectedData, buildingId: parseInt(e.target.value, 10) })}>
                <option value="">Válassz épületet</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>{building.name}</option>
                ))}
              </select>
            </>
          )}
          <label>Emelet száma:</label>
          <input
            type="number"
            value={selectedData.number || ""}
            onChange={(e) => setSelectedData({ ...selectedData, number: e.target.value !== "" ? parseInt(e.target.value, 10) : null })}
          />
          <label>Magasság:</label>
          <input
            type="number"
            step="0.1"
            value={selectedData.height || ""}
            onChange={(e) => setSelectedData({ ...selectedData, height: e.target.value !== "" ? parseInt(e.target.value, 10) : null })}
          />
        </div>
      )}

      {selectedData.category === "room" && (
        <div className="info-fields">
          {!selectedData.id && (
            <>
              <label>Épület:</label>
              <select
                onChange={(e) => {
                  const selectedBuildingId = parseInt(e.target.value, 10);
                  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
                  setSelectedData({
                    ...selectedData,
                    buildingId: selectedBuildingId,
                    buildingName: selectedBuilding ? selectedBuilding.name : "",
                  });
                }}>
                <option value="">Válassz épületet</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>{building.name}</option>
                ))}
              </select>
              <label>Emelet:</label>
              <select
                onChange={(e) => setSelectedData({ ...selectedData, floorId: parseInt(e.target.value, 10) || null })}
                disabled={!selectedData.buildingId}>
                <option value="">Válassz emeletet</option>
                {floors.filter(f => f.buildingId === selectedData.buildingId).map(floor => (
                  <option key={floor.id} value={floor.id}>{floor.number}. emelet</option>
                ))}
              </select>
            </>
          )}
          <label>Név:</label>
          <input
            type="text"
            value={selectedData.name || ""}
            onChange={(e) => setSelectedData({ ...selectedData, name: e.target.value })}
          />
          <label>Kategória:</label>
          <select
            value={selectedData.roomCategory || "room"}
            onChange={(e) =>
              setSelectedData({
                ...selectedData,
                roomCategory: e.target.value,
              })
            }
          >
            <option value="room">Terem (járható)</option>
            <option value="void">Void (nem járható)</option>
            <option value="blocked">Blocked (lezárt)</option>
          </select>
        </div>
      )}
      {selectedData.category === "node" && (
        <div className="info-fields">
          <label>Név:</label>
          <input
            type="text"
            value={selectedData.name || ""}
            onChange={(e) => setSelectedData({ ...selectedData, name: e.target.value })}
          />
          <label>Típus:</label>
          <select
            value={selectedData.type || ""}
            onChange={(e) => {
              const t = e.target.value;
              const defaults = {
                stairs: "stairs-up.svg",
                exit: "entrance-alt1.svg",
              };
              setSelectedData(prev => ({
                ...prev,
                type: t,
                iconUrl: defaults[t] ?? prev.iconUrl ?? "",
              }));
            }}
          >
            <option value="">Válassz típust</option>
            {NODE_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <label>Ikon URL:</label>
          <input
            type="text"
            value={selectedData.iconUrl || ""}
            onChange={(e) => setSelectedData({ ...selectedData, iconUrl: e.target.value })}
          />
          {!selectedData.id && (
            <>
              <label>Épület:</label>
              <select
                onChange={(e) =>
                  setSelectedData({ ...selectedData, buildingId: parseInt(e.target.value, 10) || null })
                }>
                <option value="">Válassz épületet</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              <label>Emelet:</label>
              <select
                disabled={!selectedData.buildingId}
                onChange={(e) =>
                  setSelectedData({ ...selectedData, floorId: parseInt(e.target.value, 10) || null })
                }>
                <option value="">Válassz emeletet</option>
                {floors
                  .filter((f) => f.buildingId === selectedData.buildingId)
                  .map((floor) => (
                    <option key={floor.id} value={floor.id}>
                      {floor.number}. emelet
                    </option>
                  ))}
              </select>
            </>
          )}
        </div>
      )}
      {selectedData.category === "edge" && selectedData.id && (
        <div className="info-fields">
          <label>Típus:</label>
          <select
            value={selectedData.type || ""}
            onChange={(e) => setSelectedData({ ...selectedData, type: e.target.value })}
          >
            <option value="">Válassz típust</option>
            {EDGE_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <label>Ikon URL:</label>
          <input type="text" value={selectedData.iconUrl || ""} onChange={(e) => setSelectedData({ ...selectedData, iconUrl: e.target.value })} />
          <p><strong>From:</strong> {selectedData.fromNodeId}, <strong>To:</strong> {selectedData.toNodeId}</p>
        </div>
      )}
      {showEdgeForm && !selectedData.id && selectedData.category === "edge" && (
        <div className="info-fields">
          <label>From Node:</label>
          <select
            value={selectedData.fromNodeId || ""}
            onChange={(e) =>
              setSelectedData({ ...selectedData, fromNodeId: parseInt(e.target.value, 10) })
            }
          >
        <option value="">Válassz node-ot</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  #{node.id} - {node.name}
                </option>
              ))}
            </select>

            <label>To Node:</label>
            <select
              value={selectedData.toNodeId || ""}
              onChange={(e) =>
                setSelectedData({ ...selectedData, toNodeId: parseInt(e.target.value, 10) })
              }
            >
              <option value="">Válassz node-ot</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  #{node.id} - {node.name}
                </option>
              ))}
            </select>
          <label>Típus:</label>
          <select
            value={selectedData.type || ""}
            onChange={(e) => setSelectedData({ ...selectedData, type: e.target.value })}
          >
            <option value="">Válassz típust</option>
            {EDGE_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <label>Ikon URL:</label>
          <input
            type="text"
            value={selectedData.iconUrl || ""}
            onChange={(e) => setSelectedData({ ...selectedData, iconUrl: e.target.value })}
          />
        </div>
      )}
      <div className="info-box-buttons">
        <button
          className="info-box-save"
          onClick={selectedData.id ? saveUpdatedFeature : handleSave}
          disabled={!selectedData.category}
        >
          Mentés
        </button>
        <button
          className="info-box-delete"
          onClick={() => {
            if (selectedData?.id) {
              onDeleteSelected && onDeleteSelected();
            } else {
              if (window.confirm("Mégse? A nem mentett alakzat törlődik.")) {
                onCancelCreation && onCancelCreation();
              }
            }
          }}
        >
          Törlés
        </button>
        {selectedData.category === "room" && selectedData.id && (
          <button
            className="info-box-copy"
            title="Terem másolása"
            onClick={async () => {
              if (!window.confirm("Biztosan lemásolod ezt a termet?")) return;
              try {
                const res = await fetch(
                  `http://localhost:5000/api/rooms/${selectedData.id}/copy`,
                  { method: "POST" }
                );

                if (!res.ok) throw new Error("Másolás sikertelen");

                alert("✅ Terem lemásolva!");
              } catch (e) {
                console.error(e);
                alert("❌ Nem sikerült a terem másolása");
              }
            }}
          >
            Másolás
          </button>
        )}
      </div>
    </div>
  );
};

export default AdminSelect;