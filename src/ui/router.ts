import type { Game } from '../game/Game';
import type { UI } from './UI';

/**
 * Hash routes, so level links work from any folder on static hosting:
 *   #/            title
 *   #/levels      level select
 *   #/level/<id>  a course (locked ones explain themselves on level select)
 */
export function createRouter(game: Game, ui: UI) {
  let current: string | null = null;

  const route = (hash: string) => {
    const path = hash.replace(/^#/, '') || '/';
    if (path === current) return;
    current = path;

    if (!game.store.data.noticeSeen) {
      current = null;
      ui.showNotice(() => route(location.hash));
      return;
    }

    const parts = path.split('/').filter(Boolean);
    if (parts[0] === 'level' && parts[1]) {
      const level = game.findLevel(parts[1]);
      if (!level) {
        game.exitToMenu();
        ui.showLevels('That course is not on the schedule.');
        return;
      }
      if (!game.isUnlocked(level)) {
        game.exitToMenu();
        ui.showLevels(`${level.title} is locked. Finish the shift before it first.`);
        return;
      }
      game.audio.unlock();
      game.enterLevel(level);
      return;
    }

    game.exitToMenu();
    if (parts[0] === 'levels') ui.showLevels();
    else ui.showTitle();
  };

  return {
    begin() {
      window.addEventListener('hashchange', () => route(location.hash));
      route(location.hash);
    },
    navigate(hash: string) {
      if (location.hash === hash) {
        current = null;
        route(hash);
      } else {
        location.hash = hash;
      }
    },
  };
}
