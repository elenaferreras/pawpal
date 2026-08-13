import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

const APP_URL = "https://elenaferreras.github.io/pawpal/";

// Desktop = a wide viewport driven by a fine pointer (mouse). Phones/tablets in
// portrait keep the normal app; a desktop browser gets the "scan to continue"
// screen instead.
const DESKTOP_QUERY = "(min-width: 760px) and (pointer: fine)";

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(DESKTOP_QUERY).matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = (): void => setIsDesktop(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}

// Full-screen "PawPal is available on mobile" gate (Figma node 261:4958).
// Reuses the welcome-screen dog doodles around a QR code linking to the app.
// Everything is positioned inside a fixed-aspect stage (1414×874, the Figma
// frame) so the composition scales as one unit and matches the design exactly.
export function DesktopGate(): React.ReactElement {
  return (
    <div className="qr-gate">
      <div className="qr-gate-stage">
        <img className="qr-gate-dog qr-gate-dog--blue" src="onboarding/dog-blue.svg" alt="" aria-hidden />
        <img className="qr-gate-dog qr-gate-dog--purple" src="onboarding/dog-purple.svg" alt="" aria-hidden />
        <img className="qr-gate-dog qr-gate-dog--cream" src="onboarding/dog-cream.svg" alt="" aria-hidden />
        <img className="qr-gate-dog qr-gate-dog--orange" src="onboarding/dog-orange.svg" alt="" aria-hidden />

        <div className="qr-gate-code">
          <QRCodeSVG
            value={APP_URL}
            size={246}
            level="M"
            marginSize={3}
            fgColor="#352b25"
            bgColor="#ffff83"
          />
        </div>

        <div className="qr-gate-ctas">
          <h1 className="qr-gate-title">PawPal is available on mobile</h1>
          <p className="qr-gate-sub">Scan the QR code and use Pawpal on your mobile device</p>
        </div>
      </div>
    </div>
  );
}
