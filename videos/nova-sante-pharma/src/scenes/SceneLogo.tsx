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
          scale: interpolate(frame, [0, 0.7 * fps], [0.6, 1], {
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
        <BrandMark size={190} />
      </Interactive.Div>

      <Interactive.Div
        name="Welcome line"
        style={{
          fontFamily: brandFont,
          fontWeight: 400,
          fontSize: 38,
          letterSpacing: 3,
          color: "#5b6b78",
          marginTop: 34,
          opacity: interpolate(frame, [0.7 * fps, 1.3 * fps], [0, 1], {
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
          gap: 22,
          marginTop: 8,
          opacity: interpolate(frame, [1 * fps, 1.6 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          scale: interpolate(frame, [1 * fps, 1.6 * fps], [0.94, 1], {
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
            fontSize: 118,
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
            fontSize: 118,
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
          fontSize: 46,
          letterSpacing: 14,
          color: "#0d3b66",
          marginTop: 4,
          opacity: interpolate(frame, [1.4 * fps, 2 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        PHARMA
      </Interactive.Div>
      <Interactive.Div
        name="Tagline"
        style={{
          fontFamily: brandFont,
          fontWeight: 400,
          fontStyle: "italic",
          fontSize: 36,
          color: "#1f9d55",
          marginTop: 26,
          opacity: interpolate(frame, [2 * fps, 2.7 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Votre santé, notre priorité.
      </Interactive.Div>
    </AbsoluteFill>
  );
};
