import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { brandFont } from "../fonts";
import { BrandMark } from "../BrandMark";

export const SceneLogo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      name="Logo background"
      style={{
        backgroundColor: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Interactive.Div
        name="Brand mark wrapper"
        style={{
          scale: interpolate(frame, [0, 0.35 * fps], [0.6, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 200 }),
            output: "perceptual-scale",
          }),
          opacity: interpolate(frame, [0, 0.25 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <BrandMark size={170} />
      </Interactive.Div>

      <Interactive.Div
        name="Welcome line"
        style={{
          fontFamily: brandFont,
          fontWeight: 400,
          fontSize: 34,
          letterSpacing: 3,
          color: "#5b6b78",
          marginTop: 28,
          opacity: interpolate(frame, [0.3 * fps, 0.65 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        BIENVENUE CHEZ
      </Interactive.Div>

      <Interactive.Div
        name="Wordmark"
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "baseline",
          gap: 20,
          marginTop: 6,
          opacity: interpolate(frame, [0.55 * fps, 0.95 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          scale: interpolate(frame, [0.55 * fps, 0.95 * fps], [0.94, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            output: "perceptual-scale",
          }),
        }}
      >
        <Interactive.Div
          name="Wordmark NOVA"
          style={{
            fontFamily: brandFont,
            fontWeight: 700,
            fontSize: 110,
            color: "#0d3b66",
          }}
        >
          NOVA
        </Interactive.Div>
        <Interactive.Div
          name="Wordmark SANTE"
          style={{
            fontFamily: brandFont,
            fontWeight: 700,
            fontSize: 110,
            color: "#1f9d55",
          }}
        >
          SANTÉ
        </Interactive.Div>
      </Interactive.Div>
      <Interactive.Div
        name="Wordmark PHARMA"
        style={{
          fontFamily: brandFont,
          fontWeight: 600,
          fontSize: 42,
          letterSpacing: 14,
          color: "#0d3b66",
          marginTop: 4,
          opacity: interpolate(frame, [0.85 * fps, 1.2 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        PHARMA
      </Interactive.Div>
    </AbsoluteFill>
  );
};
