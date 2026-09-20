import { useEffect, useState } from "react";
import "./install-app.css";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function InstallAppButton() {
  const isParentPortal = new URLSearchParams(window.location.search).get("parent") === "1";
  const installTitle = isParentPortal ? "تثبيت بوابة ولي الأمر" : "تثبيت بنك التميز";
  const installLabel = isParentPortal ? "تثبيت بوابة ولي الأمر" : "تثبيت التطبيق";
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setShowHelp(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setPromptEvent(null);
      return;
    }
    setShowHelp(true);
  }

  if (installed) return null;

  return (
    <>
      <button className="install-app-button" onClick={install} type="button" aria-label={installTitle}>
        <span className="install-app-icon">⬇</span>
        <span>{installLabel}</span>
      </button>
      {showHelp && (
        <div className="install-help-backdrop" onClick={() => setShowHelp(false)}>
          <div className="install-help-card" onClick={(e) => e.stopPropagation()}>
            <button className="install-help-close" onClick={() => setShowHelp(false)} type="button">×</button>
            <h3>{installTitle}</h3>
            {isIOS() ? (
              <p>على iPhone أو iPad: افتح زر <b>المشاركة</b> في Safari، ثم اختر <b>إضافة إلى الشاشة الرئيسية</b> ثم <b>إضافة</b>. {isParentPortal ? "ستظهر أيقونة ولي الأمر وتفتح بوابتكم مباشرة." : ""}</p>
            ) : (
              <p>من قائمة المتصفح اختر <b>تثبيت التطبيق</b> أو <b>إضافة إلى الشاشة الرئيسية</b>. {isParentPortal ? "بعد التثبيت ستظهر أيقونة «ولي الأمر» وتفتح مباشرة على بوابة ولي الأمر." : "بعد التثبيت ستظهر أيقونة بنك التميز ويمكن فتحه مباشرة منها."}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
