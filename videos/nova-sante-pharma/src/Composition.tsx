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
import { WhatsAppBar } from "./WhatsAppBar";

type Props = {};

const calculateMetadata: CalculateMetadataFunction<Props> = () => {
  return {};
};

// Durées calées sur la voix off réelle (28,51 s, ElevenLabs, script sans
// « Bukavu ») répartie au prorata du nombre de mots de chaque phrase du
// script, + 15 images de recouvrement par transition en fondu, + une
// courte tenue finale.
export const NovaPresentation: React.FC<Props> = () => {
  return (
    <>
      <Audio src={staticFile("audio/voiceover.mp3")} />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={246} name="Intro">
          <SceneIntro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={83} name="Logo">
          <SceneLogo />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={246} name="Features">
          <SceneFeatures />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={245} name="Engagement">
          <SceneEngagement />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={117} name="EndCard">
          <SceneEndCard />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <WhatsAppBar />
    </>
  );
};

export const MyComposition = () => {
  return (
    <Composition
      id="NovaPresentation"
      component={NovaPresentation}
      durationInFrames={877}
      fps={30}
      width={1920}
      height={1080}
      calculateMetadata={calculateMetadata}
    />
  );
};
