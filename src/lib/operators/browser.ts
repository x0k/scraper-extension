import { z } from "zod";
import { Readability } from "@mozilla/readability";
import Turndown from "turndown";

import { TaskOpFactory } from "@/lib/operator";
import { get } from "@/lib/object";
import { jsonSchema } from "@/lib/zod";
import { neverError } from "@/lib/guards";
import { AsyncFactory } from "@/lib/factory";

export abstract class BrowserFactory<
  Z extends z.ZodType,
  R
> extends TaskOpFactory<Z, R> {
  constructor(protected readonly window: Window) {
    super();
  }
}

const primitiveKeyConfig = z.union([z.string(), z.number().int()]);

const composedKeyConfig = z.union([
  primitiveKeyConfig,
  z.array(primitiveKeyConfig),
]);

const documentConfig = z.object({
  key: composedKeyConfig,
  default: z.unknown().optional(),
});

export class DocumentOpFactory extends BrowserFactory<
  typeof documentConfig,
  unknown
> {
  readonly schema = documentConfig;
  execute({ key, default: defaultValue }: z.TypeOf<this["schema"]>): unknown {
    const value = get(key, this.window.document, defaultValue);
    return jsonSchema.parse(value);
  }
}

const jsEvalConfig = z.object({
  expression: z.string(),
  default: z.unknown().optional(),
});

export class JsEvalOpFactory extends BrowserFactory<
  typeof jsEvalConfig,
  unknown
> {
  readonly schema = jsEvalConfig;

  constructor(
    window: Window,
    private readonly evaluator: AsyncFactory<string, unknown>
  ) {
    super(window);
  }

  async execute({
    expression,
    default: defaultValue,
  }: z.TypeOf<this["schema"]>): Promise<unknown> {
    if (defaultValue === undefined) {
      return this.evaluator.Create(expression);
    }
    try {
      return await this.evaluator.Create(expression);
    } catch (e) {
      console.error(e);
      return defaultValue;
    }
  }
}

const selectionConfig = z.object({
  as: z.enum(["text", "html"]).default("text"),
  default: z.unknown().default(""),
});

export class SelectionOpFactory extends BrowserFactory<
  typeof selectionConfig,
  unknown
> {
  readonly schema = selectionConfig;
  execute({ as, default: defaultValue }: z.TypeOf<this["schema"]>): unknown {
    const selection = this.window.getSelection();
    if (selection === null) {
      return defaultValue;
    }
    switch (as) {
      case "text":
        return selection.toString();
      case "html": {
        const content = selection.getRangeAt(0).cloneContents();
        const node = this.window.document.createElement("div");
        node.appendChild(content.cloneNode(true));
        return node.innerHTML;
      }
      default:
        throw neverError(as, "Invalid selection type");
    }
  }
}

const readabilityConfig = z.object({
  baseUrl: z.string(),
  html: z.string(),
  default: z.unknown().default(""),
});

export class ReadabilityOpFactory extends BrowserFactory<
  typeof readabilityConfig,
  unknown
> {
  readonly schema = readabilityConfig;
  execute({
    baseUrl,
    html,
    default: defaultValue,
  }: z.TypeOf<this["schema"]>): unknown {
    const tmpDoc = this.window.document.implementation.createHTMLDocument();
    const base = this.window.document.createElement("base");
    base.href = baseUrl;
    tmpDoc.head.appendChild(base);
    tmpDoc.body.innerHTML = html;
    const reader = new Readability(tmpDoc);
    const article = reader.parse();
    return article === null ? defaultValue : article;
  }
}

export class SimplifyHtmlOpFactory extends ReadabilityOpFactory {
  execute(config: z.TypeOf<this["schema"]>): unknown {
    const result = super.execute(config);
    if (typeof result === "object" && result !== null && "content" in result) {
      return result.content;
    }
    return result;
  }
}

const html2MarkdownConfig = z.object({
  html: z.string(),
  options: z.record(z.string()).default({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  }),
});

export class Html2MarkdownOpFactory extends BrowserFactory<
  typeof html2MarkdownConfig,
  string
> {
  readonly schema = html2MarkdownConfig;
  execute({ html, options }: z.TypeOf<this["schema"]>): string {
    const turndown = new Turndown(options);
    return turndown.turndown(html);
  }
}

export function browserOperatorsFactories(
  window: Window,
  evaluator: AsyncFactory<string, unknown>
) {
  return {
    document: new DocumentOpFactory(window),
    jsEval: new JsEvalOpFactory(window, evaluator),
    selection: new SelectionOpFactory(window),
    readability: new ReadabilityOpFactory(window),
    simplifyHtml: new SimplifyHtmlOpFactory(window),
    html2md: new Html2MarkdownOpFactory(window),
  };
}
