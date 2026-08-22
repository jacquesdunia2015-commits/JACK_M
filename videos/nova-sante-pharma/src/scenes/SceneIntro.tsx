import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { brandFont } from "../fonts";

export const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      name="Intro background"
      style={{ backgroundColor: "#0d3b66" }}
    >
      <Interactive.Div
        name="Mountain silhouette"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: 1920,
          height: 420,
          backgroundColor: "#123f6e",
          clipPath:
            "polygon(0% 100%, 0% 55%, 15% 30%, 28% 48%, 42% 15%, 58% 42%, 74% 22%, 88% 46%, 100% 32%, 100% 100%)",
        }}
      />
      <Interactive.Div
        name="Lake"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: 1920,
          height: 190,
          backgroundColor: "#1f6fb2",
          opacity: 0.55,
        }}
      />
      <AbsoluteFill
        name="Intro text layer"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: 160,
        }}
      >
        <Interactive.Div
          name="Line 1"
          style={{
            fontFamily: brandFont,
            fontWeight: 600,
            fontSize: 58,
            letterSpacing: 2,
            color: "#bcd9f2",
            opacity: interpolate(frame, [0, 0.6 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            translate: interpolate(
              frame,
              [0, 0.6 * fps],
              ["0px 18px", "0px 0px"],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              },
            ),
          }}
        >
          PARTOUT EN RDC,
        </Interactive.Div>
        <Interactive.Div
          name="Line 2"
          style={{
            fontFamily: brandFont,
            fontWeight: 700,
            fontSize: 86,
            lineHeight: 1.2,
            color: "#ffffff",
            textAlign: "center",
            marginTop: 16,
            opacity: interpolate(frame, [1.1 * fps, 1.8 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            translate: interpolate(
              frame,
              [1.1 * fps, 1.8 * fps],
              ["0px 18px", "0px 0px"],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              },
            ),
          }}
        >
          Prendre soin de sa santé
        </Interactive.Div>
        <Interactive.Div
          name="Line 3"
          style={{
            fontFamily: brandFont,
            fontWeight: 600,
            fontSize: 46,
            color: "#8fd6a8",
            textAlign: "center",
            marginTop: 22,
            opacity: interpolate(frame, [2.4 * fps, 3.1 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          commence par une pharmacie de confiance.
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
