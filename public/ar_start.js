import { activateXR } from "./ar_main.js";
import { loadSceneFromFile } from "./ar_download.js";

/* ========================= */
/*   DEBUGGING UND START     */
/* ========================= */

let sceneData = null;
let sceneFileName = null;

let startScreen = null;

let startButton = null;
let loadButton = null;

let predefinedButton1 = null;
let predefinedButton2 = null;

/* ========================= */
/*   PREDEFINED SCENE        */
/* ========================= */

export async function loadPredefinedScene(filePath, fileName) {
  try {
    const response = await fetch(filePath);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    sceneData = data;
    sceneFileName = fileName;

    console.log("Vordefinierte Szene geladen:", fileName);

    return true;
  } catch (error) {
    console.error("Fehler beim Laden der vordefinierten Szene:", error);

    return false;
  }
}

/* ============================================================ */
/* Create the Start Screen                                     */
/* ============================================================ */

export function showStartScreen() {
  // Prevent duplicate start screens
  if (
    startScreen ||
    startButton ||
    loadButton ||
    predefinedButton1 ||
    predefinedButton2
  ) {
    return;
  }

  /* ==========================================================
     START SCREEN CONTAINER
     ========================================================== */

  startScreen = document.createElement("div");

  startScreen.classList.add("start-screen");

  document.body.appendChild(startScreen);

  /* ==========================================================
   HFT LOGO
   ========================================================== */

  const hftLogo = document.createElement("img");

  hftLogo.src = "assets/images/logo-HFT.svg";
  hftLogo.alt = "HFT Stuttgart";

  hftLogo.classList.add("start-screen-logo");

  startScreen.appendChild(hftLogo);


  /* ==========================================================
     TITLE
     ========================================================== */

  const title = document.createElement("h1");

  title.textContent = "GENGENBACH";

  title.classList.add("start-screen-title");

  startScreen.appendChild(title);

  /* ==========================================================
     SUBTITLE
     ========================================================== */

  const subtitle = document.createElement("div");

  subtitle.textContent = "AR Urban Planning";

  subtitle.classList.add("start-screen-subtitle");

  startScreen.appendChild(subtitle);

  /* ==========================================================
     DIVIDER
     ========================================================== */

  const divider = document.createElement("div");

  divider.classList.add("start-screen-divider");

  startScreen.appendChild(divider);

  /* ==========================================================
     START AR
     ========================================================== */

  startButton = document.createElement("button");

  startButton.textContent = "Start AR";

  startButton.classList.add("start-screen-button", "start-ar-button");

  startScreen.appendChild(startButton);

  /* ==========================================================
     LOAD SCENE
     ========================================================== */

  loadButton = document.createElement("button");

  loadButton.textContent = sceneFileName || "Umgebung Laden";

  loadButton.classList.add(
    "start-screen-button",
    "load-scene-button",
    "scene-button",
  );

  startScreen.appendChild(loadButton);

  /* ==========================================================
     PREDEFINED SCENE 1
     ========================================================== */

  predefinedButton1 = document.createElement("button");

  predefinedButton1.textContent = "Quartiersplatz";

  predefinedButton1.classList.add(
    "start-screen-button",
    "predefined-scene-button-1",
    "scene-button",
  );

  startScreen.appendChild(predefinedButton1);

  /* ==========================================================
     PREDEFINED SCENE 2
     ========================================================== */

  predefinedButton2 = document.createElement("button");

  predefinedButton2.textContent = "Quartiersplatz 2";

  predefinedButton2.classList.add(
    "start-screen-button",
    "predefined-scene-button-2",
    "scene-button",
  );
  predefinedButton2.style.display = "none";
  startScreen.appendChild(predefinedButton2);

  /* ==========================================================
     START AR CLICK
     ========================================================== */

  startButton.onclick = () => {
    // Remove complete start screen
    startScreen.remove();

    // Reset references
    startScreen = null;
    startButton = null;
    loadButton = null;
    predefinedButton1 = null;
    predefinedButton2 = null;

    // Start AR
    activateXR(sceneData);
  };

  /* ==========================================================
     LOAD SCENE CLICK
     ========================================================== */

  loadButton.onclick = () => {
    loadSceneFromFile((data, fileName) => {
      if (data && fileName) {
        sceneData = data;
        sceneFileName = fileName;

        loadButton.textContent = fileName;

        // Select uploaded scene
        loadButton.classList.add("selected");

        // Deselect predefined scenes
        predefinedButton1.classList.remove("selected");
        predefinedButton2.classList.remove("selected");
      } else {
        loadButton.textContent = sceneFileName || "Umgebung Laden";
      }
    });
  };

  /* ==========================================================
     PREDEFINED SCENE 1
     ========================================================== */

  predefinedButton1.onclick = async () => {
    const success = await loadPredefinedScene(
      "scenes/gengenbach-plaza.json",
      "Quartiersplatz 1",
    );

    if (success) {
      // Select Plaza
      predefinedButton1.classList.add("selected");

      // Deselect Street
      predefinedButton2.classList.remove("selected");

      // Deselect uploaded scene
      loadButton.classList.remove("selected");
    }
  };

  /* ==========================================================
     PREDEFINED SCENE 2
     ========================================================== */

  predefinedButton2.onclick = async () => {
    const success = await loadPredefinedScene(
      "scenes/gengenbach-street.json",
      "Quartiersplatz 2",
    );

    if (success) {
      // Select Street
      predefinedButton2.classList.add("selected");

      // Deselect Plaza
      predefinedButton1.classList.remove("selected");

      // Deselect uploaded scene
      loadButton.classList.remove("selected");
    }
  };
}

