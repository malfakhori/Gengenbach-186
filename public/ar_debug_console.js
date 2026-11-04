// Debug-Konsole aktivieren
const debugConsoleEnabled = false;

if (debugConsoleEnabled) {
    const debugConsole = document.getElementById('debug-console');
    const debugToggleBtn = document.getElementById('debug-toggle-btn');
    debugConsole.style.display = 'block';
    debugToggleBtn.style.display = 'block';

    // Toggle-Funktion hinzufügen
    let isDebugVisible = true;
    debugToggleBtn.addEventListener('click', () => {
        toggleDebugConsole();
    });

    // Konsole überschreiben
    (function() {
        const oldConsoleLog = console.log;
        console.log = function(...args) {
            oldConsoleLog.apply(console, args); // Normale Konsole weiterhin nutzen

            // Logs in das Debug-Element schreiben
            debugConsole.innerHTML += args.join(' ') + '<br>';
            debugConsole.scrollTop = debugConsole.scrollHeight; // Automatisch nach unten scrollen
        };

        const oldConsoleError = console.error;
        console.error = function(...args) {
            oldConsoleError.apply(console, args);
            debugConsole.innerHTML += '<span style="color: red;">' + args.join(' ') + '</span><br>';
            debugConsole.scrollTop = debugConsole.scrollHeight;
        };

        // JavaScript-Fehler global abfangen
        window.onerror = function(message, source, lineno, colno, error) {
            const errorMsg = `[ERROR] ${message} at ${source}:${lineno}:${colno}`;
            debugConsole.innerHTML += `<span style="color: red;">${errorMsg}</span><br>`;
            debugConsole.scrollTop = debugConsole.scrollHeight;

            // Auch in der normalen Konsole anzeigen
            oldConsoleError(errorMsg);
        };

        // Unhandled Promise Rejections abfangen
        window.addEventListener('unhandledrejection', function(event) {
            const errorMsg = `[PROMISE ERROR] ${event.reason}`;
            debugConsole.innerHTML += `<span style="color: orange;">${errorMsg}</span><br>`;
            debugConsole.scrollTop = debugConsole.scrollHeight;

            oldConsoleError(errorMsg);
        });
    })();

    function toggleDebugConsole() {
        isDebugVisible = !isDebugVisible;
        debugConsole.style.display = isDebugVisible ? 'block' : 'none';
        debugToggleBtn.innerText = isDebugVisible ? 'Close' : 'Open Console';
    }

    toggleDebugConsole();
    console.log("Debug Console enabled");
}
