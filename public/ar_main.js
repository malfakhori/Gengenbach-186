import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import {
  recordXRFrame,
  reportDiagnosticError,
  reportGeolocationReady,
  reportCalibrationState,
  reportHitTestSourceCreated,
  reportReferenceSpaceCreated,
  reportXRSessionEnded,
  reportXRSessionStarted,
  XR_DIAGNOSTICS_ENABLED,
} from "./ar_diagnostics.js";
import {
  centerOnPlan,
  configureMap,
  init_map,
  leafletToThree,
  stopMapUpdates,
} from "./ar_overviewmap.js";
import { acquireStableLocation } from "./ar_geolocation.js";

/* ========================= */
/*    SHARED AR STATE        */
/* ========================= */

export let selectedPlacedModel = null;
export let currentSession = null;
export let reticle = null;
export let scene;
export let camera;
export let geoLocation;
let placedModelsRoot = null;
let localizationStatusElement = null;
let calibrationOffset = { x: 0, y: 0, z: 0, rotationY: 0 };
let calibrationStep = 0.25;
let calibrationConfirmed = false;
const CALIBRATION_ROTATION_STEP_DEGREES = 5;
const CALIBRATION_ROTATION_STEP_RADIANS = THREE.MathUtils.degToRad(
  CALIBRATION_ROTATION_STEP_DEGREES,
);

const modelCache = new Map();
const gltfLoader = new GLTFLoader();

const menus = [
    'menu-bar',
    'add-menu',
    'edit-menu',
    'options-menu',
    'map-window'
];

// PERFORMANCE: Cache menu DOM elements once instead of
// repeatedly calling document.getElementById() in showMenu().
const menuElements = {};

menus.forEach(id => {
    menuElements[id] = document.getElementById(id);
});


/* ========================= */
/*          MODELLE          */
/* ========================= */


export let models = {
  bench: {
    name: "Bench",
    image: "assets/previewImages/bench.PNG",
    file: "https://raw.githubusercontent.com/malfakhori/Gengenbach-186/master/public/assets/models/bench_model/scene.gltf",
    scale: { x: 0.1, y: 0.1, z: 0.1 },
    minScale: 0.05,
    maxScale: 0.5,
  },

  trashbin: {
    name: "Trash bin",
    image: "assets/previewImages/trash_can.PNG",
    file: "https://raw.githubusercontent.com/malfakhori/Gengenbach-186/master/public/assets/models/trash_model/scene.gltf",
    scale: { x: 0.03, y: 0.03, z: 0.03 },
    minScale: 0.01,
    maxScale: 0.1,
  },

  lantern: {
    name: "Lantern",
    image: "assets/previewImages/park_light.png",
    file: "https://raw.githubusercontent.com/malfakhori/Gengenbach-186/master/public/assets/models/park_light_model/scene.gltf",
    scale: { x: 0.5, y: 0.5, z: 0.5 },
    minScale: 0.2,
    maxScale: 5,
  },

  telephone_box: {
    name: "Telephone Box",
    image: "assets/previewImages/telephone_box.PNG",
    file: "https://raw.githubusercontent.com/malfakhori/Gengenbach-186/master/public/assets/models/telephone_box_model/scene.gltf",
    scale: { x: 0.5, y: 0.5, z: 0.5 },
    minScale: 0.05,
    maxScale: 1,
  },

  fire_hydrant_model: {
    name: "Fire Hydrant",
    image: "assets/previewImages/hydrant.PNG",
    file: "https://raw.githubusercontent.com/malfakhori/Gengenbach-186/master/public/assets/models/fire_hydrant_model/scene.gltf",
    scale: { x: 0.3, y: 0.3, z: 0.3 },
    minScale: 0.1,
    maxScale: 1,
  },

  statue: {
    name: "Statue",
    image: "assets/previewImages/statue.PNG",
    file: "https://raw.githubusercontent.com/malfakhori/Gengenbach-186/master/public/assets/models/statue_model/scene.gltf",
    scale: { x: 0.5, y: 0.5, z: 0.5 },
    minScale: 0.05,
    maxScale: 2,
  },

  fountain: {
    name: "Fountain",
    image: "assets/models/Ahorn/Ahorn.png",
    file: "https://raw.githubusercontent.com/malfakhori/Gengenbach-186/master/public/assets/models/Ahorn/Ahorn.glb",
    scale: { x: 0.1, y: 0.1, z: 0.1 },
    minScale: 0.01,
    maxScale: 0.5,
  },
};



