import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { CalculateMetadataFunction, Composition } from "remotion";
import { SceneIntro } from "./scenes/SceneIntro";
import { SceneLogo } from "./scenes/SceneLogo";
import { SceneFeatures } from "./scenes/SceneFeatures";
import { SceneEngagement } from "./scenes/SceneEngagement";
import { SceneEndCard } from "./scenes/SceneEndCard";

type Props = {};

const calculateMetadata: CalculateMetadataFunction<Props> = () => {
  return {};
};

export const NovaPresentation: React.FC<Props> = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={170} name="Intro">
        <SceneIntro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence durationInFrames={160} name="Logo">
        <SceneLogo />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence durationInFrames={300} name="Features">
        <SceneFeatures />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence durationInFrames={170} name="Engagement">
        <SceneEngagement />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence durationInFrames={170} name="EndCard">
        <SceneEndCard />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

export const MyComposition = () => {
  return (
    <Composition
      id="NovaPresentation"
      component={NovaPresentation}
      durationInFrames={910}
      fps={30}
      width={1920}
      height={1080}
      calculateMetadata={calculateMetadata}
    />
  );
};
