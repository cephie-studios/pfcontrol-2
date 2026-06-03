import { posthog } from "./posthog";
import type { CallBackProps } from "react-joyride-react19-compat";

export function trackTutorialEvent(section: string, data: CallBackProps) {
  const { action, index, status, type, step } = data;
  const stepTitle = typeof step?.title === "string" ? step.title : "";

  if (type === "tour:start") {
    posthog.capture("tutorial_started", { section });
  }

  if (type === "step:after") {
    if (action === "next") {
      posthog.capture("tutorial_step_viewed", {
        section,
        step_index: index,
        step_title: stepTitle,
      });
    } else if (action === "prev") {
      posthog.capture("tutorial_step_back", {
        section,
        step_index: index,
        step_title: stepTitle,
      });
    } else if (action === "close") {
      posthog.capture("tutorial_abandoned", {
        section,
        step_index: index,
        step_title: stepTitle,
      });
    }
  }

  if (status === "finished") {
    posthog.capture("tutorial_section_completed", {
      section,
      total_steps: index + 1,
    });
  } else if (status === "skipped") {
    posthog.capture("tutorial_skipped", {
      section,
      at_step: index,
      step_title: stepTitle,
    });
  }
}
