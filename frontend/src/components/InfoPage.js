import React from "react";
import { useNavigate } from "react-router-dom";
import "../InfoPage.css";

const InfoPage = () => {
  const navigate = useNavigate();

  return (
    <div className="info-page">
      <header className="info-header">
        <button className="back-button" onClick={() => navigate("/map")}>← Vissza</button>
        <h1>Weboldal működése</h1>
      </header>
      <main className="info-content">
        <p>Ez az oldal segít megérteni, hogyan használd a térképes alkalmazást.</p>
        <ul>
          <li><strong>Keresés:</strong> Írd be egy épület vagy terem nevét a keresőbe.</li>
          <li><strong>Útvonaltervezés:</strong> Add meg a kiindulópontot és az úti célt.</li>
          <li><strong>Kategóriák:</strong> Válassz kategóriát a felső gombokkal (pl. Kollégiumok).</li>
          <li><strong>Ikonok:</strong> A térképen ikonok mutatják a fontos pontokat (mosdó, lift stb.).</li>
        </ul>
        <p>Ha bármi hibát találsz vagy kérdésed van, fordulj hozzánk bizalommal.</p>
      </main>
    </div>
  );
};

export default InfoPage;
