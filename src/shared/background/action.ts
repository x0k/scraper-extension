import { Request } from "@/lib/actor";

export enum BackgroundActionType {
  MakeRequest = "request::make",
}

export interface AbstractBackgroundAction<T extends BackgroundActionType>
  extends Request<T> {}

export interface MakeRequestAction
  extends AbstractBackgroundAction<BackgroundActionType.MakeRequest> {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  as?: "json" | "text";
}

export type BackgroundAction = MakeRequestAction;

export interface BackgroundActionResults {
  [BackgroundActionType.MakeRequest]: unknown;
}
