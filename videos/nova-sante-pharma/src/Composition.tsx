import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import {
  Audio,
  CalculateMetadataFunction,
  Composition,
  staticFile,
} from "remotion";
import { SceneIntro } from "./scenes/SceneIntro";
import { SceneLogo } from "./scenes/SceneLogo";
import { SceneFeatures } from "./scenes/SceneFeatures";
import { SceneEngagement } from "./scenes/SceneEngagement";
import { SceneEndCard } from "./scenes/SceneEndCard";

type Props = {};

const calculateMetadata: CalculateMetadataFunction<Props> = () => {
  return {};
};

// Durées calées sur la voix off réelle (26,75 s, ElevenLabs) répartie au
// prorata du nombre de mots de chaque phrase du script, + 15 images de
// recouvrement par transition en fondu, + une courte tenue finale.
export const NovaPresentation: React.FC<Props> = () => {
  return (
    <>
      <Audio src={staticFile("audio/voiceover.mp3")} />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={222} name="Intro">
          <SceneIntro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={80} name="Logo">
          <SceneLogo />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={235} name="Features">
          <SceneFeatures />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={235} name="Engagement">
          <SceneEngagement />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={155} name="EndCard">
          <SceneEndCard />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </>
  );
};

export const MyComposition = () => {
  return (
    <Composition
      id="NovaPresentation"
      component={NovaPresentation}
      durationInFrames={867}
      fps={30}
      width={1920}
      height={1080}
      calculateMetadata={calculateMetadata}
    />
  );
};
