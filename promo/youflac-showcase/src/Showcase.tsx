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

export const SCREEN_DURATION = 50;
export const TRANSITION = 12;

const PINK = "#e91e8c";
const BG = "#0d0d12";

// Browser window mockup
const BrowserMockup: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div
      style={{
        width: 960,
        height: 600,
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: `0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06), 0 0 60px rgba(233,30,140,0.08)`,
        position: "relative",
        background: "#111",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Chrome bar */}
      <div
        style={{
          background: "#1a1a22",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        {/* Traffic lights */}
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f57" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#febc2e" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#28c840" }} />
        </div>
        {/* Address bar */}
        <div
          style={{
            flex: 1,
            background: "#0d0d12",
            borderRadius: 6,
            padding: "5px 12px",
            fontSize: 12,
            color: "#666",
            fontFamily: "system-ui, sans-serif",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ color: "#28c840", fontSize: 10 }}>●</span>
          localhost:8080
        </div>
      </div>
      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
};

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
        justifyContent: "center",
        alignItems: "center",
        opacity,
        transform: `scale(${scale}) translateY(${translateY}px)`,
      }}
    >
      <BrowserMockup>
        <Img
          src={staticFile(`screenshots/${src}`)}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
        />
      </BrowserMockup>

      {/* Label */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          opacity: labelOpacity,
          transform: `translateY(${labelY}px)`,
          background: "rgba(233,30,140,0.15)",
          border: `1px solid rgba(233,30,140,0.4)`,
          borderRadius: 20,
          padding: "8px 20px",
          fontSize: 16,
          fontWeight: 600,
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          letterSpacing: 0.5,
          backdropFilter: "blur(8px)",
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
  const titleOpacity = interpolate(frame, [0, 10, 38, 48], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subOpacity = interpolate(frame, [8, 18, 38, 48], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tagOpacity = interpolate(frame, [16, 24, 38, 48], [0, 1, 1, 0], {
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
  const outroStart = 50 + SCREENS.length * (SCREEN_DURATION - TRANSITION);

  return (
    <AbsoluteFill style={{ background: BG }}>
      {/* Subtle gradient vignette */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)",
          pointerEvents: "none",
        }}
      />

      <Sequence durationInFrames={50}>
        <TitleCard />
      </Sequence>

      {SCREENS.map((screen, i) => {
        const start = 50 + i * (SCREEN_DURATION - TRANSITION);
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
