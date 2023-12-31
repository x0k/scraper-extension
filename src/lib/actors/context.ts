import {
  Request,
  AbstractActor,
  ActorId,
  LoadedMessage,
  ResponseMessage,
  IActorLogic,
  IRemoteActorLogic,
  ActorMessage,
  AbstractRemoteActor,
  RequestMessage,
} from "@/lib/actor";

export interface IContextActorMessageSender<
  I extends Request<string>,
  R extends Record<I["type"], unknown>,
  E
> {
  sendMessage(
    message: ActorMessage<I, R, E>,
    tabId?: number
  ): void | Promise<void>;
}

export class ContextActor<
  I extends Request<string>,
  R extends Record<I["type"], unknown>,
  E,
> extends AbstractActor<I, R, E, chrome.runtime.MessageSender> {
  protected broadcast(msg: LoadedMessage): void {
    this.sender.sendMessage(msg);
  }

  private handleMessage = <T extends I["type"]>(
    req: ActorMessage<Extract<I, Request<T>>, R, E>,
    sender: chrome.runtime.MessageSender
  ) => {
    this.handleActorMessage(req, sender, (response) => {
      this.sender.sendMessage(response, sender.tab?.id);
    });
  };

  protected listen(): void {
    chrome.runtime.onMessage.addListener(this.handleMessage);
  }

  constructor(
    id: ActorId,
    logic: IActorLogic<I, R, E, chrome.runtime.MessageSender>,
    protected readonly sender: IContextActorMessageSender<I, R, E>
  ) {
    super(id, logic);
  }

  stop(): void {
    chrome.runtime.onMessage.removeListener(this.handleMessage);
  }
}

export interface IContextRequestSender<
  I extends Request<string>,
  R extends Record<I["type"], unknown>,
  E
> {
  sendMessage<T extends I["type"]>(
    message: RequestMessage<Extract<I, Request<T>>>
  ): Promise<ResponseMessage<Extract<I, Request<T>>, R, E>>;
}

export class ContextRemoteActor<
  I extends Request<string>,
  R extends Record<I["type"], unknown>,
  E
> extends AbstractRemoteActor<I, R, E> {
  protected sendRequest<T extends I["type"]>(
    req: RequestMessage<Extract<I, Request<T>>>
  ): void {
    this.sender.sendMessage(req);
  }

  private handleContextMessage = this.handleMessage.bind(this);

  constructor(
    logic: IRemoteActorLogic<E>,
    private readonly sender: IContextRequestSender<I, R, E>
  ) {
    super(logic);
  }

  start(): void {
    chrome.runtime.onMessage.addListener(this.handleContextMessage);
  }

  stop(): void {
    chrome.runtime.onMessage.removeListener(this.handleContextMessage);
  }
}
