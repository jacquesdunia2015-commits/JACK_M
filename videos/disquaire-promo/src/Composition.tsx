import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { CalculateMetadataFunction, Composition } from "remotion";
import { SceneIntro } from "./scenes/SceneIntro";
import { SceneVinyl } from "./scenes/SceneVinyl";
import { SceneOffer } from "./scenes/SceneOffer";
import { SceneCTA } from "./scenes/SceneCTA";

type Props = {};

const calculateMetadata: CalculateMetadataFunction<Props> = () => {
  return {};
};

export const DisquairePromo: React.FC<Props> = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={110} name="Intro">
        <SceneIntro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence durationInFrames={190} name="Vinyl">
        <SceneVinyl />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence durationInFrames={190} name="Offer">
        <SceneOffer />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence durationInFrames={190} name="CTA">
        <SceneCTA />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

export const MyComposition = () => {
  return (
    <Composition
      id="DisquairePromo"
      component={DisquairePromo}
      durationInFrames={635}
      fps={30}
      width={1920}
      height={1080}
      calculateMetadata={calculateMetadata}
    />
  );
};
