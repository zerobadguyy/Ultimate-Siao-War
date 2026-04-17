(function initMusicPlayer() {
  const slider = document.getElementById("musicVolume");
  if (!slider) return;

  const script = document.currentScript;
  const track = script?.dataset?.track;
  if (!track) return;

  const STORAGE_KEY = "bgmVolume";
  const initialVolume = Math.max(0, Math.min(1, (Number(localStorage.getItem(STORAGE_KEY)) || 55) / 100));
  const audio = new Audio(track);
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = initialVolume;

  slider.value = String(Math.round(initialVolume * 100));

  let started = false;
  const tryStart = () => {
    if (started || audio.volume <= 0) return;
    started = true;
    audio.play().catch(() => {
      started = false;
    });
  };

  const saveVolume = (value) => {
    const normalized = Math.max(0, Math.min(100, Number(value) || 0));
    localStorage.setItem(STORAGE_KEY, String(normalized));
    audio.volume = normalized / 100;
    if (audio.volume > 0) {
      tryStart();
    } else if (!audio.paused) {
      audio.pause();
    }
  };

  slider.addEventListener("input", () => {
    saveVolume(slider.value);
  });

  const unlock = () => {
    tryStart();
    window.removeEventListener("pointerdown", unlock, true);
    window.removeEventListener("keydown", unlock, true);
  };

  window.addEventListener("pointerdown", unlock, true);
  window.addEventListener("keydown", unlock, true);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      audio.pause();
      started = false;
    } else {
      tryStart();
    }
  });
})();
