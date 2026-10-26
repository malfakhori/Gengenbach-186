import * as THREE from "three";

export const XR_DIAGNOSTICS_ENABLED = true; // Set to true temporarily for device validation

const SESSION_END_KEY = "gengenbach.xrDiagnostics.sessionEnded";
const REFRESH_INTERVAL_MS = 1000;
const MAX_EVENTS = 5;

const state = {
  webxr: "CHECKING",
  immersiveAr: "CHECKING",
  xr: "CHECKING",
  session: "IDLE",
  localSpace: "WAITING",
  viewerSpace: "WAITING",
  hitSource: "WAITING",
  hitTest: "WAITING",
  hitResultCount: null,
  reticle: "HIDDEN",
  animation: "IDLE",
  fps: null,
  modelCount: 0,
  camera: "NOT INITIALIZED",
  geolocation: "WAITING",
  gpsStatus: "WAITING",
  gpsBase: "--",
  gpsAccuracy: null,
  gpsSampleCount: 0,
  gpsSpread: null,
  gpsSource: "--",
  gpsTimestamp: null,
  calibration: { x: 0, y: 0, z: 0, rotationY: 0, confirmed: false },
  events: [],
};

let panel = null;
let toggleButton = null;
let refreshTimer = null;
let frameCount = 0;
let fpsWindowStarted = 0;
let lastFrameAt = 0;
let cameraWorldPosition = null;

function addEvent(type, detail) {
  if (!XR_DIAGNOSTICS_ENABLED) return;

  const message = String(detail || "Unknown error")
    .replace(/\s+/g, " ")
    .slice(0, 180);
  state.events.unshift(type + ": " + message);
  state.events.length = Math.min(state.events.length, MAX_EVENTS);
  renderPanel();
}

function signed(value, digits) {
  const rounded = Number(value).toFixed(digits);
  return Number(value) >= 0 ? "+" + rounded : rounded;
}

function renderPanel(now = performance.now()) {
  if (!panel) return;

  const animationIsActive = lastFrameAt > 0 && now - lastFrameAt < 1500;
  state.animation = animationIsActive ? "ACTIVE" : "IDLE";

  const eventText = state.events.length
    ? state.events.map((event) => "- " + event).join("\n")
    : "none";

  const fpsText = state.fps === null ? "--" : String(state.fps);
  const hitCountText =
    state.hitResultCount === null ? "--" : String(state.hitResultCount);
  const gpsAccuracyText =
    state.gpsAccuracy === null ? "--" : state.gpsAccuracy.toFixed(1) + " m";
  const gpsSpreadText =
    state.gpsSpread === null ? "--" : state.gpsSpread.toFixed(1) + " m";
  const gpsTimestampText = state.gpsTimestamp
    ? new Date(state.gpsTimestamp).toISOString()
    : "--";

  panel.textContent = [
    "XR DEVICE DIAGNOSTICS",
    "XR: " + state.xr,
    "WEBXR: " + state.webxr,
    "IMMERSIVE-AR: " + state.immersiveAr,
    "SESSION: " + state.session,
    "LOCAL SPACE: " + state.localSpace,
    "VIEWER SPACE: " + state.viewerSpace,
    "HIT SOURCE: " + state.hitSource,
    "HIT TEST: " + state.hitTest + " (results: " + hitCountText + ")",
    "RETICLE: " + state.reticle,
    "ANIMATION: " + state.animation + " | FPS: " + fpsText,
    "MODELS: " + state.modelCount,
    "CAMERA: " + state.camera,
    "GEOLOCATION: " + state.geolocation,
    "GPS STATUS: " + state.gpsStatus,
    "GPS ACCURACY: " + gpsAccuracyText,
    "GPS SAMPLES: " + state.gpsSampleCount + " | SPREAD: " + gpsSpreadText,
    "GPS SOURCE / TIME: " + state.gpsSource + " / " + gpsTimestampText,
    "GPS BASE: " + state.gpsBase,
    "CALIBRATION BASE: X +0.00 m | Y +0.00 m | Z +0.00 m",
    "CALIBRATION FINAL: X " +
      signed(state.calibration.x, 2) +
      " m | Y " +
      signed(state.calibration.y, 2) +
      " m | Z " +
      signed(state.calibration.z, 2) +
      " m",
    "CALIBRATION ROTATION: " +
      signed(THREE.MathUtils.radToDeg(state.calibration.rotationY), 1) +
      "° (" +
      (state.calibration.confirmed ? "CONFIRMED" : "SESSION") +
      ")",
    "ERRORS / REJECTIONS:",
    eventText,
  ].join("\n");
}

function formatError(error) {
  if (error && error.stack) return error.stack;
  if (error && error.message) return error.name + ": " + error.message;
  return String(error);
}

function getSessionStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function initializeXRDiagnostics() {
  if (!XR_DIAGNOSTICS_ENABLED) return;

  toggleButton = document.createElement("button");
  toggleButton.id = "xr-diagnostics-toggle";
  toggleButton.type = "button";
  toggleButton.textContent = "XR";
  toggleButton.setAttribute("aria-label", "Toggle XR diagnostics");
  toggleButton.setAttribute("aria-controls", "xr-diagnostic-panel");
  toggleButton.setAttribute("aria-expanded", "false");
  toggleButton.style.cssText = [
    "position:fixed",
    "top:10px",
    "right:10px",
    "z-index:10001",
    "min-width:48px",
    "min-height:48px",
    "padding:8px 12px",
    "border:1px solid rgba(0,255,0,.65)",
    "border-radius:6px",
    "background:rgba(0,0,0,.88)",
    "color:#00ff00",
    "font:bold 14px monospace",
    "cursor:pointer",
    "pointer-events:auto",
    "touch-action:manipulation",
  ].join(";");

  panel = document.createElement("pre");
  panel.id = "xr-diagnostic-panel";
  panel.setAttribute("role", "status");
  panel.setAttribute("aria-live", "polite");
  panel.style.cssText = [
    "position:fixed",
    "top:64px",
    "left:8px",
    "z-index:10000",
    "box-sizing:border-box",
    "width:min(360px, calc(100vw - 16px))",
    "max-height:calc(100vh - 76px)",
    "overflow:auto",
    "margin:0",
    "padding:8px",
    "border:1px solid rgba(0,255,0,.55)",
    "border-radius:6px",
    "background:rgba(0,0,0,.82)",
    "color:#00ff00",
    "font:11px/1.35 monospace",
    "white-space:pre-wrap",
    "pointer-events:auto",
    "touch-action:pan-y",
    "display:none",
  ].join(";");

  toggleButton.addEventListener("click", () => {
    const isOpen = panel.style.display !== "none";
    panel.style.display = isOpen ? "none" : "block";
    toggleButton.setAttribute("aria-expanded", String(!isOpen));
  });

  document.body.appendChild(toggleButton);
  document.body.appendChild(panel);
  cameraWorldPosition = new THREE.Vector3();

  const storage = getSessionStorage();
  if (storage && storage.getItem(SESSION_END_KEY) === "ended") {
    state.session = "ENDED";
    state.xr = "ENDED";
    storage.removeItem(SESSION_END_KEY);
  }

  window.addEventListener("error", (event) => {
    const location =
      event.filename + ":" + event.lineno + ":" + event.colno;
    addEvent("ERROR", event.message + " (" + location + ")");
  });

  window.addEventListener("unhandledrejection", (event) => {
    addEvent("REJECTION", formatError(event.reason));
  });

  if (!navigator.xr) {
    state.webxr = "UNAVAILABLE";
    state.immersiveAr = "UNAVAILABLE";
    state.xr = state.session === "ENDED" ? "ENDED" : "UNAVAILABLE";
    renderPanel();
    refreshTimer = window.setInterval(renderPanel, REFRESH_INTERVAL_MS);
    return;
  }

  state.webxr = "AVAILABLE";
  state.immersiveAr = "CHECKING";
  renderPanel();

  if (typeof navigator.xr.isSessionSupported !== "function") {
    state.immersiveAr = "CHECK UNSUPPORTED";
    state.xr = state.session === "ENDED" ? "ENDED" : "UNKNOWN";
  } else {
    navigator.xr
      .isSessionSupported("immersive-ar")
      .then((supported) => {
        state.immersiveAr = supported ? "READY" : "UNSUPPORTED";
        if (state.session !== "STARTED" && state.session !== "ENDED") {
          state.xr = supported ? "READY" : "UNSUPPORTED";
        }
        renderPanel();
      })
      .catch((error) => {
        state.immersiveAr = "ERROR";
        if (state.session !== "STARTED" && state.session !== "ENDED") {
          state.xr = "ERROR";
        }
        addEvent("XR SUPPORT CHECK", formatError(error));
      });
  }

  refreshTimer = window.setInterval(renderPanel, REFRESH_INTERVAL_MS);
}

export function reportXRSessionStarted() {
  if (!XR_DIAGNOSTICS_ENABLED) return;
  state.session = "STARTED";
  state.xr = "SESSION";
  renderPanel();
}

export function reportXRSessionEnded() {
  if (!XR_DIAGNOSTICS_ENABLED) return;
  state.session = "ENDED";
  state.xr = "ENDED";
  const storage = getSessionStorage();
  if (storage) storage.setItem(SESSION_END_KEY, "ended");
  renderPanel();
}