/* ========================= */
/*     INITIALISIERUNG       */
/* ========================= */

export function initializeMainUI() {
    configureMap({
        getCamera: () => camera,
        getGeoLocation: () => geoLocation,
        getPlacedModels: getAllPlacedModels,
    });
    initializeAddMenu();

    // Allen Buttons den Sound hinzufügen
    const buttons = document.querySelectorAll(
        "button, .menu-item"
    );

    buttons.forEach(button => {
        button.addEventListener(
            "click",
            playButtonSound
        );
    });
}


function initializeAddMenu() {

    const addMenu =
        document.getElementById('add-menu');

    addMenu.innerHTML =
        Object.entries(models)
            .map(
                ([key, model]) => `
                <div
                    class="menu-item"
                    id="${key}-item"
                    onclick="selectModel('${key}')"
                >
                    <img
                        src="${model.image}"
                        alt="${model.name}"
                    />
                </div>
                `
            )
            .join('') +

        `
        <div
            class="menu-item"
            onclick="showMenu('menu-bar')"
        >
            <img
                src="assets/icons/back-icon.png"
                alt="Zurück"
            />
        </div>
        `;
}


/* ========================= */
/*     MENÜ-STEUERUNG        */
/* ========================= */

export function showMenu(menuId) {

    const isMapWindow =
        menuId === 'map-window';

    // Check location before opening map
    if (isMapWindow && !geoLocation) {

        console.log("Standort nicht geladen");

        showInfoDialog(
            "Ihr Standort wurde noch nicht geladen"
        );

        return;
    }


    // PERFORMANCE: Use cached menu elements instead of
    // repeatedly querying the DOM.
    menus.forEach(id => {

        const element =
            menuElements[id];

        if (element) {

            element.style.display =
                id === menuId
                    ? 'flex'
                    : 'none';
        }
    });


    closeDynamicMenu();


    // Menu-specific actions
    if (menuId === 'menu-bar') {

        clearSelectedModel();

    } else if (isMapWindow) {

        // Initialize map
        init_map();

        // Leaflet needs to know the actual size of the
        // visible map container.
        setTimeout(() => {

            if (
                typeof centerOnPlan === 'function'
            ) {

                centerOnPlan();
            }

        }, 100);
    }
}


/* ============================================================ */
/* Close map and return to AR scene */
/* ============================================================ */

function closeMap() {

    const mapWindow =
        menuElements['map-window'];

    if (mapWindow) {

        mapWindow.style.display =
            "none";
    }


    // Show the main AR menu again
    const menuBar =
        menuElements['menu-bar'];

    if (menuBar) {

        menuBar.style.display =
            "flex";
    }


    stopMapUpdates();


    // Clear selected model
    clearSelectedModel();
}


export function closeDynamicMenu() {

    const dynamicMenu =
        document.getElementById(
            "dynamic-menu"
        );

    if (dynamicMenu) {

        dynamicMenu.style.display =
            "none";
    }
}


export function showInfoDialog(message) {

    const infoDialog =
        document.getElementById(
            "info-dialog"
        );

    const infoText =
        document.getElementById(
            "info-text"
        );

    infoText.textContent =
        message;

    infoDialog.style.display =
        "flex";
}


export function closeInfoDialog() {

    const infoDialog =
        document.getElementById(
            "info-dialog"
        );

    infoDialog.style.display =
        "none";
}


/* ========================= */
/*     MODELL-HANDLING       */
/* ========================= */

export function getAllPlacedModels() {
    return placedModelsRoot ? placedModelsRoot.children.filter(
        child =>
            child.isPlacedModel === true
    ) : [];
}


