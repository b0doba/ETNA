import React from "react";
import { useNavigate } from "react-router-dom";
import "../InfoPage.css";

const InfoPage = () => {
  const navigate = useNavigate();

  return (
    <div className="info-page">
      <header className="info-header">
        <button className="back-button" onClick={() => navigate("/map")}>
          ← Vissza
        </button>
        <h1>Weboldal működése</h1>
      </header>

      <main className="info-content">
        <p>
          Ez az oldal segít megérteni, hogyan használd a térképes alkalmazást.
          A rendszer célja, hogy könnyedén eligazodj az egyetemi campus
          épületei, szintjei és termei között.
        </p>

        <p>
          A felső keresősávban megadhatod az épület vagy terem nevét, amelyet
          keresel. A találatot a rendszer pirossal kiemeli a térképen, így
          rögtön látni fogod, hol található. Ha útvonalat szeretnél tervezni,
          egyszerűen add meg a kiindulópontot és a célt, majd a program
          kiszámolja a legrövidebb vagy legkényelmesebb útvonalat a két pont
          között.
        </p>

        <p>
          A navigáció működése hasonló a klasszikus térképes alkalmazásokhoz:
          a rendszer a campus belső és külső útvonalait egyaránt ismeri, így
          képes figyelembe venni az emeletek közötti kapcsolatokat (pl. lépcső,
          lift), valamint az épületek közötti átjárókat. Kültéri nézetben az
          épületek alaprajzát látod, míg beltéri nézetben az adott szint
          alaprajza jelenik meg, ahol a termek és folyosók is követhetők.
        </p>

        <p>
          A kategóriák segítségével gyorsan szűrhetsz például kollégiumokra,
          tantermekre vagy egyéb fontos objektumokra. Az ikonok a
          térképen külön jelzik a szolgáltatásokat, mint például a mosdók,
          liftek vagy közösségi terek.
        </p>

        <p>
          A rendszer úgy lett kialakítva, hogy mobilról és számítógépről is
          könnyen használható legyen, így akár útközben is megtalálod a
          keresett termet vagy épületet. Az útvonaltervezés során a térkép
          lépésről lépésre mutatja az irányokat, így mindig tudni fogod, merre
          kell menned.
        </p>

        <p>
          Ha bármi hibát tapasztalsz vagy kérdésed van, fordulj hozzánk
          bizalommal – a rendszer folyamatos fejlesztés alatt áll, hogy még
          pontosabban és kényelmesebben segítse a tájékozódást.
        </p>
      </main>
    </div>
  );
};

export default InfoPage;
