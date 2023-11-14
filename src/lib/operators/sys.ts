import { TypeOf, z } from "zod";

import {
  FlowOpFactory,
  OPERATOR_KEY,
  Scope,
  ScopedOp,
  ScopedOpFactory,
  evalInScope,
} from "@/lib/operator";
import { isRecord } from "@/lib/guards";
import { Factory } from "@/lib/factory";
import { traverseJsonLike } from "@/lib/json-like-traverser";
import { stringifyError } from "@/lib/error";

const defineConfig = z.object({
  functions: z.record(z.function()).optional(),
  constants: z.record(z.unknown()).optional(),
  for: z.unknown(),
});

export class DefineOpFactory extends FlowOpFactory<
  typeof defineConfig,
  unknown
> {
  schema = defineConfig;
  protected create({
    constants,
    functions,
    for: action,
  }: TypeOf<this["schema"]>): ScopedOp<unknown> {
    return async (scope) => {
      let evaluatedConstants: Record<string, unknown> | undefined;
      if (constants) {
        const data = await evalInScope(constants, scope);
        if (isRecord(data)) {
          evaluatedConstants = data;
        } else {
          throw new Error("Constants must be an object");
        }
      }
      const newScope: Scope<unknown> = {
        ...scope,
        functions: functions
          ? { ...scope.functions, ...functions }
          : scope.functions,
        constants: evaluatedConstants
          ? { ...scope.constants, ...evaluatedConstants }
          : scope.constants,
      };
      return evalInScope(action, newScope);
    };
  }
}

const callConfig = z.object({
  fn: z.unknown(),
  arg: z.unknown().optional(),
});

export class CallOpFactory extends FlowOpFactory<typeof callConfig, unknown> {
  schema = callConfig;
  protected create({ fn, arg }: z.TypeOf<this["schema"]>): ScopedOp<unknown> {
    return async (scope) => {
      const fnName = await evalInScope(fn, scope);
      if (typeof fnName !== "string") {
        throw new Error(`Function name is not a string: ${fnName}`);
      }
      const func = scope.functions[fnName];
      if (!func) {
        throw new Error(`Function ${fnName} is not defined`);
      }
      return func(
        arg ? { ...scope, context: await evalInScope(arg, scope) } : scope
      );
    };
  }
}

const getConfig = z.object({
  const: z.unknown(),
  default: z.unknown().optional(),
});

export class GetOpFactory extends FlowOpFactory<typeof getConfig, unknown> {
  schema = getConfig;
  protected create({
    const: name,
    default: defaultValue,
  }: z.TypeOf<this["schema"]>): ScopedOp<unknown> {
    return async (scope) => {
      const constName = await evalInScope(name, scope);
      if (typeof constName !== "string") {
        throw new Error(`Constant name is not a string: ${constName}`);
      }
      const value = scope.constants[constName];
      if (value !== undefined) {
        return value;
      }
      if (defaultValue !== undefined) {
        return await evalInScope(defaultValue, scope);
      }
      throw new Error(`Constant ${constName} is not defined`);
    };
  }
}

const execConfig = z.object({
  op: z.unknown(),
  config: z.unknown().optional(),
  arg: z.unknown().optional(),
});

export class ExecOpFactory extends FlowOpFactory<typeof execConfig, unknown> {
  schema = execConfig;

  constructor(
    protected readonly operatorFactoryConfig: ScopedOpFactory<unknown>
  ) {
    super();
  }

  protected create({
    op,
    config,
    arg,
  }: z.TypeOf<this["schema"]>): ScopedOp<unknown> {
    return async (scope) => {
      let opConfig: Record<string, unknown>;
      if (config === undefined) {
        opConfig = { [OPERATOR_KEY]: op };
      } else {
        const resolvedConfig = await evalInScope(config, scope);
        if (!isRecord(resolvedConfig)) {
          throw new Error("Config must be an object");
        }
        opConfig = { ...resolvedConfig, [OPERATOR_KEY]: op };
      }
      const scopedOp = this.operatorFactoryConfig.Create(opConfig);
      const context =
        arg === undefined ? scope.context : await evalInScope(arg, scope);
      return scopedOp({
        ...scope,
        context,
      });
    };
  }
}

const evalConfig = z.object({
  expression: z.unknown(),
});

export class EvalOpFactory extends FlowOpFactory<typeof evalConfig, unknown> {
  schema = evalConfig;

  constructor(private readonly operatorResolver: Factory<unknown, unknown>) {
    super();
  }

  protected create({ expression }: TypeOf<this["schema"]>): ScopedOp<unknown> {
    return async (scope) => {
      const opOrValue = traverseJsonLike(
        (v) => this.operatorResolver.Create(v),
        await evalInScope(expression, scope)
      );
      return await evalInScope(opOrValue, scope);
    };
  }
}

const errorConfig = z.unknown();

export class ErrorOpFactory extends FlowOpFactory<typeof errorConfig, unknown> {
  schema = errorConfig;
  protected create(): ScopedOp<unknown> {
    return (scope) => stringifyError(scope.error);
  }
}

export function sysOperatorsFactories(
  operatorsFactory: ScopedOpFactory<unknown>,
  operatorResolver: Factory<unknown, unknown>
) {
  return {
    define: new DefineOpFactory(),
    call: new CallOpFactory(),
    get: new GetOpFactory(),
    exec: new ExecOpFactory(operatorsFactory),
    eval: new EvalOpFactory(operatorResolver),
    err: new ErrorOpFactory(),
  };
}