function loadModel(filePath) {
    const placementPosition = reticle.position.clone();
    placedModelsRoot.updateMatrixWorld(true);
    placedModelsRoot.worldToLocal(placementPosition);

    placeModel(
        filePath,
        placementPosition,
        (model) => {

            selectedPlacedModel =
                model;

            highlightSelectedModel();

            showMenu('edit-menu');
        }
    );
}


function placeModel(
    filePath,
    position,
    onPlace = null
) {

    const modelConfig =
        Object.values(models)
            .find(
                model =>
                    model.file === filePath
            );


    // PERFORMANCE: Reuse the global GLTFLoader.
    // Do not create a new loader for every model.
    if (modelCache.has(filePath)) {

        // Use the already loaded model
        const cachedModel =
            modelCache.get(filePath);

        const model =
            cloneSkinned(cachedModel);


        if (
            modelConfig &&
            modelConfig.scale
        ) {

            model.scale.set(
                modelConfig.scale.x,
                modelConfig.scale.y,
                modelConfig.scale.z
            );
        }


        model.position.copy(
            position
        );

        model.isPlacedModel =
            true;

        model.modelConfig =
            modelConfig;

        placedModelsRoot.add(model);


        if (onPlace) {
            onPlace(model);
        }

    } else {

        // Model has not been loaded yet
        gltfLoader.load(

            filePath,

            (gltf) => {

                // Store the original model in the cache
                modelCache.set(
                    filePath,
                    gltf.scene
                );

                const model =
                    cloneSkinned(gltf.scene);


                if (
                    modelConfig &&
                    modelConfig.scale
                ) {

                    model.scale.set(
                        modelConfig.scale.x,
                        modelConfig.scale.y,
                        modelConfig.scale.z
                    );
                }


                model.position.copy(
                    position
                );

                model.isPlacedModel =
                    true;

                model.modelConfig =
                    modelConfig;

                placedModelsRoot.add(model);


                if (onPlace) {
                    onPlace(model);
                }
            },

            undefined,

            (error) => {

                reportDiagnosticError("MODEL LOAD", error);
                console.error(
                    "Fehler beim Laden des Modells:",
                    error
                );
            }
        );
    }
}


export function selectModel(modelId) {

    const model =
        models[modelId];


    if (
        model &&
        model.file
    ) {

        loadModel(
            model.file
        );

        showMenu(
            'menu-bar'
        );
    }
}


function selectModelFromScene(event) {

    const mouse =
        new THREE.Vector2(

            (event.clientX /
                window.innerWidth) *
                2 - 1,

            -(event.clientY /
                window.innerHeight) *
                2 + 1
        );


    const raycaster =
        new THREE.Raycaster();


    raycaster.setFromCamera(
        mouse,
        camera
    );


    const intersects =
        raycaster.intersectObjects(
            getAllPlacedModels(),
            true
        );


    if (
        intersects.length > 0
    ) {

        let selectedObject =
            intersects[0].object;


        while (
            selectedObject.parent &&
            selectedObject.parent !== placedModelsRoot
        ) {

            selectedObject =
                selectedObject.parent;
        }


        // Reticle cannot be selected
        if (
            selectedObject === reticle
        ) {

            console.log(
                "Reticle kann nicht ausgewählt werden."
            );

            return;
        }


        selectedPlacedModel =
            selectedObject;


        highlightSelectedModel();

        showMenu(
            "edit-menu"
        );
    }
}


function clearSelectedModel() {

    if (selectedPlacedModel) {

        selectedPlacedModel.traverse(
            (child) => {

                if (child.isMesh) {

                    child.material.emissive
                        .setHex(
                            0x000000
                        );
                }
            }
        );


        selectedPlacedModel =
            null;
    }
}


function highlightSelectedModel() {

    if (selectedPlacedModel) {

        removeHighlightFromAllModels();


        selectedPlacedModel.traverse(
            (child) => {

                if (child.isMesh) {

                    child.material.emissive
                        .setHex(
                            0xff0000
                        );
                }
            }
        );
    }
}


function removeHighlightFromSelectedModel() {

    if (selectedPlacedModel) {

        selectedPlacedModel.traverse(
            (child) => {

                if (child.isMesh) {

                    child.material.emissive
                        .setHex(
                            0x000000
                        );
                }
            }
        );
    }
}


