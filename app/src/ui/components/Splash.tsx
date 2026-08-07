import { useEffect, useState } from "react";

interface SplashProps {
  onDone: () => void;
}

// Animated splash screen shown once on launch.
export function Splash({ onDone }: SplashProps): React.ReactElement {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // The doodle draws over 1s (CSS `splash-draw`). Hold 1s after that, then leave.
    let doneTimer: ReturnType<typeof setTimeout>;
    const hideTimer = setTimeout(() => {
      setLeaving(true);
      doneTimer = setTimeout(onDone, 380);
    }, 2000);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div id="splash" className={leaving ? "splash-hide" : undefined}>
      <svg
        id="splash-doodle"
        viewBox="0 0 821.026 1536.01"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          id="splash-doodle-path"
          d="M110.029 321.428C110.923 318.559 117.257 307.438 143.365 273.901C151.222 263.809 158.477 253.932 174.441 234.969C190.405 216.006 214.783 188.198 233.035 169.076C276.794 123.232 302.734 115.934 325.217 111.977C350.259 107.57 369.351 111.538 374.947 113.897C381.743 116.763 387.426 122.358 391.941 127.375C401.076 137.525 391.117 163.281 364.594 225.046C343.951 273.116 302.275 364.523 275.99 421.693C240.364 499.182 227.428 522.485 223.281 533.455C215.891 553.001 208.371 582.163 200.919 618.403C192.346 660.093 191.044 688.53 192.323 695.596C193.057 699.651 208.566 688.149 233.346 670.997C268.925 646.369 302.593 625.404 326.816 604.963C340.27 593.61 354.75 578.732 379.197 553.883C403.645 529.034 437.281 494.271 459.47 472.648C502.619 430.601 520.177 427.473 531.977 425.593C534.747 425.152 537.421 425.396 539.106 426.739C540.792 428.082 541.438 430.78 540.139 484.143C538.84 537.507 535.576 641.455 534.434 696.433C533.113 760.011 542.126 770.525 547.728 780.432C549.17 782.982 551.032 785.281 552.762 785.451C562.256 786.386 575.852 761.494 607.731 738.172C625.216 725.381 663.166 704.408 694.064 686.699C699.606 683.522 704.565 681.482 707.405 681.608C710.245 681.735 710.977 684.387 711.027 687.393C711.078 690.398 710.425 693.676 685.261 782.777C660.097 871.878 610.441 1046.7 580.231 1165.72C550.022 1284.74 540.763 1342.65 535.693 1374C530.623 1405.34 530.022 1408.36 529.156 1412.07C528.289 1415.79 527.176 1420.1 523.698 1425.99"
          pathLength={1}
          fill="none"
          stroke="#FFFF83"
          strokeWidth={220}
          strokeLinecap="round"
        />
      </svg>
      <div id="splash-word">
        Pawpal
      </div>
    </div>
  );
}
