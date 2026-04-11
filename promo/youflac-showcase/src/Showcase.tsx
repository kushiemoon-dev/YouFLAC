import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from "remotion";

export const SCREENS = [
  { file: "01-home.png", label: "Paste & Download" },
  { file: "06-search.png", label: "YouTube Search" },
  { file: "04-converter.png", label: "Audio Converter" },
  { file: "05-settings.png", label: "Settings" },
  { file: "07-about.png", label: "About" },
];

export const SCREEN_DURATION = 90;
export const TRANSITION = 15;

const PINK = "#e91e8c";
const BG = "#0d0d12";


const ScreenSlide: React.FC<{ src: string; label: string }> = ({ src, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ fps, frame, config: { damping: 100, stiffness: 160 } });
  const exit = spring({
    fps,
    frame: frame - (SCREEN_DURATION - TRANSITION),
    config: { damping: 100, stiffness: 160 },
  });

  const translateY = interpolate(enter, [0, 1], [30, 0]) + interpolate(exit, [0, 1], [0, -20]);
  const opacity = interpolate(enter, [0, 1], [0, 1]) * interpolate(exit, [0, 1], [1, 0]);
  const scale = interpolate(enter, [0, 1], [0.96, 1]) * interpolate(exit, [0, 1], [1, 0.98]);

  const labelOpacity = interpolate(
    frame,
    [8, 16, SCREEN_DURATION - TRANSITION - 8, SCREEN_DURATION - TRANSITION],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const labelY = interpolate(frame, [8, 16], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `scale(${scale}) translateY(${translateY}px)`,
      }}
    >
      {/* Full screen screenshot */}
      <Img
        src={staticFile(`screenshots/${src}`)}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
      />

      {/* Subtle bottom gradient for label readability */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: 120,
        background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
      }} />

      {/* Label */}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          left: "50%",
          transform: `translateX(-50%) translateY(${labelY}px)`,
          opacity: labelOpacity,
          background: "rgba(233,30,140,0.18)",
          border: `1px solid rgba(233,30,140,0.5)`,
          borderRadius: 20,
          padding: "8px 22px",
          fontSize: 18,
          fontWeight: 600,
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          letterSpacing: 0.5,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
    </AbsoluteFill>
  );
};

const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ fps, frame, config: { damping: 80, stiffness: 120 } });
  const titleOpacity = interpolate(frame, [0, 10, 58, 68], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subOpacity = interpolate(frame, [8, 18, 58, 68], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tagOpacity = interpolate(frame, [16, 24, 58, 68], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center", transform: `scale(${scale})` }}>
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: PINK,
            opacity: titleOpacity,
            letterSpacing: 2,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          YouFLAC
        </div>
        <div
          style={{
            fontSize: 20,
            color: "#aaa",
            opacity: subOpacity,
            marginTop: 12,
            fontFamily: "system-ui, sans-serif",
            fontWeight: 400,
            letterSpacing: 0.5,
          }}
        >
          YouTube Video + Lossless FLAC = Perfect MKV
        </div>
        <div
          style={{
            marginTop: 20,
            display: "flex",
            gap: 10,
            justifyContent: "center",
            opacity: tagOpacity,
          }}
        >
          {["Tidal", "Qobuz", "Amazon Music"].map((s) => (
            <span
              key={s}
              style={{
                background: "rgba(233,30,140,0.12)",
                border: "1px solid rgba(233,30,140,0.3)",
                borderRadius: 12,
                padding: "4px 14px",
                fontSize: 13,
                color: "#ccc",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const OutroCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ fps, frame, config: { damping: 80, stiffness: 150 } });
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity }}>
      <div style={{ textAlign: "center", transform: `scale(${scale})` }}>
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: PINK,
            fontFamily: "system-ui, sans-serif",
            letterSpacing: 2,
          }}
        >
          YouFLAC
        </div>
        <div
          style={{
            fontSize: 16,
            color: "#555",
            marginTop: 12,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          github.com/kushiemoon-dev/YouFLAC
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Showcase: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  const outroStart = 70 + SCREENS.length * (SCREEN_DURATION - TRANSITION);

  return (
    <AbsoluteFill style={{ background: BG }}>
      {/* Subtle gradient vignette */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)",
          pointerEvents: "none",
        }}
      />

      <Sequence durationInFrames={70}>
        <TitleCard />
      </Sequence>

      {SCREENS.map((screen, i) => {
        const start = 70 + i * (SCREEN_DURATION - TRANSITION);
        return (
          <Sequence key={screen.file} from={start} durationInFrames={SCREEN_DURATION + 10}>
            <ScreenSlide src={screen.file} label={screen.label} />
          </Sequence>
        );
      })}

      <Sequence from={outroStart} durationInFrames={durationInFrames - outroStart}>
        <OutroCard />
      </Sequence>

    </AbsoluteFill>
  );
};