function removeHighlightFromAllModels() {

    scene.traverse(
        (child) => {

            if (
                child.isMesh &&
                child.material &&
                child.material.emissive
            ) {

                child.material.emissive
                    .setHex(
                        0x000000
                    );
            }
        }
    );
}


export function deleteModel() {

    if (!selectedPlacedModel) {

        console.log(
            "Kein Modell ausgewählt. Bitte wählen Sie ein Modell aus, bevor Sie es löschen."
        );

        return;
    }


    const deleteDialog =
        document.getElementById(
            'delete-confirmation-dialog'
        );


    deleteDialog.style.display =
        'flex';
}


export function confirmDelete(
    shouldDelete
) {

    const deleteDialog =
        document.getElementById(
            'delete-confirmation-dialog'
        );


    deleteDialog.style.display =
        'none';


    if (
        shouldDelete &&
        selectedPlacedModel
    ) {

        placedModelsRoot.remove(
            selectedPlacedModel
        );

        selectedPlacedModel =
            null;

        showMenu(
            'menu-bar'
        );
    }
}


export function completeEditing() {

    removeHighlightFromSelectedModel();

    closeDynamicMenu();

    selectedPlacedModel =
        null;

    document.getElementById(
        'edit-menu'
    ).style.display =
        'none';

    document.getElementById(
        'menu-bar'
    ).style.display =
        'flex';
}


/* ========================= */
/*    BEARBEITUNGS-MENÜS     */
/* ========================= */

export function openRotationMenu() {

    if (!selectedPlacedModel) {

        console.log(
            "Kein Modell ausgewählt. Bitte wählen Sie ein Modell aus, bevor Sie es bearbeiten."
        );

        return;
    }


    const currentRotation =
        Math.round(
            THREE.MathUtils.radToDeg(
                selectedPlacedModel.rotation.y
            )
        );


    const dynamicMenu =
        document.getElementById(
            "dynamic-menu"
        );


    dynamicMenu.style.display =
        "flex";


    dynamicMenu.innerHTML = `

        <h3>Rotation anpassen</h3>

        <label>
            Y-Achse:
            <span id="current-rotation">
                ${currentRotation}
            </span>°

            <input
                type="range"
                min="0"
                max="360"
                step="10"
                onchange="updateRotation('y', this.value)"
            >
        </label>

        <button onclick="closeDynamicMenu()">
            Zurück
        </button>
    `;
}


export function updateRotation(
    axis,
    value
) {

    if (selectedPlacedModel) {

        const radians =
            (value / 180) *
            Math.PI;


        selectedPlacedModel.rotation[axis] =
            radians;


        const currentRotationDisplay =
            document.getElementById(
                "current-rotation"
            );


        if (currentRotationDisplay) {

            currentRotationDisplay.textContent =
                value;
        }
    }
}


export function openScaleMenu() {

    if (!selectedPlacedModel) {

        console.log(
            "Kein Modell ausgewählt. Bitte wählen Sie ein Modell aus, bevor Sie es bearbeiten."
        );

        return;
    }


    const currentScale =
        selectedPlacedModel.scale.x;


    const minScale =
        selectedPlacedModel.modelConfig.minScale;


    const maxScale =
        selectedPlacedModel.modelConfig.maxScale;


    const step =
        (maxScale - minScale) /
        100;


    const currentScalePercent =
        (
            (currentScale - minScale) /
            (maxScale - minScale)
        ) * 100;


    const dynamicMenu =
        document.getElementById(
            "dynamic-menu"
        );


    dynamicMenu.style.display =
        "flex";


    dynamicMenu.innerHTML = `

        <h3>Skalierung anpassen</h3>

        <label>
            Größe:
            <span id="scale-value">
                ${currentScalePercent.toFixed(0)}%
            </span>

            <input
                type="range"
                min="0"
                max="100"
                step="${step}"
                value="${currentScalePercent}"
                onchange="updateScale(
                    this.value,
                    ${minScale},
                    ${maxScale}
                )"
            >
        </label>

        <button onclick="closeDynamicMenu()">
            Zurück
        </button>
    `;
}


