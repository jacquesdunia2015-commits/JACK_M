import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { bodyFont } from "../fonts";

export const SceneVinyl: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      name="Vinyl background"
      style={{
        backgroundColor: "#1c1712",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 120,
        paddingLeft: 140,
        paddingRight: 140,
      }}
    >
      <Interactive.Div
        name="Vinyl record"
        style={{
          width: 560,
          height: 560,
          borderRadius: 999,
          flexShrink: 0,
          backgroundImage:
            "repeating-radial-gradient(circle at center, #050505 0px, #050505 2px, #201a14 3px, #201a14 6px)",
          boxShadow: "0px 30px 60px rgba(0, 0, 0, 0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          rotate: interpolate(frame, [0, durationInFrames], ["0deg", "1080deg"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [0, 0.7 * fps], [0.7, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 200 }),
            output: "perceptual-scale",
          }),
          opacity: interpolate(frame, [0, 0.5 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <Interactive.Div
          name="Vinyl label"
          style={{
            width: 190,
            height: 190,
            borderRadius: 999,
            backgroundColor: "#c1461f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "inset 0px 0px 0px 6px #dba43f",
          }}
        >
          <Interactive.Div
            name="Vinyl label text"
            style={{
              fontFamily: bodyFont,
              fontWeight: 600,
              fontSize: 22,
              letterSpacing: 2,
              color: "#f3e6c8",
              textAlign: "center",
            }}
          >
            33⅓ RPM
          </Interactive.Div>
        </Interactive.Div>
      </Interactive.Div>

      <Interactive.Div
        name="Copy block"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 28,
          maxWidth: 640,
        }}
      >
        <Interactive.Div
          name="Copy line 1"
          style={{
            fontFamily: bodyFont,
            fontWeight: 600,
            fontSize: 76,
            lineHeight: 1.15,
            color: "#f3e6c8",
            opacity: interpolate(frame, [0.8 * fps, 1.5 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            translate: interpolate(
              frame,
              [0.8 * fps, 1.5 * fps],
              ["-40px 0px", "0px 0px"],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              },
            ),
          }}
        >
          Des milliers de vinyles.
        </Interactive.Div>
        <Interactive.Div
          name="Copy line 2"
          style={{
            fontFamily: bodyFont,
            fontWeight: 400,
            fontSize: 44,
            letterSpacing: 1,
            color: "#dba43f",
            opacity: interpolate(frame, [1.3 * fps, 2 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            translate: interpolate(
              frame,
              [1.3 * fps, 2 * fps],
              ["-40px 0px", "0px 0px"],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              },
            ),
          }}
        >
          Jazz · Rock · Soul · Afrobeat
        </Interactive.Div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};
