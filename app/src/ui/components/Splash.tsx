import { useEffect, useRef, useState } from "react";
import type { Avatar } from "../types";
import { DogAvatar } from "../avatar/DogAvatar";

const DEFAULT_AVATAR: Avatar = {
  head: "Normal",
  body: "Normal",
  colour: "lightbrown2",
  eyes: "Normal",
  nose: "Normal",
};

interface SplashProps {
  avatar?: Avatar;
  onDone: () => void;
}

// Animated splash screen shown once on launch.
export function Splash({ avatar, onDone }: SplashProps): React.ReactElement {
  const [leaving, setLeaving] = useState(false);
  const wordRef = useRef<HTMLDivElement>(null);
  const dogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const word = wordRef.current;
    const dog = dogRef.current;
    let hideTimer: ReturnType<typeof setTimeout>;
    let doneTimer: ReturnType<typeof setTimeout>;
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (word) word.style.animation = "splash-pop 0.7s cubic-bezier(0.34,1.56,0.64,1) both";
        if (dog) dog.style.animation = "splash-rise 0.6s 0.35s ease-out both";
        hideTimer = setTimeout(() => {
          setLeaving(true);
          doneTimer = setTimeout(onDone, 380);
        }, 2200);
      }),
    );
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(hideTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div id="splash" className={leaving ? "splash-hide" : undefined}>
      <div id="splash-word" ref={wordRef}>
        PawPal
      </div>
      <div id="splash-dog" ref={dogRef}>
        <DogAvatar avatar={avatar ?? DEFAULT_AVATAR} size={220} />
      </div>
    </div>
  );
}
