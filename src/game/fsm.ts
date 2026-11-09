export type GameState = 'boot' | 'menu' | 'ready' | 'playing' | 'paused' | 'crashed' | 'finished';
export type GameEvent = 'BOOTED' | 'ENTER_LEVEL' | 'INPUT' | 'PAUSE' | 'RESUME' | 'CRASH' | 'FINISH' | 'RESTART' | 'EXIT';

/** Which transitions are legal. Everything else is ignored. */
export class GameFSM {
  state: GameState = 'boot';
  /** The state a RESUME returns to. */
  private beforePause: GameState = 'ready';

  send(event: GameEvent): GameState {
    const s = this.state;
    switch (event) {
      case 'BOOTED':
        if (s === 'boot') this.state = 'menu';
        break;
      case 'ENTER_LEVEL':
      case 'RESTART':
        if (s !== 'boot') this.state = 'ready';
        break;
      case 'INPUT':
        if (s === 'ready') this.state = 'playing';
        break;
      case 'PAUSE':
        if (s === 'ready' || s === 'playing' || s === 'crashed') {
          this.beforePause = s;
          this.state = 'paused';
        }
        break;
      case 'RESUME':
        if (s === 'paused') this.state = this.beforePause;
        break;
      case 'CRASH':
        if (s === 'playing') this.state = 'crashed';
        break;
      case 'FINISH':
        if (s === 'playing') this.state = 'finished';
        break;
      case 'EXIT':
        if (s !== 'boot') this.state = 'menu';
        break;
    }
    return this.state;
  }

  get inLevel() {
    return this.state !== 'boot' && this.state !== 'menu';
  }
}
