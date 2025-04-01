import React, { useState } from "react";
import "../AdminLook.css";

const AdminObjectFilter = ({ floors, applyFilter, resetFilter }) => {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedFloorNumber, setSelectedFloorNumber] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleApplyFilter = () => {
    const filterData = { category: selectedCategory };

    if (selectedCategory === "floor" && selectedFloorNumber !== null) {
      filterData.floorNumber = selectedFloorNumber;
    }

    applyFilter(filterData);
    setIsOpen(false);
  };

  const floorNumbers = [...new Set(floors.map(f => f.number))].sort((a, b) => a - b);

  return (
    <div>
      <button className="filter-button" onClick={() => setIsOpen(!isOpen)}>
        Szűrő
      </button>

      {isOpen && (
        <div className="filter-container">
          <label className="filter-container-lowtitle">Kategória:</label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSelectedFloorNumber(null);
            }}
          >
            <option value="">Válassz</option>
            <option value="building">Épületek és kültéri kapcsolatok</option>
            <option value="node_edge">Csak kültéri node-ok és edge-ek</option>
            <option value="floor">Emelet és szobák</option>
          </select>

          {selectedCategory === "floor" && (
            <>
              <label className="filter-container-lowtitle">Emelet szám:</label>
              <select
                onChange={(e) =>
                  setSelectedFloorNumber(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">Válassz emelet számot</option>
                {floorNumbers.map((number) => (
                  <option key={number} value={number}>
                    {number}. emelet
                  </option>
                ))}
              </select>
            </>
          )}

          <button className="filter-apply-btn" onClick={handleApplyFilter}>
            Alkalmazás
          </button>
          <button className="filter-close-btn" onClick={() => setIsOpen(false)}>
            Mégse
          </button>
          <button className="filter-reset-btn" onClick={resetFilter}>
            Szűrés visszaállítása
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminObjectFilter;
