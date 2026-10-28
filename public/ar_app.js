import "./ar_debug_console.js";
import { initializeXRDiagnostics } from "./ar_diagnostics.js";
import { initializeMainUI, installLegacyUI } from "./ar_main.js";
import { downloadScene } from "./ar_download.js";
import { showStartScreen } from "./ar_start.js";

initializeXRDiagnostics();
if (navigator.xr) {
  showStartScreen();
} else {
  alert("WebXR wird nicht unterstützt.");
}

installLegacyUI(downloadScene);
initializeMainUI();
