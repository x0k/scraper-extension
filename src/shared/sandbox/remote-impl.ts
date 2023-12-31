import { FormDataValidatorData } from "@/components/form";
import { ActorId, IRemoteActor, MessageType } from "@/lib/actor";
import { AsyncFactory } from "@/lib/factory";
import { ValidationData } from "@rjsf/utils";
import { nanoid } from "nanoid";

import { TemplateRendererData } from "@/lib/operators/template";
import { AsyncValidatorData } from "@/lib/operators/json-schema";
import { EvaluatorData } from "@/lib/operators/document";

import {
  SandboxAction,
  SandboxActionResults,
  SandboxActionType,
} from "./action";

export class RemoteEvaluator implements AsyncFactory<EvaluatorData, unknown> {
  constructor(
    private readonly handlerId: ActorId,
    private readonly actor: IRemoteActor<SandboxAction, SandboxActionResults>
  ) {}
  Create(config: EvaluatorData): Promise<unknown> {
    return this.actor.call({
      handlerId: this.handlerId,
      id: nanoid(),
      type: MessageType.Request,
      request: {
        type: SandboxActionType.RunEval,
        expression: config.expression,
        data: config.data,
        injectAs: config.injectAs,
      },
    });
  }
}

export class RemoteRenderer
  implements AsyncFactory<TemplateRendererData, string>
{
  constructor(
    private readonly handlerId: ActorId,
    private readonly actor: IRemoteActor<SandboxAction, SandboxActionResults>
  ) {}
  Create(config: TemplateRendererData): Promise<string> {
    return this.actor.call({
      handlerId: this.handlerId,
      id: nanoid(),
      type: MessageType.Request,
      request: {
        type: SandboxActionType.RenderTemplate,
        template: config.template,
        data: config.data,
      },
    });
  }
}

export class RemoteValidator
  implements AsyncFactory<AsyncValidatorData, boolean>
{
  constructor(
    private readonly handlerId: ActorId,
    private readonly actor: IRemoteActor<SandboxAction, SandboxActionResults>
  ) {}
  Create(config: AsyncValidatorData): Promise<boolean> {
    return this.actor.call({
      handlerId: this.handlerId,
      id: nanoid(),
      type: MessageType.Request,
      request: {
        type: SandboxActionType.Validate,
        schema: config.schema,
        data: config.data,
      },
    });
  }
}

export class RemoteFormDataValidator<T>
  implements AsyncFactory<FormDataValidatorData<T>, ValidationData<T>>
{
  constructor(
    private readonly handlerId: ActorId,
    private readonly actor: IRemoteActor<
      SandboxAction<T>,
      SandboxActionResults<T>
    >
  ) {}

  Create(config: FormDataValidatorData<T>): Promise<ValidationData<T>> {
    return this.actor.call({
      handlerId: this.handlerId,
      id: nanoid(),
      type: MessageType.Request,
      request: {
        type: SandboxActionType.ValidateFormData,
        formData: config.formData,
        schema: config.schema,
        uiSchema: config.uiSchema,
      },
    });
  }
}