export function updateScale(
    percentValue,
    minScale,
    maxScale
) {

    if (selectedPlacedModel) {

        const scale =
            minScale +
            (percentValue / 100) *
            (maxScale - minScale);


        selectedPlacedModel.scale.set(
            scale,
            scale,
            scale
        );


        const scaleValueDisplay =
            document.getElementById(
                "scale-value"
            );


        if (scaleValueDisplay) {

            scaleValueDisplay.textContent =
                `${parseInt(percentValue, 10)}%`;
        }
    }
}


let moveDelta = 0.1;


export function openMoveMenu() {

    if (!selectedPlacedModel) {

        console.log(
            "Kein Modell ausgewählt. Bitte wählen Sie ein Modell aus, bevor Sie es bearbeiten."
        );

        return;
    }


    const dynamicMenu =
        document.getElementById(
            "dynamic-menu"
        );


    dynamicMenu.style.display =
        "flex";


    dynamicMenu.innerHTML = `

        <h3>Position anpassen</h3>

        <label>

            Verschiebungsgröße:
            <span id="move-delta-display">
                ${moveDelta.toFixed(2)}
            </span>

            <input
                type="range"
                min="0.01"
                max="1.0"
                step="0.01"
                value="${moveDelta}"
                onchange="updateMoveDelta(this.value)"
            >

        </label>

        <div class="button-row">

            <div
                class="control-button"
                id="left"
                onclick="moveModelDynamic('x', -moveDelta)"
            >
                <img
                    src="assets/icons/left-arrow.png"
                    alt="Left"
                />
            </div>


            <div
                class="control-button"
                id="right"
                onclick="moveModelDynamic('x', moveDelta)"
            >
                <img
                    src="assets/icons/right-arrow.png"
                    alt="Right"
                />
            </div>


            <div
                class="control-button"
                id="up"
                onclick="moveModelDynamic('z', -moveDelta)"
            >
                <img
                    src="assets/icons/up-arrow.png"
                    alt="Up"
                />
            </div>


            <div
                class="control-button"
                id="down"
                onclick="moveModelDynamic('z', moveDelta)"
            >
                <img
                    src="assets/icons/down-arrow.png"
                    alt="Down"
                />
            </div>

        </div>

        <button onclick="closeDynamicMenu()">
            Zurück
        </button>
    `;
}


export function updateMoveDelta(
    value
) {

    moveDelta =
        parseFloat(value);


    const moveDeltaDisplay =
        document.getElementById(
            "move-delta-display"
        );


    if (moveDeltaDisplay) {

        moveDeltaDisplay.textContent =
            moveDelta.toFixed(2);
    }
}


export function moveModelDynamic(
    axis,
    value
) {

    if (selectedPlacedModel) {
        const worldDelta = new THREE.Vector3();
        worldDelta[axis] = value;
        worldDelta.applyQuaternion(
            placedModelsRoot.quaternion.clone().invert(),
        );
        selectedPlacedModel.position.add(worldDelta);
    }
}


/* ========================= */
/*      KARTENSTEUERUNG      */
/* ========================= */

function refreshMapDialog() {

    const mapDialog =
        document.getElementById(
            'map-dialog'
        );

    mapDialog.style.display =
        'flex';
}


function closeMapDialog() {

    const mapDialog =
        document.getElementById(
            'map-dialog'
        );

    mapDialog.style.display =
        'none';
}

