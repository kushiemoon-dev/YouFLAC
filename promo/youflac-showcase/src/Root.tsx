import React from "react";
import { Composition } from "remotion";
import { Showcase, SCREENS, SCREEN_DURATION, TRANSITION } from "./Showcase";

const totalFrames = 70 + SCREENS.length * (SCREEN_DURATION - TRANSITION) + 60;

export const Root: React.FC = () => {
  return (
    <Composition
      id="Showcase"
      component={Showcase}
      durationInFrames={totalFrames}
      fps={30}
      width={1280}
      height={800}
    />
  );
};
