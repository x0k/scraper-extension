import { nanoid } from "nanoid";

import { IRemoteActor } from "@/lib/actor";
import { AsyncFactory } from "@/lib/factory";
import { TemplateRendererData } from "@/lib/operators/ext";

import { Action, ActionResults, ActionType } from "@/shared/rpc";

export class Evaluator implements AsyncFactory<string, unknown> {
  constructor(private readonly actor: IRemoteActor<Action, ActionResults>) {}
  Create(expression: string) {
    return this.actor.call({
      id: nanoid(),
      type: ActionType.RunEval,
      expression,
    });
  }
}

export class Renderer implements AsyncFactory<TemplateRendererData, string> {
  constructor(private readonly actor: IRemoteActor<Action, ActionResults>) {}
  Create(config: TemplateRendererData): Promise<string> {
    return this.actor.call({
      id: nanoid(),
      type: ActionType.RenderTemplate,
      template: config.template,
      data: config.data,
    });
  }
}