function updateLocalizationStatus(message, retry = false) {
  if (!localizationStatusElement) {
    localizationStatusElement = document.createElement("div");
    localizationStatusElement.id = "gps-localization-status";
    localizationStatusElement.style.cssText = [
      "position:fixed",
      "top:42px",
      "left:50%",
      "transform:translateX(-50%)",
      "z-index:10000",
      "max-width:calc(100vw - 24px)",
      "padding:10px 14px",
      "border-radius:8px",
      "background:rgba(0,0,0,.8)",
      "color:#fff",
      "font:14px/1.4 sans-serif",
      "text-align:center",
      "pointer-events:auto",
    ].join(";");
    document.body.appendChild(localizationStatusElement);
  }

  window.clearTimeout(localizationStatusElement.hideTimer);
  localizationStatusElement.replaceChildren(document.createTextNode(message));

  if (retry) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Erneut versuchen";
    button.style.cssText =
      "display:block;margin:8px auto 0;padding:8px 12px;border:0;border-radius:5px";
    button.addEventListener("click", () => startLocationLocalization());
    localizationStatusElement.appendChild(button);
  } else if (message.startsWith("Standort stabil") || message.startsWith("Standort angenähert")) {
    localizationStatusElement.hideTimer = window.setTimeout(() => {
      localizationStatusElement?.remove();
      localizationStatusElement = null;
    }, 5000);
  }
}

let pendingSceneData = null;
let sceneModelsLoaded = false;

async function startLocationLocalization() {
  updateLocalizationStatus("Standort wird stabilisiert …");

  let location;
  try {
    location = await acquireStableLocation((progress) => {
      if (progress.status !== "ACQUIRING") return;
      const count = progress.goodSampleCount || 0;
      const accuracy = Number.isFinite(progress.accuracy)
        ? ` · letzte Genauigkeit ${progress.accuracy.toFixed(0)} m`
        : "";
      updateLocalizationStatus(
        `Standort wird stabilisiert · ${count}/4 konsistente Messungen${accuracy}`,
      );
    });
  } catch (error) {
    console.error("[Geo] Failed to stabilize location:", error);
    updateLocalizationStatus(
      "Standort konnte nicht abgerufen werden. Bitte Standortzugriff prüfen und erneut versuchen.",
      true,
    );
    return;
  }

  geoLocation = location;
  reportGeolocationReady(geoLocation);
  const message = geoLocation.status === "STABLE"
    ? `Standort stabil · Genauigkeit ca. ${geoLocation.accuracy.toFixed(1)} m`
    : `Standort angenähert · Genauigkeit ca. ${geoLocation.accuracy.toFixed(1)} m`;
  updateLocalizationStatus(message);

  if (!sceneModelsLoaded && pendingSceneData && Array.isArray(pendingSceneData.models)) {
    sceneModelsLoaded = true;
    pendingSceneData.models.forEach((model) => {
      if (!model.name) return;

      const modelDefinition = Object.values(models).find(
        (candidate) => model.name === candidate.name,
      );
      if (!modelDefinition) {
        console.error("[Scene] Model not found:", model.name);
        return;
      }

      const { x, z } = leafletToThree(model.lat, model.lng);
      const positionVector = new THREE.Vector3(x, model.position.y, z);
      placeModel(modelDefinition.file, positionVector, (placed) => {
        if (model.rotation) {
          placed.rotation._x = model.rotation._x;
          placed.rotation._y = model.rotation._y;
          placed.rotation._z = model.rotation._z;
        }
        if (model.scale) {
          placed.scale.x = model.scale.x;
          placed.scale.y = model.scale.y;
          placed.scale.z = model.scale.z;
        }
      });
    });
  }
}

