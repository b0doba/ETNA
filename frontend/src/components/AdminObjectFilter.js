import React, { useState } from "react";
import "../AdminLook.css";

const AdminObjectFilter = ({ buildings, floors, applyFilter, resetFilter }) => {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  // Szűrés alkalmazása és a térkép frissítése
  const handleApplyFilter = () => {
    if (applyFilter) {
      applyFilter({
        category: selectedCategory,
        buildingId: selectedBuilding,
        floorId: selectedFloor,
      });
    } else {
      console.error("❌ applyFilter függvény nem elérhető!");
    }
  
    setIsOpen(false);
  };

  return (
    <div>
      <button className="filter-button" onClick={() => setIsOpen(!isOpen)}>
        Szűrő
      </button>
      {isOpen && (
        <div className="filter-container">
          <label className="filter-container-lowtitle">Kategória:</label>
          <select onChange={(e) => setSelectedCategory(e.target.value)}>
            <option value="">Válassz</option>
            <option value="building">Épület</option>
            <option value="floor">Emelet</option>
          </select>

          {selectedCategory === "building" && (
            <>
              <label className="filter-container-lowtitle">Épület:</label>
              <select onChange={(e) => setSelectedBuilding(e.target.value)}>
                <option value="">Válassz épületet</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </select>
            </>
          )}

          {selectedCategory === "floor" && (
            <>
              <label className="filter-container-lowtitle" >Épület:</label>
              <select onChange={(e) => setSelectedBuilding(Number(e.target.value))}>
                <option value="">Válassz épületet</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </select>

              <label className="filter-container-lowtitle" >Emelet:</label>
              <select onChange={(e) => setSelectedFloor(Number(e.target.value))} disabled={!selectedBuilding}>
                <option value="">Válassz emeletet</option>
                {floors
                  .filter((floor) => floor.buildingId === selectedBuilding)
                  .map((floor) => (
                    <option key={floor.id} value={floor.id}>
                      {floor.number}. emelet
                    </option>
                  ))}
              </select>
            </>
          )}

          <button className="filter-apply-btn" onClick={handleApplyFilter}>Alkalmazás</button>
          <button className="filter-close-btn" onClick={() => setIsOpen(false)}>Mégse</button>
          <button className="filter-reset-btn" onClick={resetFilter}>Szűrés visszaállítása</button>
        </div>
      )}
    </div>
  );
};

export default AdminObjectFilter;
