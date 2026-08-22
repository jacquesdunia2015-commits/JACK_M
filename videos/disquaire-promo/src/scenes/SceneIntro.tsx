import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { headlineFont, bodyFont } from "../fonts";

export const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      name="Intro background"
      style={{
        backgroundColor: "#f3e6c8",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Interactive.Div
        name="Store name"
        style={{
          fontFamily: headlineFont,
          fontSize: 168,
          letterSpacing: 6,
          color: "#c1461f",
          opacity: interpolate(frame, [0, 0.6 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          scale: interpolate(frame, [0, 0.8 * fps], [0.85, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 200 }),
            output: "perceptual-scale",
          }),
        }}
      >
        LE SILLON
      </Interactive.Div>
      <Interactive.Div
        name="Ornament line"
        style={{
          width: 220,
          height: 4,
          backgroundColor: "#dba43f",
          marginTop: 8,
          marginBottom: 24,
          scale: interpolate(frame, [0.5 * fps, 1.3 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 200 }),
            output: "perceptual-scale",
          }),
        }}
      />
      <Interactive.Div
        name="Tagline"
        style={{
          fontFamily: bodyFont,
          fontWeight: 600,
          fontSize: 40,
          letterSpacing: 10,
          color: "#1c1712",
          opacity: interpolate(frame, [1 * fps, 1.8 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(
            frame,
            [1 * fps, 1.8 * fps],
            ["0px 16px", "0px 0px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          ),
        }}
      >
        DISQUAIRE DE QUARTIER
      </Interactive.Div>
    </AbsoluteFill>
  );
};