export function reportReferenceSpaceCreated(name) {
  if (!XR_DIAGNOSTICS_ENABLED) return;
  if (name === "local") state.localSpace = "READY";
  if (name === "viewer") state.viewerSpace = "READY";
  renderPanel();
}

export function reportHitTestSourceCreated() {
  if (!XR_DIAGNOSTICS_ENABLED) return;
  state.hitSource = "READY";
  renderPanel();
}

export function reportGeolocationReady(location) {
  if (!XR_DIAGNOSTICS_ENABLED) return;
  state.gpsStatus = location.status || "READY";
  state.geolocation =
    location.latitude.toFixed(7) + ", " + location.longitude.toFixed(7);
  state.gpsBase = state.geolocation;
  state.gpsAccuracy = Number.isFinite(location.accuracy)
    ? location.accuracy
    : null;
  state.gpsSampleCount = Number(location.sampleCount) || 0;
  state.gpsSpread = Number.isFinite(location.spreadMeters)
    ? location.spreadMeters
    : null;
  state.gpsSource = location.source || "single fix";
  state.gpsTimestamp = Number(location.timestamp) || null;
}

export function reportGeolocationError(error) {
  if (!XR_DIAGNOSTICS_ENABLED) return;
  state.geolocation = "ERROR";
  state.gpsStatus = "ERROR";
  addEvent("GEOLOCATION", formatError(error));
}

export function reportGeolocationStatus(status, location = null) {
  if (!XR_DIAGNOSTICS_ENABLED) return;
  state.geolocation = status;
  state.gpsStatus = status;
  if (location) {
    state.gpsBase =
      location.latitude.toFixed(7) + ", " + location.longitude.toFixed(7);
    state.gpsAccuracy = Number.isFinite(location.accuracy)
      ? location.accuracy
      : null;
    state.gpsSampleCount = Number(location.sampleCount) || 0;
    state.gpsSpread = Number.isFinite(location.spreadMeters)
      ? location.spreadMeters
      : null;
    state.gpsSource = location.source || "--";
    state.gpsTimestamp = Number(location.timestamp) || null;
  }
}

export function reportGeolocationSample({ accuracy, sampleCount, spreadMeters }) {
  if (!XR_DIAGNOSTICS_ENABLED) return;
  state.gpsStatus = "ACQUIRING";
  state.gpsAccuracy = Number.isFinite(accuracy) ? accuracy : null;
  state.gpsSampleCount = Number(sampleCount) || 0;
  state.gpsSpread = Number.isFinite(spreadMeters) ? spreadMeters : null;
}

export function reportCalibrationState({
  x = 0,
  y = 0,
  z = 0,
  rotationY = 0,
  confirmed = false,
}) {
  if (!XR_DIAGNOSTICS_ENABLED) return;
  state.calibration = {
    x: Number(x) || 0,
    y: Number(y) || 0,
    z: Number(z) || 0,
    rotationY: Number(rotationY) || 0,
    confirmed,
  };
}

export function reportDiagnosticError(type, error) {
  addEvent(type, formatError(error));
}

// Selection is event-driven rather than frame-driven. Keeping it here makes a
// device report useful without filling the panel while the camera is moving.
export function reportSelectionEvent(type, detail) {
  addEvent("SELECT " + type, detail);
}

export function recordXRFrame({
  hitResultCount,
  reticleVisible,
  modelCount,
  camera,
}) {
  if (!XR_DIAGNOSTICS_ENABLED || !panel) return;

  const now = performance.now();
  frameCount += 1;

  if (fpsWindowStarted === 0) fpsWindowStarted = now;
  const elapsed = now - fpsWindowStarted;
  if (elapsed >= REFRESH_INTERVAL_MS) {
    state.fps = Math.round((frameCount * 1000) / elapsed);
    frameCount = 0;
    fpsWindowStarted = now;
  }

  lastFrameAt = now;
  state.hitResultCount = hitResultCount;
  state.hitTest =
    hitResultCount === null
      ? "NO FRAME POSE"
      : hitResultCount > 0
        ? "FOUND"
        : state.hitSource === "READY"
          ? "SEARCHING"
          : "WAITING";
  state.reticle = reticleVisible ? "VISIBLE" : "HIDDEN";
  state.modelCount = modelCount;

  if (camera) {
    camera.getWorldPosition(cameraWorldPosition);
    state.camera =
      "READY (" +
      cameraWorldPosition.x.toFixed(1) +
      ", " +
      cameraWorldPosition.y.toFixed(1) +
      ", " +
      cameraWorldPosition.z.toFixed(1) +
      ")";
  } else {
    state.camera = "NOT INITIALIZED";
  }
}