function renderCalibrationMenu() {
  const dynamicMenu = document.getElementById("dynamic-menu");
  dynamicMenu.style.display = "flex";
  dynamicMenu.innerHTML = `
    <h3>Szene kalibrieren</h3>
    <p>X = seitlich · Z = vor/zurück</p>
    <p>Schrittweite: ${calibrationStep.toFixed(2)} m · X ${calibrationOffset.x.toFixed(2)} m · Y ${calibrationOffset.y.toFixed(2)} m · Z ${calibrationOffset.z.toFixed(2)} m</p>
    <div class="button-row calibration-rotation-controls">
      <span>Drehung Y · ${CALIBRATION_ROTATION_STEP_DEGREES}°</span>
      <button class="calibration-rotation-button" type="button" aria-label="Rotate scene left" title="Rotate scene left" onclick="adjustCalibrationRotation(-1)">↺</button>
      <button class="calibration-rotation-button" type="button" aria-label="Rotate scene right" title="Rotate scene right" onclick="adjustCalibrationRotation(1)">↻</button>
    </div>
    <label>Schrittweite
      <select onchange="setCalibrationStep(this.value)">
        <option value="0.1" ${calibrationStep === 0.1 ? "selected" : ""}>0,10 m</option>
        <option value="0.25" ${calibrationStep === 0.25 ? "selected" : ""}>0,25 m</option>
        <option value="0.5" ${calibrationStep === 0.5 ? "selected" : ""}>0,50 m</option>
        <option value="1" ${calibrationStep === 1 ? "selected" : ""}>1,00 m</option>
      </select>
    </label>
    <div class="button-row">
      <button onclick="adjustCalibrationOffset('x', -1)">X −</button>
      <button onclick="adjustCalibrationOffset('x', 1)">X +</button>
      <button onclick="adjustCalibrationOffset('z', -1)">Z −</button>
      <button onclick="adjustCalibrationOffset('z', 1)">Z +</button>
    </div>
    <div class="button-row">
      <button onclick="resetCalibration()">Kalibrierung zurücksetzen</button>
      <button onclick="confirmCalibration()">${calibrationConfirmed ? "Übernommen ✓" : "Kalibrierung übernehmen"}</button>
    </div>
    <button onclick="closeDynamicMenu()">Zurück</button>
  `;
}

export function openCalibrationMenu() {
  renderCalibrationMenu();
}

export function setCalibrationStep(value) {
  calibrationStep = Number(value);
  renderCalibrationMenu();
}

export function adjustCalibrationOffset(axis, direction) {
  calibrationOffset[axis] = Number(
    (calibrationOffset[axis] + direction * calibrationStep).toFixed(2),
  );
  applyCalibrationTransform();
  calibrationConfirmed = false;
  reportCalibrationState({ ...calibrationOffset, confirmed: calibrationConfirmed });
  renderCalibrationMenu();
}

