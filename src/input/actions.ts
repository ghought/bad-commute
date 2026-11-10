/** The riding actions. Everything downstream sees only these. */
export interface ActionState {
  throttle: boolean;
  brake: boolean;
  leanBack: boolean;
  leanForward: boolean;
  /** The ejector seat. Fires once per press. */
  eject: boolean;
}

export const emptyActions = (): ActionState => ({
  throttle: false,
  brake: false,
  leanBack: false,
  leanForward: false,
  eject: false,
});

export interface VehicleCommand {
  /** 0 or 1. Brake takes priority when both are held. */
  throttle: number;
  brake: number;
  /** -1 forward, 0 neutral, +1 back. Opposing leans cancel. */
  lean: number;
  eject?: number;
}

export function toCommand(a: ActionState): VehicleCommand {
  const brake = a.brake ? 1 : 0;
  return {
    throttle: a.throttle && !a.brake ? 1 : 0,
    brake,
    lean: (a.leanBack ? 1 : 0) - (a.leanForward ? 1 : 0),
    eject: a.eject ? 1 : 0,
  };
}

/** Riding inputs only: the ejector seat does not start the clock. */
export const anyAction = (a: ActionState) => a.throttle || a.brake || a.leanBack || a.leanForward;
