import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { brandFont } from "../fonts";

export const SceneEngagement: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      name="Engagement background"
      style={{
        backgroundColor: "#0d3b66",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingLeft: 200,
        paddingRight: 200,
      }}
    >
      <Interactive.Div
        name="Pillars row"
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 64,
          marginBottom: 46,
        }}
      >
        <Interactive.Div
          name="Pillar qualite"
          style={{
            fontFamily: brandFont,
            fontWeight: 700,
            fontSize: 66,
            color: "#ffffff",
            opacity: interpolate(frame, [0, 0.6 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          Qualité
        </Interactive.Div>
        <Interactive.Div
          name="Pillar securite"
          style={{
            fontFamily: brandFont,
            fontWeight: 700,
            fontSize: 66,
            color: "#8fd6a8",
            opacity: interpolate(frame, [0.5 * fps, 1.1 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          Sécurité
        </Interactive.Div>
        <Interactive.Div
          name="Pillar ecoute"
          style={{
            fontFamily: brandFont,
            fontWeight: 700,
            fontSize: 66,
            color: "#bcd9f2",
            opacity: interpolate(frame, [1.0 * fps, 1.6 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          Écoute
        </Interactive.Div>
      </Interactive.Div>

      <Interactive.Div
        name="Ornament line"
        style={{
          width: 200,
          height: 4,
          backgroundColor: "#1f9d55",
          marginBottom: 40,
          scale: interpolate(frame, [1.4 * fps, 2.1 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 200 }),
            output: "perceptual-scale",
          }),
        }}
      />

      <Interactive.Div
        name="Engagement statement"
        style={{
          fontFamily: brandFont,
          fontWeight: 400,
          fontSize: 44,
          lineHeight: 1.4,
          textAlign: "center",
          color: "#e7f0f8",
          maxWidth: 1300,
          opacity: interpolate(frame, [1.8 * fps, 2.5 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Au cœur de notre engagement, chez NOVA SANTÉ PHARMA.
      </Interactive.Div>
    </AbsoluteFill>
  );
};