export function adjustCalibrationRotation(direction) {
  const fullTurn = 2 * Math.PI;
  const nextRotation =
    calibrationOffset.rotationY +
    direction * CALIBRATION_ROTATION_STEP_RADIANS;
  const normalizedRotation =
    ((nextRotation + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
  calibrationOffset.rotationY =
    Math.abs(normalizedRotation) < 1e-12 ? 0 : normalizedRotation;
  applyCalibrationTransform();
  calibrationConfirmed = false;
  reportCalibrationState({ ...calibrationOffset, confirmed: calibrationConfirmed });
  renderCalibrationMenu();
}

function applyCalibrationTransform() {
  placedModelsRoot.position.set(
    calibrationOffset.x,
    calibrationOffset.y,
    calibrationOffset.z,
  );
  placedModelsRoot.rotation.set(0, calibrationOffset.rotationY, 0);
}

export function resetCalibration() {
  calibrationOffset = { x: 0, y: 0, z: 0, rotationY: 0 };
  calibrationConfirmed = false;
  applyCalibrationTransform();
  reportCalibrationState({ ...calibrationOffset, confirmed: calibrationConfirmed });
  renderCalibrationMenu();
}

export function confirmCalibration() {
  calibrationConfirmed = true;
  reportCalibrationState({ ...calibrationOffset, confirmed: calibrationConfirmed });
  renderCalibrationMenu();
}


/* ========================= */
/*        AR-HANDLING        */
/* ========================= */

export async function activateXR(sceneData = null) {
  pendingSceneData = sceneData;
  sceneModelsLoaded = false;
  calibrationOffset = { x: 0, y: 0, z: 0, rotationY: 0 };
  calibrationConfirmed = false;

  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    canvas,
  });

  document.body.appendChild(canvas);

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local");

  scene = new THREE.Scene();
  placedModelsRoot = new THREE.Group();
  placedModelsRoot.name = "placed-models-root";
  scene.add(placedModelsRoot);
  reportCalibrationState({ ...calibrationOffset, confirmed: false });
  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    20,
  );

  // AR lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
  scene.add(ambientLight);

  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x888888, 1.5);
  scene.add(hemisphereLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
  directionalLight.position.set(10, 20, 10);
  scene.add(directionalLight);

  // Reticle
  gltfLoader.load(
    "https://immersive-web.github.io/webxr-samples/media/gltf/reticle/reticle.gltf",
    (gltf) => {
      reticle = gltf.scene;
      reticle.visible = false;
      scene.add(reticle);
    },
    undefined,
    (error) => {
      reportDiagnosticError("RETICLE LOAD", error);
      console.error("[GLTF] Failed to load reticle:", error);
    },
  );

  try {
    currentSession = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["dom-overlay"],
      domOverlay: {
        root: document.body,
      },
    });

    await renderer.xr.setSession(currentSession);
    reportXRSessionStarted();
  } catch (error) {
    reportDiagnosticError("XR START", error);
    console.error("[XR] Failed to start session:", error);
    renderer.dispose();
    canvas.remove();
    currentSession = null;
    showInfoDialog("Die AR-Session konnte nicht gestartet werden.");
    return;
  }

  const referenceSpace = await currentSession.requestReferenceSpace("local");
  reportReferenceSpaceCreated("local");
  const viewerSpace = await currentSession.requestReferenceSpace("viewer");
  reportReferenceSpaceCreated("viewer");
  const hitTestSource = await currentSession.requestHitTestSource({
    space: viewerSpace,
  });
  reportHitTestSourceCreated();

  document.getElementById("menu-bar").style.display = "flex";

  currentSession.addEventListener("end", () => {
    reportXRSessionEnded();
    console.log("AR session ended");
    window.location.reload();
  });

  canvas.addEventListener("pointerdown", selectModelFromScene);

  renderer.setAnimationLoop((time, frame) => {
    let hitResultCount = null;

    if (frame) {
      const pose = frame.getViewerPose(referenceSpace);

      if (pose) {
        const hitTestResults = frame.getHitTestResults(hitTestSource);
        hitResultCount = hitTestResults.length;

        if (hitTestResults.length > 0) {
          const hitPose = hitTestResults[0].getPose(referenceSpace);

          if (reticle && hitPose) {
            reticle.visible = true;
            reticle.position.set(
              hitPose.transform.position.x,
              hitPose.transform.position.y,
              hitPose.transform.position.z,
            );
            reticle.updateMatrixWorld(true);
          }
        } else if (reticle) {
          reticle.visible = false;
        }
      } else if (reticle) {
        reticle.visible = false;
      }
    }

    renderer.render(scene, camera);

    if (XR_DIAGNOSTICS_ENABLED) {
      recordXRFrame({
        hitResultCount,
        reticleVisible: Boolean(reticle && reticle.visible),
        modelCount: getAllPlacedModels().length,
        camera,
      });
    }
  });

  void startLocationLocalization();
}
/* ========================= */
/*       AR EXIT             */
/* ========================= */

export function exitAR() {
  document.getElementById("confirmation-dialog").style.display = "flex";
}

export function confirmExit(shouldExit) {
  if (shouldExit && currentSession) {
    currentSession.end();
  }

  document.getElementById("confirmation-dialog").style.display = "none";
}


export function installLegacyUI(downloadScene) {
  Object.assign(window, {
    showMenu,
    selectModel,
    showInfoDialog,
    openRotationMenu,
    openScaleMenu,
    openMoveMenu,
    deleteModel,
    completeEditing,
    exitAR,
    downloadScene,
    confirmDelete,
    confirmExit,
    closeInfoDialog,
    closeDynamicMenu,
    updateRotation,
    updateScale,
    updateMoveDelta,
    moveModelDynamic,
    openCalibrationMenu,
    setCalibrationStep,
    adjustCalibrationOffset,
    adjustCalibrationRotation,
    resetCalibration,
    confirmCalibration,
  });

  Object.defineProperty(window, "moveDelta", {
    configurable: true,
    get: () => moveDelta,
  });
}

/* ========================= */
/*   BENUTZERINTERAKTIONEN   */
/* ========================= */

let soundTimeout = false;

function playButtonSound() {
  if (!soundTimeout) {
    const sound = document.getElementById("button-sound");

    sound.currentTime = 0;

    sound.play();

    soundTimeout = true;

    setTimeout(() => {
      soundTimeout = false;
    }, 200);
  }
}

