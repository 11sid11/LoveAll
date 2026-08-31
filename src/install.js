export function setupInstallExperience({ button, onManualInstall, onInstalled }) {
  let deferredPrompt = null;

  const updateButton = () => {
    button.hidden = isStandalone();
  };

  updateButton();

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    updateButton();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    button.hidden = true;
    onInstalled?.();
  });

  button.addEventListener("click", async () => {
    if (isStandalone()) {
      button.hidden = true;
      return;
    }

    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;
      await prompt.prompt();
      await prompt.userChoice.catch(() => null);
      return;
    }

    onManualInstall?.({ isAppleMobile: isAppleMobileBrowser() });
  });

  registerServiceWorker();
}

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
}

function isAppleMobileBrowser() {
  const userAgent = navigator.userAgent ?? "";
  const platform = navigator.platform ?? "";
  const touchMac = platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(userAgent) || touchMac;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    const workerUrl = new URL("../sw.js", import.meta.url).href;
    const scopeUrl = new URL("../", import.meta.url).pathname;

    navigator.serviceWorker.register(workerUrl, { scope: scopeUrl }).catch(() => {
      // Offline support is progressive enhancement; scoring remains fully usable without it.
    });
  }, { once: true });
}
